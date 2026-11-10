<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    /**
     * Get system database backup status and statistics.
     */
    public function status(): JsonResponse
    {
        $this->authorizePermission('settings.manage');

        $driver = DB::connection()->getDriverName();
        $dbName = config('database.connections.' . config('database.default') . '.database');

        $dbSize = '0 KB';
        if ($driver === 'sqlite' && file_exists((string) $dbName)) {
            $bytes = filesize((string) $dbName) ?: 0;
            $dbSize = $this->formatBytes($bytes);
        } elseif ($driver === 'mysql') {
            try {
                $sizeResult = DB::selectOne("
                    SELECT SUM(data_length + index_length) as size_bytes
                    FROM information_schema.TABLES
                    WHERE table_schema = ?
                ", [$dbName]);
                if ($sizeResult && isset($sizeResult->size_bytes)) {
                    $dbSize = $this->formatBytes((int) $sizeResult->size_bytes);
                }
            } catch (\Throwable $e) {
                $dbSize = 'در دسترس نیست';
            }
        }

        return response()->json([
            'database_driver' => $driver,
            'database_name' => basename((string) $dbName),
            'database_size' => $dbSize,
            'total_customers' => Customer::count(),
            'total_devices' => CustomerPart::count(),
            'total_parts' => Part::count(),
            'total_users' => User::staffOnly()->count(),
            'server_time' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Export complete JSON backup of all customers, contact info, and their assigned devices.
     */
    public function exportCustomersJson(Request $request): StreamedResponse
    {
        $user = $request->user();
        if (!$user || (!$user->isAdministrator() && !$user->hasSafePermission('settings.manage') && !$user->hasSafePermission('customers.view'))) {
            abort(403, 'شما مجوز دریافت خروجی پرونده‌های مشتریان را ندارید.');
        }

        $customers = Customer::accessibleBy($request->user())
            ->with(['customerParts.part', 'histories.user:id,name'])
            ->orderBy('id', 'asc')
            ->get();

        $payload = [
            'metadata' => [
                'system' => 'Industrial Equipment CRM',
                'version' => '2.3.0',
                'exported_at' => Carbon::now()->toIso8601String(),
                'total_customers' => $customers->count(),
                'total_devices' => $customers->sum(fn ($c) => $c->customerParts->count()),
            ],
            'customers' => $customers->map(function (Customer $c) {
                return [
                    'id' => $c->id,
                    'type' => $c->type,
                    'customer_type' => $c->customer_type,
                    'company_name' => $c->company_name,
                    'first_name' => $c->first_name,
                    'last_name' => $c->last_name,
                    'national_code' => $c->national_code,
                    'economic_code' => $c->economic_code,
                    'registration_number' => $c->registration_number,
                    'mobile' => $c->mobile,
                    'phone' => $c->phone,
                    'email' => $c->email,
                    'postal_code' => $c->postal_code,
                    'province' => $c->province,
                    'city' => $c->city,
                    'address' => $c->address,
                    'notes' => $c->notes,
                    'created_at' => $c->created_at?->toIso8601String(),
                    'devices' => $c->customerParts->map(function (CustomerPart $cp) {
                        return [
                            'part_code' => $cp->part?->code,
                            'part_name' => $cp->part?->name,
                            'serial_number' => $cp->serial_number,
                            'quantity' => (int) ($cp->quantity ?: 1),
                            'invoice_amount' => $cp->invoice_amount,
                            'invoice_number' => $cp->invoice_number,
                            'installation_date' => $cp->installation_date?->toDateString(),
                            'warranty_expire_date' => $cp->warranty_expire_date?->toDateString(),
                            'status' => $cp->status,
                            'notes' => $cp->notes,
                        ];
                    })->values()->all(),
                ];
            })->values()->all(),
        ];

        $filename = 'crm-customers-devices-backup-' . Carbon::now()->format('Y-m-d-His') . '.json';
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return response()->streamDownload(function () use ($json) {
            echo $json;
        }, $filename, [
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
    }

    /**
     * Restore or import customers and devices from an uploaded JSON backup file.
     */
    public function restoreCustomersJson(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || (!$user->isAdministrator() && !$user->hasSafePermission('settings.manage') && !$user->hasSafePermission('customers.create'))) {
            abort(403, 'شما مجوز بازیابی و ورود پرونده‌های مشتریان را ندارید.');
        }

        $request->validate([
            'file' => 'required|file|mimes:json,txt|max:20480', // up to 20MB
        ], [
            'file.required' => 'لطفاً فایل پشتیبان JSON را بارگذاری کنید.',
            'file.mimes' => 'فایل انتخابی باید دارای پسوند .json باشد.',
        ]);

        $content = file_get_contents($request->file('file')->getRealPath());
        $data = json_decode($content, true);

        if (!$data || !is_array($data) || (!isset($data['customers']) && !is_array($data))) {
            return response()->json([
                'message' => 'ساختار فایل JSON معتبر نیست یا داده‌های مشتریان در آن یافت نشد.',
            ], 422);
        }

        $customersList = isset($data['customers']) && is_array($data['customers'])
            ? $data['customers']
            : $data;

        $createdCustomers = 0;
        $updatedCustomers = 0;
        $restoredDevices = 0;

        DB::beginTransaction();
        try {
            foreach ($customersList as $item) {
                if (!is_array($item)) continue;

                $mobile = !empty($item['mobile']) ? trim((string) $this->normalizeDigits((string) $item['mobile'])) : null;
                $nationalCode = !empty($item['national_code']) ? trim((string) $this->normalizeDigits((string) $item['national_code'])) : null;

                // Match existing customer by mobile or national_code
                $customer = null;
                if ($mobile) {
                    $customer = Customer::where('mobile', $mobile)->first();
                }
                if (!$customer && $nationalCode) {
                    $customer = Customer::where('national_code', $nationalCode)->first();
                }

                $customerData = [
                    'type' => in_array($item['type'] ?? '', ['company', 'individual'], true) ? $item['type'] : 'individual',
                    'customer_type' => in_array($item['customer_type'] ?? '', ['effective', 'potential'], true) ? $item['customer_type'] : 'potential',
                    'company_name' => $item['company_name'] ?? null,
                    'first_name' => $item['first_name'] ?? null,
                    'last_name' => $item['last_name'] ?? null,
                    'national_code' => $nationalCode,
                    'economic_code' => $item['economic_code'] ?? null,
                    'registration_number' => $item['registration_number'] ?? null,
                    'mobile' => $mobile,
                    'phone' => $item['phone'] ?? null,
                    'email' => $item['email'] ?? null,
                    'postal_code' => $item['postal_code'] ?? null,
                    'province' => $item['province'] ?? null,
                    'city' => $item['city'] ?? null,
                    'address' => $item['address'] ?? null,
                    'notes' => $item['notes'] ?? null,
                ];

                if (!empty($item['devices']) && is_array($item['devices'])) {
                    $customerData['customer_type'] = 'effective';
                }

                if ($customer) {
                    $customer->update(array_filter($customerData, fn ($v) => $v !== null));
                    $updatedCustomers++;
                } else {
                    $customerData['created_by_user_id'] = $request->user()->id;
                    $customer = Customer::create($customerData);
                    $createdCustomers++;
                }

                // Restore devices if present in item
                if (!empty($item['devices']) && is_array($item['devices'])) {
                    foreach ($item['devices'] as $dev) {
                        if (!is_array($dev)) continue;

                        $part = null;
                        if (!empty($dev['part_code'])) {
                            $part = Part::where('code', trim((string) $dev['part_code']))->first();
                        }
                        if (!$part && !empty($dev['part_name'])) {
                            $part = Part::where('name', trim((string) $dev['part_name']))->first();
                        }

                        if (!$part) {
                            // Create part placeholder if it does not exist
                            $partCode = !empty($dev['part_code']) ? trim((string) $dev['part_code']) : 'SKU-' . strtoupper(bin2hex(random_bytes(3)));
                            $partName = !empty($dev['part_name']) ? trim((string) $dev['part_name']) : 'دستگاه مدل ' . $partCode;
                            $part = Part::firstOrCreate(['code' => $partCode], [
                                'name' => $partName,
                                'periodic_service_months' => 12,
                                'stock_quantity' => 0,
                                'is_active' => true,
                            ]);
                        }

                        $serial = !empty($dev['serial_number']) ? trim((string) $dev['serial_number']) : null;

                        // Check if device assignment already exists for this customer
                        $cp = null;
                        if ($serial) {
                            $cp = CustomerPart::where('serial_number', $serial)->first();
                        } else {
                            $cp = CustomerPart::where('customer_id', $customer->id)
                                ->where('part_id', $part->id)
                                ->whereNull('serial_number')
                                ->first();
                        }

                        $cpData = [
                            'customer_id' => $customer->id,
                            'part_id' => $part->id,
                            'serial_number' => $serial,
                            'quantity' => max(1, (int) ($dev['quantity'] ?? 1)),
                            'invoice_amount' => isset($dev['invoice_amount']) ? (float) $dev['invoice_amount'] : null,
                            'invoice_number' => $dev['invoice_number'] ?? null,
                            'installation_date' => !empty($dev['installation_date']) ? Carbon::parse($dev['installation_date'])->toDateString() : null,
                            'warranty_expire_date' => !empty($dev['warranty_expire_date']) ? Carbon::parse($dev['warranty_expire_date'])->toDateString() : null,
                            'status' => in_array($dev['status'] ?? '', ['active', 'under_repair', 'replaced', 'retired'], true) ? $dev['status'] : 'active',
                            'notes' => $dev['notes'] ?? null,
                        ];

                        if ($cp) {
                            $cp->update($cpData);
                        } else {
                            CustomerPart::create($cpData);
                            $restoredDevices++;
                        }
                    }
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'عملیات بازیابی با موفقیت انجام شد.',
                'stats' => [
                    'created_customers' => $createdCustomers,
                    'updated_customers' => $updatedCustomers,
                    'restored_devices' => $restoredDevices,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'خطا در بازیابی داده‌ها: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download full database dump (clean SQL dump or SQLite file).
     */
    public function exportDatabaseDump(): StreamedResponse
    {
        $this->authorizePermission('settings.manage');

        $driver = DB::connection()->getDriverName();
        $dbName = config('database.connections.' . config('database.default') . '.database');

        if ($driver === 'sqlite') {
            $sqlitePath = (string) $dbName;
            if (!file_exists($sqlitePath)) {
                abort(404, 'فایل پایگاه داده SQLite یافت نشد.');
            }

            $filename = 'crm-database-backup-' . Carbon::now()->format('Y-m-d-His') . '.sqlite';

            return response()->streamDownload(function () use ($sqlitePath) {
                readfile($sqlitePath);
            }, $filename, [
                'Content-Type' => 'application/x-sqlite3',
            ]);
        }

        // Generic SQL dumper for MySQL / MariaDB (Pure PHP implementation - 100% reliable on cPanel, no doctrine/dbal)
        $filename = 'crm-database-backup-' . Carbon::now()->format('Y-m-d-His') . '.sql';

        return response()->streamDownload(function () use ($driver) {
            echo $this->generateSqlDump($driver);
        }, $filename, [
            'Content-Type' => 'application/sql; charset=utf-8',
        ]);
    }

    /**
     * Generate a portable SQL dump string without relying on mysqldump or removed doctrine/dbal APIs.
     */
    public function generateSqlDump(?string $driver = null): string
    {
        $driver = $driver ?: DB::connection()->getDriverName();
        $pdo = DB::connection()->getPdo();

        $out = "-- ============================================================\n";
        $out .= "-- Industrial Equipment CRM Database Dump\n";
        $out .= '-- Exported at: ' . Carbon::now()->toDateTimeString() . "\n";
        $out .= "-- ============================================================\n\n";
        $out .= "SET NAMES utf8mb4;\n";
        $out .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $tableRows = DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
            $tables = array_map(fn ($r) => (string) reset((array) $r), $tableRows);
        } else {
            $tables = array_map(
                fn ($t) => is_array($t) ? (string) ($t['name'] ?? reset($t)) : (string) $t,
                Schema::getTables()
            );
        }

        foreach ($tables as $table) {
            if (in_array($table, ['sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs', 'sqlite_sequence'], true)) {
                continue;
            }

            $out .= "-- Table structure for `{$table}`\n";
            $out .= "DROP TABLE IF EXISTS `{$table}`;\n";

            try {
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $createRow = DB::select("SHOW CREATE TABLE `{$table}`");
                    if (!empty($createRow)) {
                        $createSql = ((array) $createRow[0])['Create Table'] ?? null;
                        if ($createSql) {
                            $out .= $createSql . ";\n\n";
                        }
                    }
                }
            } catch (\Throwable) {
                // Fallback if SHOW CREATE TABLE is unavailable
            }

            $out .= "-- Dumping data for table `{$table}`\n";
            $batch = [];
            $columnsHeader = null;

            foreach (DB::table($table)->cursor() as $row) {
                $rowArr = (array) $row;
                if ($columnsHeader === null) {
                    $cols = array_map(fn ($c) => "`{$c}`", array_keys($rowArr));
                    $columnsHeader = '(' . implode(', ', $cols) . ')';
                }

                $values = [];
                foreach ($rowArr as $val) {
                    if ($val === null) {
                        $values[] = 'NULL';
                    } elseif (is_bool($val)) {
                        $values[] = $val ? '1' : '0';
                    } else {
                        $values[] = $pdo->quote((string) $val);
                    }
                }
                $batch[] = '(' . implode(', ', $values) . ')';

                if (count($batch) >= 100) {
                    $out .= "INSERT INTO `{$table}` {$columnsHeader} VALUES\n  " . implode(",\n  ", $batch) . ";\n";
                    $batch = [];
                }
            }

            if (!empty($batch)) {
                $out .= "INSERT INTO `{$table}` {$columnsHeader} VALUES\n  " . implode(",\n  ", $batch) . ";\n";
            }

            $out .= "\n";
        }

        $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
        $out .= "-- Dump completed successfully.\n";

        return $out;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }
}

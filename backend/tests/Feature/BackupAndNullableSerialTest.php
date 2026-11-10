<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerPart;
use App\Models\Part;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BackupAndNullableSerialTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_assign_part_with_nullable_serial_number(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $customer = Customer::create([
            'type' => 'individual',
            'customer_type' => 'potential',
            'first_name' => 'علی',
            'last_name' => 'اکبری',
            'mobile' => '09129998877',
            'created_by_user_id' => $admin->id,
        ]);

        $part = Part::create([
            'name' => 'دستگاه تست بدون سریال',
            'code' => 'TEST-NO-SERIAL',
            'periodic_service_months' => 6,
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        // Assign without serial_number
        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/customers/{$customer->id}/parts", [
            'part_id' => $part->id,
            'serial_number' => '', // optional / blank
            'quantity' => 2,
            'installation_date' => '2026-11-10',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('customer_parts', [
            'customer_id' => $customer->id,
            'part_id' => $part->id,
            'serial_number' => null,
            'quantity' => 2,
        ]);
        $this->assertEquals(8, $part->fresh()->stock_quantity);
    }

    public function test_backup_status_and_export_json(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        // 1. Status
        $statusRes = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/backup/status');
        $statusRes->assertOk();
        $statusRes->assertJsonStructure([
            'database_driver',
            'database_name',
            'database_size',
            'total_customers',
            'total_devices',
        ]);

        // 2. Export Customers JSON
        $exportRes = $this->actingAs($admin, 'sanctum')->get('/api/v1/backup/customers-json');
        $exportRes->assertOk();
        $this->assertStringContainsString('crm-customers-devices-backup-', $exportRes->headers->get('content-disposition'));
    }

    public function test_restore_customers_and_devices_from_json(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $jsonPayload = [
            'metadata' => ['version' => '2.3.0'],
            'customers' => [
                [
                    'type' => 'company',
                    'customer_type' => 'effective',
                    'company_name' => 'شرکت توسعه آزمایشی پارس',
                    'mobile' => '09121110022',
                    'province' => 'اصفهان',
                    'city' => 'نجف آباد',
                    'devices' => [
                        [
                            'part_code' => 'RESTORE-PART-01',
                            'part_name' => 'الکتروموتور صنعتی',
                            'serial_number' => 'RESTORE-SN-999',
                            'quantity' => 1,
                            'status' => 'active',
                        ],
                    ],
                ],
            ],
        ];

        $tmpFile = UploadedFile::fake()->createWithContent('backup.json', json_encode($jsonPayload));

        $restoreRes = $this->actingAs($admin, 'sanctum')->post('/api/v1/backup/customers-restore-json', [
            'file' => $tmpFile,
        ]);

        $restoreRes->assertOk();
        $this->assertDatabaseHas('customers', [
            'company_name' => 'شرکت توسعه آزمایشی پارس',
            'mobile' => '09121110022',
            'created_by_user_id' => $admin->id,
            'customer_type' => 'effective',
        ]);
        $this->assertDatabaseHas('customer_parts', [
            'serial_number' => 'RESTORE-SN-999',
        ]);

        // Restoring a second device of the same model WITHOUT serial_number must NOT overwrite RESTORE-SN-999
        $secondPayload = [
            'metadata' => ['version' => '2.3.0'],
            'customers' => [
                [
                    'type' => 'company',
                    'mobile' => '09121110022',
                    'devices' => [
                        [
                            'part_code' => 'RESTORE-PART-01',
                            'part_name' => 'الکتروموتور صنعتی',
                            'serial_number' => null,
                            'quantity' => 3,
                            'status' => 'active',
                        ],
                    ],
                ],
            ],
        ];
        $tmpFile2 = UploadedFile::fake()->createWithContent('backup2.json', json_encode($secondPayload));
        $this->actingAs($admin, 'sanctum')->post('/api/v1/backup/customers-restore-json', [
            'file' => $tmpFile2,
        ])->assertOk();

        $this->assertDatabaseHas('customer_parts', ['serial_number' => 'RESTORE-SN-999']);
        $this->assertDatabaseHas('customer_parts', ['serial_number' => null, 'quantity' => 3]);

        // Verify pure-PHP SQL dump generator works without removed doctrine/dbal APIs
        $dumpSql = (new \App\Http\Controllers\Api\V1\BackupController())->generateSqlDump();
        $this->assertStringContainsString('Industrial Equipment CRM Database Dump', $dumpSql);
        $this->assertStringContainsString('INSERT INTO `customers`', $dumpSql);
        $this->assertStringContainsString('RESTORE-SN-999', $dumpSql);
    }
}

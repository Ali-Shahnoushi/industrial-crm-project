<?php

namespace App\Imports;

use App\Models\Customer;
use App\Models\User;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Spatie\Permission\Models\Permission;

class CustomersImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    private int $importedCount = 0;
    private int $createdCount = 0;
    private int $updatedCount = 0;
    private int $skippedCount = 0;
    private array $errors = [];
    private ?int $userId;
    private ?User $user;

    public function __construct(User|int|null $user = null)
    {
        if ($user instanceof User) {
            $this->user = $user;
            $this->userId = (int) $user->id;
        } else {
            $this->userId = $user !== null ? (int) $user : null;
            $this->user = $this->userId ? User::find($this->userId) : null;
        }
    }

    public function model(array $row)
    {
        $customerTypeRaw = $this->getValue($row, ['وضعیت_مشتری', 'نوع_مشتری', 'noe_mshtry', 'customer_type', 'type_customer', 'noe_moshtari']);
        $personTypeRaw   = $this->getValue($row, ['نوع_شخصیت', 'نوع_شخص', 'noe_shkhs', 'person_type', 'type', 'noe_shakhs']);
        $firstName       = $this->getValue($row, ['نام', 'nam', 'first_name', 'firstname', 'name']);
        $lastName        = $this->getValue($row, ['نام_خانوادگی', 'nam_khanoadgy', 'last_name', 'lastname', 'family']);
        $companyName     = $this->getValue($row, ['نام_شرکت', 'نام_شرکت_سازمان', 'nam_shrkt', 'company_name', 'company', 'sherkat']);
        $nationalCode    = $this->normalizeDigits($this->getValue($row, ['کد_ملی_شناسه_ملی', 'کد_ملی', 'شناسه_ملی', 'kd_mly_shnash_mly', 'national_code', 'codemelli', 'shenaseh']));
        $mobile          = $this->normalizeDigits($this->getValue($row, ['شماره_همراه', 'موبایل', 'shmarh_hmrah', 'mobile', 'cellphone', 'phone_number']));
        $phone           = $this->normalizeDigits($this->getValue($row, ['تلفن_ثابت', 'تلفن', 'tlfn_thabt', 'phone', 'telephone']));
        $email           = strtolower(trim($this->getValue($row, ['ایمیل', 'aymyl', 'email', 'mail'])));
        $province        = $this->getValue($row, ['استان', 'astan', 'province', 'ostan']);
        $city            = $this->getValue($row, ['شهر', 'shhr', 'city', 'shahr']);
        $address         = $this->getValue($row, ['آدرس', 'نشانی', 'adrs', 'address']);
        $notes           = $this->getValue($row, ['توضیحات', 'یادداشت', 'یادداشت_پرونده', 'yaddasht', 'notes', 'description']);

        $personType = 'individual';
        if (str_contains($personTypeRaw, 'حقوقی') || strtolower($personTypeRaw) === 'company' || (!empty($companyName) && empty($firstName) && empty($lastName))) {
            $personType = 'company';
        }

        if ($personType === 'company') {
            if (empty($companyName)) {
                $this->skippedCount++;
                $this->errors[] = 'سطر مشتری حقوقی فاقد نام شرکت نادیده گرفته شد.';
                return null;
            }
        } else {
            if (empty($firstName) || empty($lastName)) {
                $this->skippedCount++;
                $this->errors[] = 'سطر مشتری حقیقی فاقد نام یا نام‌خانوادگی نادیده گرفته شد.';
                return null;
            }
        }

        $label = $companyName ?: "{$firstName} {$lastName}";

        if (!empty($mobile) && !preg_match('/^09\d{9}$/', $mobile)) {
            $this->skippedCount++;
            $this->errors[] = "شماره همراه «{$mobile}» نامعتبر است (مشتری: {$label})";
            return null;
        }

        if (!empty($nationalCode)) {
            $expectedLength = $personType === 'company' ? 11 : 10;
            if (strlen($nationalCode) !== $expectedLength) {
                $this->skippedCount++;
                $this->errors[] = "کد/شناسه ملی «{$nationalCode}» باید {$expectedLength} رقم باشد (مشتری: {$label})";
                return null;
            }
        }

        if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->skippedCount++;
            $this->errors[] = "فرمت ایمیل «{$email}» نامعتبر است (مشتری: {$label})";
            return null;
        }

        // Prevent duplicate storms on re-import when neither mobile nor national_code (nor company_name for companies) is present.
        if (empty($mobile) && empty($nationalCode) && $personType !== 'company') {
            $this->skippedCount++;
            $this->errors[] = "مشتری حقیقی «{$label}» فاقد شماره همراه و کد ملی است و نادیده گرفته شد.";
            return null;
        }

        $customerType = 'potential';
        if (str_contains($customerTypeRaw, 'بالفعل') || strtolower($customerTypeRaw) === 'effective') {
            $customerType = 'effective';
        }

        $payload = [
            'customer_type' => $customerType,
            'type' => $personType,
            'first_name' => $firstName ?: null,
            'last_name' => $lastName ?: null,
            'company_name' => $companyName ?: null,
            'national_code' => $nationalCode ?: null,
            'mobile' => $mobile ?: null,
            'phone' => $phone ?: null,
            'email' => $email ?: null,
            'province' => $province ?: null,
            'city' => $city ?: null,
            'address' => $address ?: null,
            'notes' => $notes ?: null,
        ];

        $existing = null;
        if (!empty($mobile)) {
            $existing = Customer::where('mobile', $mobile)->first();
        } elseif (!empty($nationalCode)) {
            $existing = Customer::where('national_code', $nationalCode)->first();
        } elseif ($personType === 'company' && !empty($companyName)) {
            $existing = Customer::where('type', 'company')->where('company_name', $companyName)->first();
        }

        if ($existing) {
            // 1. Check row-level customer ACL (restricted-scope staff cannot overwrite colleague or ownerless records)
            if ($this->user && $this->user->hasRestrictedCustomerScope()) {
                if ($existing->created_by_user_id === null || !$this->user->canAccessCustomer($existing)) {
                    $this->skippedCount++;
                    $this->errors[] = "مشتری «{$label}» متعلق به کارمند دیگری است و دسترسی ویرایش آن را ندارید.";
                    return null;
                }
            }

            // 2. Require explicit customers.edit permission to overwrite existing records
            if ($this->user && !$this->user->isAdministrator()) {
                $editPermExists = Permission::where('name', 'customers.edit')->where('guard_name', 'web')->exists();
                if ($editPermExists && !$this->user->hasPermissionTo('customers.edit')) {
                    $this->skippedCount++;
                    $this->errors[] = "شما مجوز ویرایش پرونده‌های موجود («{$label}») را ندارید.";
                    return null;
                }
            }

            $existing->update(array_filter($payload, fn ($v) => $v !== null && $v !== ''));
            $this->importedCount++;
            $this->updatedCount++;
            return $existing;
        }

        $payload['created_by_user_id'] = $this->userId;
        $this->importedCount++;
        $this->createdCount++;
        return Customer::create($payload);
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getCreatedCount(): int
    {
        return $this->createdCount;
    }

    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }

    public function getSkippedCount(): int
    {
        return $this->skippedCount;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Two-pass header lookup:
     * Pass 1 checks EXACT normalized key match first so `nam` / `نام` never greedily matches `nam_khanoadgy` / `نام_خانوادگی`!
     * Pass 2 allows substring fallback only for non-ambiguous candidate keys (> 4 chars).
     */
    private function getValue(array $row, array $keys): string
    {
        $normalizedMap = [];
        foreach ($row as $k => $v) {
            $strVal = trim((string) ($v ?? ''));
            $asciiKey = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', (string) $k));
            $unicodeKey = $this->normalizeUnicodeHeader((string) $k);

            if ($asciiKey !== '' && !array_key_exists($asciiKey, $normalizedMap)) {
                $normalizedMap[$asciiKey] = $strVal;
            }
            if ($unicodeKey !== '' && !array_key_exists($unicodeKey, $normalizedMap)) {
                $normalizedMap[$unicodeKey] = $strVal;
            }
        }

        // Pass 1: Exact match
        foreach ($keys as $candidate) {
            $candAscii = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $candidate));
            $candUnicode = $this->normalizeUnicodeHeader($candidate);

            if ($candUnicode !== '' && array_key_exists($candUnicode, $normalizedMap) && $normalizedMap[$candUnicode] !== '') {
                return $normalizedMap[$candUnicode];
            }
            if ($candAscii !== '' && array_key_exists($candAscii, $normalizedMap) && $normalizedMap[$candAscii] !== '') {
                return $normalizedMap[$candAscii];
            }
        }

        // Pass 2: Substring fallback (only for longer unambiguous keys > 4 chars)
        foreach ($keys as $candidate) {
            $candUnicode = $this->normalizeUnicodeHeader($candidate);
            if (mb_strlen($candUnicode) <= 4) {
                continue;
            }
            foreach ($normalizedMap as $rk => $rv) {
                if ($rv !== '' && str_contains($rk, $candUnicode)) {
                    return $rv;
                }
            }
        }

        return '';
    }

    private function normalizeUnicodeHeader(string $key): string
    {
        $arabicChars = ['ي' => 'ی', 'ك' => 'ک', "\u{200C}" => '_'];
        $clean = strtr(trim(mb_strtolower($key)), $arabicChars);
        $clean = preg_replace('/[^\p{L}\p{N}]+/u', '_', $clean);
        return trim((string) $clean, '_');
    }

    private function normalizeDigits(string $str): string
    {
        $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $arabic  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $latin   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        $num = str_replace($persian, $latin, $str);
        $num = str_replace($arabic, $latin, $num);
        $num = preg_replace('/[^\d]/', '', $num);

        if (str_starts_with($num, '989') && strlen($num) === 12) {
            $num = '0' . substr($num, 2);
        } elseif (str_starts_with($num, '00989') && strlen($num) === 14) {
            $num = '0' . substr($num, 4);
        } elseif (str_starts_with($num, '9') && strlen($num) === 10) {
            $num = '0' . $num;
        }

        return $num;
    }
}

<?php

namespace App\Imports;

use App\Models\Customer;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Illuminate\Support\Facades\Log;

class CustomersImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    private int $importedCount = 0;
    private array $errors = [];

    public function model(array $row)
    {
        // Find values using multiple possible alias keys
        $customerTypeRaw = $this->getValue($row, ['noe_mshtry', 'customer_type', 'type_customer', 'noe_moshtari']);
        $personTypeRaw   = $this->getValue($row, ['noe_shkhs', 'person_type', 'type', 'noe_shakhs']);
        $firstName       = $this->getValue($row, ['nam', 'first_name', 'firstname', 'name']);
        $lastName        = $this->getValue($row, ['nam_khanoadgy', 'last_name', 'lastname', 'family']);
        $companyName     = $this->getValue($row, ['nam_shrkt', 'company_name', 'company', 'sherkat']);
        $nationalCode    = $this->normalizeDigits($this->getValue($row, ['kd_mly_shnash_mly', 'national_code', 'codemelli', 'shenaseh']));
        $mobile          = $this->normalizeDigits($this->getValue($row, ['shmarh_hmrah', 'mobile', 'cellphone', 'phone_number']));
        $phone           = $this->normalizeDigits($this->getValue($row, ['tlfn_thabt', 'phone', 'telephone']));
        $email           = strtolower(trim($this->getValue($row, ['aymyl', 'email', 'mail'])));
        $province        = $this->getValue($row, ['astan', 'province', 'ostan']);
        $city            = $this->getValue($row, ['shhr', 'city', 'shahr']);
        $address         = $this->getValue($row, ['adrs', 'address']);
        $notes           = $this->getValue($row, ['yaddasht', 'notes', 'description']);

        if (empty($firstName) || empty($lastName)) {
            $this->errors[] = "سطر فاقد نام یا نام‌خانوادگی نادیده گرفته شد (موبایل: {$mobile})";
            return null;
        }

        if (empty($mobile) || !preg_match('/^09\d{9}$/', $mobile)) {
            $this->errors[] = "شماره همراه «{$mobile}» نامعتبر است (نام: {$firstName} {$lastName})";
            return null;
        }

        // Determine customer type
        $customerType = 'potential';
        if (str_contains($customerTypeRaw, 'بالفعل') || strtolower($customerTypeRaw) === 'effective') {
            $customerType = 'effective';
        }

        // Determine person type
        $personType = 'individual';
        if (str_contains($personTypeRaw, 'حقوقی') || strtolower($personTypeRaw) === 'company' || !empty($companyName)) {
            $personType = 'company';
        }

        $this->importedCount++;

        return Customer::updateOrCreate(
            ['mobile' => $mobile],
            [
                'customer_type' => $customerType,
                'type' => $personType,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'company_name' => $companyName ?: null,
                'national_code' => $nationalCode ?: null,
                'phone' => $phone ?: null,
                'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null,
                'province' => $province ?: null,
                'city' => $city ?: null,
                'address' => $address ?: null,
                'notes' => $notes ?: null,
            ]
        );
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    private function getValue(array $row, array $keys): string
    {
        foreach ($row as $k => $v) {
            $cleanedKey = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', (string)$k));
            foreach ($keys as $candidate) {
                if ($cleanedKey === $candidate || str_contains($cleanedKey, $candidate)) {
                    return trim((string)$v);
                }
            }
        }
        return '';
    }

    private function normalizeDigits(string $str): string
    {
        $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $arabic  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $latin   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        $num = str_replace($persian, $latin, $str);
        $num = str_replace($arabic, $latin, $num);
        $num = preg_replace('/[^\d]/', '', $num);

        if (str_starts_with($num, '989')) {
            $num = '0' . substr($num, 2);
        }

        return $num;
    }
}

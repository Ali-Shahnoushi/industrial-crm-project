<?php

namespace App\Imports;

use App\Models\Customer;
use App\Models\User;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class CustomersImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    private int $importedCount = 0;
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

        $personType = 'individual';
        if (str_contains($personTypeRaw, 'حقوقی') || strtolower($personTypeRaw) === 'company' || (!empty($companyName) && empty($firstName) && empty($lastName))) {
            $personType = 'company';
        }

        if ($personType === 'company') {
            if (empty($companyName)) {
                $this->errors[] = "سطر مشتری حقوقی فاقد نام شرکت نادیده گرفته شد.";
                return null;
            }
        } else {
            if (empty($firstName) || empty($lastName)) {
                $this->errors[] = "سطر مشتری حقیقی فاقد نام یا نام‌خانوادگی نادیده گرفته شد.";
                return null;
            }
        }

        if (!empty($mobile) && !preg_match('/^09\d{9}$/', $mobile)) {
            $label = $companyName ?: "{$firstName} {$lastName}";
            $this->errors[] = "شماره همراه «{$mobile}» نامعتبر است (مشتری: {$label})";
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
            'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null,
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
            if ($this->user && !$this->user->canAccessCustomer($existing)) {
                $label = $companyName ?: "{$firstName} {$lastName}";
                $this->errors[] = "مشتری «{$label}» متعلق به کارمند دیگری است و دسترسی ویرایش آن را ندارید.";
                return null;
            }
            $existing->update($payload);
            $this->importedCount++;
            return $existing;
        }

        $payload['created_by_user_id'] = $this->userId;
        $this->importedCount++;
        return Customer::create($payload);
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
            $cleanedKey = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', (string) $k));
            foreach ($keys as $candidate) {
                if ($cleanedKey === $candidate || str_contains($cleanedKey, $candidate)) {
                    return trim((string) $v);
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

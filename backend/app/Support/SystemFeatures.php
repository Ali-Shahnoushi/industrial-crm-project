<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class SystemFeatures
{
    public const SETTING_KEY = 'system_features';
    public const CACHE_KEY = 'crm_system_features_v1';

    /**
     * Canonical feature registry. All features default to enabled (`true`).
     *
     * @return array<string, array{key: string, label: string, description: string, default: bool}>
     */
    public static function definitions(): array
    {
        return [
            'parts' => [
                'key' => 'parts',
                'label' => 'کاتالوگ دستگاه‌ها و انبار',
                'description' => 'مدیریت کاتالوگ دستگاه‌ها، موجودی انبار، کاردکس ورود/خروج و تخصیص دستگاه به مشتریان.',
                'default' => true,
            ],
            'sales' => [
                'key' => 'sales',
                'label' => 'فروش، گزارش‌ها و مالی (فاکتورها)',
                'description' => 'ثبت سفارش فروش، نمودارها و تحلیل‌های فروش، صدور و چاپ فاکتور رسمی.',
                'default' => true,
            ],
            'tickets' => [
                'key' => 'tickets',
                'label' => 'تیکتینگ و پشتیبانی فنی',
                'description' => 'مرکز تیکت‌های پشتیبانی، درخواست تعمیر، دپارتمان‌ها و ارجاع خودکار به کارشناسان.',
                'default' => true,
            ],
            'sms' => [
                'key' => 'sms',
                'label' => 'سامانه پیامک (ملی‌پیامک)',
                'description' => 'ارسال پیامک‌های الگو، گزارش سوابق ارسال و تنظیمات وب‌سرویس ملی‌پیامک.',
                'default' => true,
            ],
            'customer_portal' => [
                'key' => 'customer_portal',
                'label' => 'پنل اختصاصی مشتریان (پورتال)',
                'description' => 'ورود مشتریان به پنل کاربری اختصاصی برای مشاهده دستگاه‌ها، گارانتی و ثبت تیکت.',
                'default' => true,
            ],
            'backup' => [
                'key' => 'backup',
                'label' => 'پشتیبان‌گیری و بازیابی داده‌ها',
                'description' => 'استخراج فایل پشتیبان SQL و JSON پرونده مشتریان و بازیابی اطلاعات.',
                'default' => true,
            ],
            'otp_login' => [
                'key' => 'otp_login',
                'label' => 'ورود با کد یکبارمصرف پیامکی (OTP)',
                'description' => 'امکان ورود کاربران و مشتریان از طریق ارسال کد تایید ۵ رقمی به شماره موبایل.',
                'default' => true,
            ],
        ];
    }

    /**
     * Get all feature states as a key => bool map.
     *
     * @return array<string, bool>
     */
    public static function all(): array
    {
        $defaults = [];
        foreach (self::definitions() as $key => $meta) {
            $defaults[$key] = (bool) $meta['default'];
        }

        if (!Schema::hasTable('settings')) {
            return $defaults;
        }

        $stored = Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            $raw = Setting::get(self::SETTING_KEY);
            if (!$raw) {
                return [];
            }

            $decoded = json_decode((string) $raw, true);

            return is_array($decoded) ? $decoded : [];
        });

        $resolved = $defaults;
        foreach ($defaults as $key => $defaultVal) {
            if (array_key_exists($key, $stored)) {
                $resolved[$key] = filter_var($stored[$key], FILTER_VALIDATE_BOOLEAN);
            }
        }

        return $resolved;
    }

    /**
     * Get detailed list of features with labels, descriptions, and active state.
     *
     * @return array<int, array{key: string, label: string, description: string, enabled: bool}>
     */
    public static function listDetailed(): array
    {
        $states = self::all();
        $items = [];

        foreach (self::definitions() as $key => $meta) {
            $items[] = [
                'key' => $key,
                'label' => $meta['label'],
                'description' => $meta['description'],
                'enabled' => $states[$key] ?? true,
            ];
        }

        return $items;
    }

    /**
     * Check whether a specific system feature is enabled.
     */
    public static function isEnabled(string $feature): bool
    {
        $states = self::all();

        return $states[$feature] ?? true;
    }

    /**
     * Get Persian label for a feature key.
     */
    public static function label(string $feature): string
    {
        $defs = self::definitions();

        return $defs[$feature]['label'] ?? $feature;
    }

    /**
     * Persist updated feature flags and flush cache.
     *
     * @param array<string, mixed> $updates
     * @return array<string, bool>
     */
    public static function update(array $updates): array
    {
        $current = self::all();
        $validKeys = array_keys(self::definitions());

        foreach ($updates as $key => $value) {
            if (in_array($key, $validKeys, true)) {
                $current[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
        }

        Setting::set(self::SETTING_KEY, json_encode($current, JSON_UNESCAPED_UNICODE));
        Cache::forget(self::CACHE_KEY);

        return self::all();
    }

    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}

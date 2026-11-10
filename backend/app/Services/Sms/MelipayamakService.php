<?php

namespace App\Services\Sms;

use App\Models\Customer;
use App\Models\Setting;
use App\Models\SmsLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MelipayamakService
{
    public const BASE_SERVICE_URL = 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber';
    public const SEND_SMS_URL = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS';

    protected function isSandboxEnabled(): bool
    {
        $stored = Setting::get('melipayamak_sandbox');
        if ($stored !== null && $stored !== '') {
            return filter_var($stored, FILTER_VALIDATE_BOOLEAN);
        }

        return filter_var(env('MELIPAYAMAK_SANDBOX', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Send pattern-based SMS via Melipayamak BaseServiceNumber API.
     */
    public function sendPattern(string $mobile, string $bodyId, array $tokens, ?Customer $customer = null): array
    {
        $mobile = $this->normalizeMobile($mobile);

        $username = Setting::get('melipayamak_username') ?: env('MELIPAYAMAK_USERNAME');
        $password = Setting::get('melipayamak_password') ?: env('MELIPAYAMAK_PASSWORD');
        $sandbox = $this->isSandboxEnabled();

        if ($sandbox) {
            $fakeMessageId = 'SANDBOX-' . random_int(10000000, 99999999);
            Log::info("Melipayamak Sandbox SMS to {$mobile} with Pattern {$bodyId}");

            SmsLog::create([
                'customer_id' => $customer?->id,
                'recipient_mobile' => $mobile,
                'pattern_code' => $bodyId,
                'tokens' => $tokens,
                'status' => 'sent',
                'provider_message_id' => $fakeMessageId,
                'error_message' => null,
            ]);

            return [
                'success' => true,
                'message_id' => $fakeMessageId,
                'status' => 'پیامک در حالت آزمایشی (سندباکس) ثبت و شبیه‌سازی شد.',
                'is_sandbox' => true,
            ];
        }

        if (empty($username) || empty($password)) {
            return [
                'success' => false,
                'message_id' => null,
                'status' => 'تنظیمات درگاه ملی‌پیامک (نام کاربری / رمز عبور) تکمیل نشده است.',
                'is_sandbox' => false,
            ];
        }

        try {
            $response = Http::timeout(10)->post(self::BASE_SERVICE_URL, [
                'userName' => $username,
                'password' => $password,
                'text' => implode(';', array_values($tokens)),
                'to' => $mobile,
                'bodyId' => (int) $bodyId,
            ]);

            $result = $response->json();
            $retStatus = $result['RetStatus'] ?? -1;
            $val = $result['Value'] ?? null;
            $strStatus = $result['StrRetStatus'] ?? 'Unknown';

            $isSuccess = $retStatus == 1 && is_numeric($val) && (int) $val > 0;

            SmsLog::create([
                'customer_id' => $customer?->id,
                'recipient_mobile' => $mobile,
                'pattern_code' => $bodyId,
                'tokens' => $tokens,
                'status' => $isSuccess ? 'sent' : 'failed',
                'provider_message_id' => $isSuccess ? (string) $val : null,
                'error_message' => $isSuccess ? null : ($strStatus . ' (Code: ' . $val . ')'),
            ]);

            return [
                'success' => $isSuccess,
                'message_id' => $isSuccess ? (string) $val : null,
                'status' => $strStatus,
                'is_sandbox' => false,
            ];
        } catch (\Throwable $e) {
            Log::error('Melipayamak dispatch error: ' . $e->getMessage());

            SmsLog::create([
                'customer_id' => $customer?->id,
                'recipient_mobile' => $mobile,
                'pattern_code' => $bodyId,
                'tokens' => $tokens,
                'status' => 'failed',
                'provider_message_id' => null,
                'error_message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message_id' => null,
                'status' => 'خطا در ارتباط با سرور ملی‌پیامک: ' . $e->getMessage(),
                'is_sandbox' => false,
            ];
        }
    }

    /**
     * Send plain text SMS via Melipayamak SendSMS API (used for OTP; text is redacted in logs).
     */
    public function sendNormalSms(string $mobile, string $text): array
    {
        $mobile = $this->normalizeMobile($mobile);

        $username = Setting::get('melipayamak_username') ?: env('MELIPAYAMAK_USERNAME');
        $password = Setting::get('melipayamak_password') ?: env('MELIPAYAMAK_PASSWORD');
        $fromNumber = Setting::get('melipayamak_from') ?: env('MELIPAYAMAK_FROM', '5000...');
        $sandbox = $this->isSandboxEnabled();

        if ($sandbox) {
            $fakeMessageId = 'SANDBOX-OTP-' . random_int(10000000, 99999999);
            Log::info("Melipayamak Sandbox OTP SMS simulated for {$mobile}");

            SmsLog::create([
                'recipient_mobile' => $mobile,
                'pattern_code' => 'NORMAL-OTP',
                'tokens' => ['text' => '[REDACTED]'],
                'status' => 'sent',
                'provider_message_id' => $fakeMessageId,
                'error_message' => null,
            ]);

            return [
                'success' => true,
                'message_id' => $fakeMessageId,
                'status' => 'پیامک در حالت آزمایشی (Sandbox) شبیه‌سازی شد.',
                'is_sandbox' => true,
            ];
        }

        if (empty($username) || empty($password)) {
            return [
                'success' => false,
                'message_id' => null,
                'status' => 'تنظیمات درگاه پیامک کامل نیست.',
                'is_sandbox' => false,
            ];
        }

        try {
            $response = Http::timeout(10)->post(self::SEND_SMS_URL, [
                'username' => $username,
                'password' => $password,
                'from' => $fromNumber,
                'to' => $mobile,
                'text' => $text,
                'isflash' => false,
            ]);

            $result = $response->json();
            $retStatus = $result['RetStatus'] ?? -1;
            $val = $result['Value'] ?? null;
            $strStatus = $result['StrRetStatus'] ?? 'Unknown';

            $isSuccess = $retStatus == 1 && is_numeric($val) && (int) $val > 0;

            SmsLog::create([
                'recipient_mobile' => $mobile,
                'pattern_code' => 'NORMAL-OTP',
                'tokens' => ['text' => '[REDACTED]'],
                'status' => $isSuccess ? 'sent' : 'failed',
                'provider_message_id' => $isSuccess ? (string) $val : null,
                'error_message' => $isSuccess ? null : ($strStatus . ' (Code: ' . $val . ')'),
            ]);

            return [
                'success' => $isSuccess,
                'message_id' => $isSuccess ? (string) $val : null,
                'status' => $strStatus,
                'is_sandbox' => false,
            ];
        } catch (\Throwable $e) {
            Log::error('Melipayamak Normal SMS error: ' . $e->getMessage());

            SmsLog::create([
                'recipient_mobile' => $mobile,
                'pattern_code' => 'NORMAL-OTP',
                'tokens' => ['text' => '[REDACTED]'],
                'status' => 'failed',
                'provider_message_id' => null,
                'error_message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message_id' => null,
                'status' => 'خطا در ارسال پیامک: ' . $e->getMessage(),
                'is_sandbox' => false,
            ];
        }
    }

    protected function normalizeMobile(string $mobile): string
    {
        $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $arabic  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $latin   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        $mobile = str_replace($arabic, $latin, str_replace($persian, $latin, $mobile));
        $mobile = preg_replace('/[^\d+]/', '', $mobile);

        if (str_starts_with($mobile, '+98')) {
            $mobile = '0' . substr($mobile, 3);
        } elseif (str_starts_with($mobile, '0098')) {
            $mobile = '0' . substr($mobile, 4);
        } elseif (str_starts_with($mobile, '98') && strlen($mobile) === 12) {
            $mobile = '0' . substr($mobile, 2);
        }

        return $mobile;
    }
}

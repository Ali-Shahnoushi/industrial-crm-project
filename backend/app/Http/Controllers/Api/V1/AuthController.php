<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Sms\MelipayamakService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(protected MelipayamakService $melipayamakService)
    {
    }

    /**
     * Send OTP SMS for phone-based login.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        if ($request->has('phone')) {
            $request->merge([
                'phone' => trim((string) $this->normalizeDigits((string) $request->input('phone', ''))),
            ]);
        }

        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/'],
        ], [
            'phone.required' => 'وارد کردن شماره همراه الزامی است.',
            'phone.regex' => 'شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.',
        ]);

        $phone = $validated['phone'];
        $user = User::where('phone', $phone)->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'phone' => ['کاربری با این شماره همراه در سیستم ثبت نشده است.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.',
            ], 403);
        }

        $cooldownKey = 'otp_cooldown_' . $phone;
        if (Cache::has($cooldownKey)) {
            return response()->json([
                'message' => 'کد تایید اخیراً ارسال شده است. لطفاً ۶۰ ثانیه صبر نمایید.',
            ], 429);
        }

        $otpCode = strval(random_int(10000, 99999));
        Cache::put('otp_' . $phone, $otpCode, now()->addMinutes(2));
        Cache::put('otp_attempts_' . $phone, 0, now()->addMinutes(2));
        Cache::put($cooldownKey, true, now()->addSeconds(60));

        $smsText = "کد تأیید ورود شما به سامانه مدیریت ارتباط با مشتری: {$otpCode}\nاعتبار: ۲ دقیقه";
        $smsResult = $this->melipayamakService->sendNormalSms($phone, $smsText);

        if (empty($smsResult['success'])) {
            Cache::forget('otp_' . $phone);
            Cache::forget('otp_attempts_' . $phone);
            Cache::forget($cooldownKey);

            return response()->json([
                'message' => 'ارسال پیامک تأیید ناموفق بود. لطفاً دوباره تلاش کنید یا با مدیر سیستم تماس بگیرید.',
            ], 503);
        }

        $response = [
            'message' => 'کد تأیید ورود با موفقیت به شماره شما پیامک شد.',
            'expires_in' => 120,
        ];

        if (!empty($smsResult['is_sandbox'])) {
            $response['sandbox'] = true;
            $response['message'] = 'درگاه پیامک در حالت شبیه‌ساز است و پیامکی ارسال نشد. جهت دریافت کد با مدیر ارشد سیستم تماس بگیرید.';
        }

        return response()->json($response);
    }

    /**
     * Verify OTP code and login.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $request->merge([
            'phone' => trim((string) $this->normalizeDigits((string) $request->input('phone', ''))),
            'code' => trim((string) $this->normalizeDigits((string) $request->input('code', ''))),
        ]);

        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'code' => ['required', 'string'],
        ], [
            'phone.required' => 'شماره همراه الزامی است.',
            'code.required' => 'کد تأیید پیامک‌شده را وارد کنید.',
        ]);

        $phone = $validated['phone'];
        $code = trim($validated['code']);

        $attemptKey = 'otp_attempts_' . $phone;
        $attempts = (int) Cache::get($attemptKey, 0);

        if ($attempts >= 5) {
            Cache::forget('otp_' . $phone);
            Cache::forget($attemptKey);

            throw ValidationException::withMessages([
                'code' => ['تعداد تلاش‌های ناموفق بیش از حد مجاز بود. لطفاً مجدداً درخواست کد تأیید ارسال کنید.'],
            ]);
        }

        $cachedCode = Cache::get('otp_' . $phone);

        if (!$cachedCode || $cachedCode !== $code) {
            Cache::increment($attemptKey);
            $remaining = max(0, 5 - ($attempts + 1));

            throw ValidationException::withMessages([
                'code' => ["کد تأیید وارد شده نادرست یا منقضی است. ({$remaining} فرصت تلاش باقی‌مانده)"],
            ]);
        }

        Cache::forget('otp_' . $phone);
        Cache::forget($attemptKey);

        $user = User::where('phone', $phone)->firstOrFail();

        if (!$user->is_active) {
            return response()->json([
                'message' => 'حساب کاربری شما غیرفعال شده است.',
            ], 403);
        }

        $token = $user->createToken('api-token')->plainTextToken;
        $cookie = $this->createAuthCookie($token);

        return response()->json([
            'message' => 'ورود با موفقیت انجام شد.',
            'user' => $user->serializeForApi(),
            'token' => $token,
        ])->withCookie($cookie);
    }

    /**
     * Login using email or phone and password.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $normalizedLogin = trim((string) $this->normalizeDigits($validated['login']));
        $normalizedPassword = (string) $this->normalizeDigits($validated['password']);
        $loginField = filter_var($normalizedLogin, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';

        $user = User::where($loginField, $normalizedLogin)->first();

        $passwordMatches = $user && (
            Hash::check($validated['password'], $user->password) ||
            ($normalizedPassword !== $validated['password'] && Hash::check($normalizedPassword, $user->password))
        );

        if (!$user || !$passwordMatches) {
            throw ValidationException::withMessages([
                'login' => ['اطلاعات ورود (نام کاربری/رمز عبور) نادرست است.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.',
            ], 403);
        }

        $token = $user->createToken('api-token')->plainTextToken;
        $cookie = $this->createAuthCookie($token);

        return response()->json([
            'user' => $user->serializeForApi(),
            'token' => $token,
        ])->withCookie($cookie);
    }

    /**
     * Get the authenticated user with direct permissions and customer ACL scope.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $user->serializeForApi(),
        ]);
    }

    /**
     * Update authenticated user profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($request->has('phone')) {
            $normPhone = trim((string) $this->normalizeDigits((string) $request->input('phone', '')));
            $request->merge(['phone' => $normPhone !== '' ? $normPhone : null]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone,' . $user->id,
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'avatar' => 'nullable|image|max:3072',
        ], [
            'name.required' => 'وارد کردن نام و نام خانوادگی الزامی است.',
            'phone.regex' => 'فرمت شماره موبایل نامعتبر است (باید ۱۱ رقم عددی بوده و با 09 شروع شود).',
            'phone.unique' => 'این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است.',
            'password.min' => 'کلمه عبور باید حداقل ۸ کاراکتر باشد.',
            'password.regex' => 'کلمه عبور باید حداقل شامل یک حرف انگلیسی و یک عدد باشد.',
            'avatar.image' => 'فایل انتخابی باید تصویر باشد.',
            'avatar.max' => 'حداکثر حجم تصویر مجاز ۳ مگابایت است.',
        ]);

        $user->name = $validated['name'];
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        if ($request->boolean('remove_avatar') || $request->input('remove_avatar') === '1') {
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = null;
        } elseif ($request->hasFile('avatar')) {
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $request->file('avatar')->store('avatars', 'public');
        }

        $user->save();

        // تغییر رمز باید تمام نشست‌های دیگر کاربر را باطل کند
        if (!empty($validated['password'])) {
            $token = $request->user()?->currentAccessToken();
            $currentTokenId = $token instanceof \Laravel\Sanctum\PersonalAccessToken ? $token->getKey() : null;
            $user->tokens()
                ->when($currentTokenId, fn ($query) => $query->whereKeyNot($currentTokenId))
                ->delete();
        }

        return response()->json([
            'message' => 'پروفایل شما با موفقیت بروزرسانی شد.',
            'user' => $user->fresh()->serializeForApi(),
        ]);
    }

    /**
     * Logout and revoke API token, and clear httpOnly cookie.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();
        $cookie = cookie()->forget('crm_token', '/');

        return response()->json([
            'message' => 'خروج با موفقیت انجام شد.',
        ])->withCookie($cookie);
    }

    /**
     * Create an httpOnly cookie for the authentication token.
     */
    protected function createAuthCookie(string $token)
    {
        return cookie(
            name: 'crm_token',
            value: $token,
            minutes: 60 * 24 * 7,
            path: '/',
            domain: null,
            secure: request()->isSecure() || str_starts_with((string) config('app.url'), 'https://'),
            httpOnly: true,
            raw: false,
            sameSite: 'Lax'
        );
    }
}

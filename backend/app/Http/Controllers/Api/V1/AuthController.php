<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Sms\MelipayamakService;
use App\Support\SessionManager;
use App\Support\SystemFeatures;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public const MAX_OTP_ATTEMPTS = 5;

    public function __construct(
        protected MelipayamakService $melipayamakService,
        protected SessionManager $sessionManager,
    ) {
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

        if ($user->isCustomerPortalUser() && !SystemFeatures::isEnabled('customer_portal')) {
            return response()->json([
                'code' => 'FEATURE_DISABLED',
                'feature' => 'customer_portal',
                'message' => 'پنل اختصاصی مشتریان در حال حاضر توسط مدیر ارشد سامانه غیرفعال شده است.',
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

        if (empty($smsResult['success']) || !empty($smsResult['is_sandbox'])) {
            Cache::forget('otp_' . $phone);
            Cache::forget('otp_attempts_' . $phone);
            Cache::forget($cooldownKey);

            return response()->json([
                'message' => 'ارسال پیامک کد تأیید در حال حاضر امکان‌پذیر نیست (درگاه پیامک تنظیم نشده یا در حالت شبیه‌ساز قرار دارد). لطفاً با رمز عبور وارد شوید یا با مدیر سامانه تماس بگیرید.',
            ], 503);
        }

        return response()->json([
            'message' => 'کد تأیید ورود با موفقیت به شماره شما پیامک شد.',
            'expires_in' => 120,
        ]);
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
        $attemptsKey = 'otp_attempts_' . $phone;
        $otpKey = 'otp_' . $phone;

        $attempts = (int) Cache::get($attemptsKey, 0);
        if ($attempts >= self::MAX_OTP_ATTEMPTS) {
            Cache::forget($otpKey);
            throw ValidationException::withMessages([
                'code' => ['تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً کد جدید دریافت کنید.'],
            ]);
        }

        $cachedCode = Cache::get($otpKey);

        if (!$cachedCode || !hash_equals((string) $cachedCode, $code)) {
            $newAttempts = $attempts + 1;
            Cache::put($attemptsKey, $newAttempts, now()->addMinutes(2));
            if ($newAttempts >= self::MAX_OTP_ATTEMPTS) {
                Cache::forget($otpKey);
            }
            throw ValidationException::withMessages([
                'code' => ['کد تأیید وارد شده نامعتبر است یا منقضی گردیده است.'],
            ]);
        }

        Cache::forget($otpKey);
        Cache::forget($attemptsKey);
        Cache::forget('otp_cooldown_' . $phone);

        $user = User::where('phone', $phone)->firstOrFail();

        if (!$user->is_active) {
            return response()->json([
                'message' => 'حساب کاربری شما غیرفعال شده است.',
            ], 403);
        }

        if ($user->isCustomerPortalUser()) {
            if (!SystemFeatures::isEnabled('customer_portal')) {
                return response()->json([
                    'code' => 'FEATURE_DISABLED',
                    'feature' => 'customer_portal',
                    'message' => 'پنل اختصاصی مشتریان در حال حاضر توسط مدیر ارشد سامانه غیرفعال شده است.',
                ], 403);
            }

            if (!$user->customer || !$user->customer->portal_enabled) {
                return response()->json([
                    'message' => 'دسترسی پنل کاربری شما غیرفعال شده است. لطفاً با مسئول فروش خود تماس بگیرید.',
                ], 403);
            }
        }

        if ($this->sessionManager->hasReachedSessionLimit($user)) {
            return response()->json(
                $this->sessionManager->createSessionLimitChallenge($user),
                409
            );
        }

        $token = $this->sessionManager->issueToken($user, $request)->plainTextToken;
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
        if (!$request->filled('login') && $request->filled('email')) {
            $request->merge(['login' => $request->input('email')]);
        }

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

        if ($user->isCustomerPortalUser()) {
            if (!SystemFeatures::isEnabled('customer_portal')) {
                return response()->json([
                    'code' => 'FEATURE_DISABLED',
                    'feature' => 'customer_portal',
                    'message' => 'پنل اختصاصی مشتریان در حال حاضر توسط مدیر ارشد سامانه غیرفعال شده است.',
                ], 403);
            }

            if (!$user->customer || !$user->customer->portal_enabled) {
                return response()->json([
                    'message' => 'دسترسی پنل کاربری شما غیرفعال شده است. لطفاً با مسئول فروش خود تماس بگیرید.',
                ], 403);
            }
        }

        if ($this->sessionManager->hasReachedSessionLimit($user)) {
            return response()->json(
                $this->sessionManager->createSessionLimitChallenge($user),
                409
            );
        }

        $token = $this->sessionManager->issueToken($user, $request)->plainTextToken;
        $cookie = $this->createAuthCookie($token);

        return response()->json([
            'user' => $user->serializeForApi(),
            'token' => $token,
        ])->withCookie($cookie);
    }

    /**
     * Resolve a max-concurrent-devices (3 devices) login challenge by revoking one or more prior sessions.
     */
    public function resolveSessionLimit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'challenge_token' => 'required|string|min:16|max:128',
            'revoke_token_id' => 'nullable|integer|min:1',
            'revoke_token_ids' => 'nullable|array|min:1',
            'revoke_token_ids.*' => 'integer|min:1',
        ], [
            'challenge_token.required' => 'توکن تأیید نشست نامعتبر است. لطفاً مجدداً وارد شوید.',
        ]);

        $tokenIds = [];
        if (!empty($validated['revoke_token_id'])) {
            $tokenIds[] = (int) $validated['revoke_token_id'];
        }
        if (!empty($validated['revoke_token_ids'])) {
            foreach ($validated['revoke_token_ids'] as $tid) {
                $tokenIds[] = (int) $tid;
            }
        }
        $tokenIds = array_values(array_unique(array_filter($tokenIds)));

        if (empty($tokenIds)) {
            return response()->json([
                'message' => 'لطفاً حداقل یک دستگاه را برای خروج انتخاب کنید.',
            ], 422);
        }

        $challengeToken = $validated['challenge_token'];
        $userId = $this->sessionManager->getChallengeUserId($challengeToken);
        if (!$userId) {
            return response()->json([
                'code' => 'CHALLENGE_EXPIRED',
                'message' => 'مهلت انتخاب دستگاه به پایان رسیده است. لطفاً مجدداً اطلاعات ورود را وارد کنید.',
            ], 410);
        }

        $user = User::find($userId);
        if (!$user || !$user->is_active) {
            $this->sessionManager->consumeChallenge($challengeToken);

            return response()->json([
                'message' => 'حساب کاربری معتبر یا فعال نیست.',
            ], 403);
        }

        if ($user->isCustomerPortalUser()) {
            if (!SystemFeatures::isEnabled('customer_portal') || !$user->customer || !$user->customer->portal_enabled) {
                $this->sessionManager->consumeChallenge($challengeToken);

                return response()->json([
                    'message' => 'دسترسی پنل کاربری شما غیرفعال شده است.',
                ], 403);
            }
        }

        $deleted = $user->tokens()->whereIn('id', $tokenIds)->delete();
        if ($deleted === 0) {
            return response()->json([
                'message' => 'نشست انتخاب‌شده یافت نشد یا قبلاً منقضی شده است.',
                'sessions' => $this->sessionManager->listUserSessions($user),
            ], 422);
        }

        // If user somehow still has >= MAX_ACTIVE_SESSIONS (e.g. >3 legacy tokens), keep challenge alive
        if ($this->sessionManager->hasReachedSessionLimit($user)) {
            return response()->json([
                'code' => 'MAX_SESSIONS_REACHED',
                'message' => 'نشست انتخاب‌شده حذف شد، اما همچنان تعداد نشست‌های فعال به حد مجاز رسیده است. لطفاً یک دستگاه دیگر را خارج کنید.',
                'max_sessions' => SessionManager::MAX_ACTIVE_SESSIONS,
                'challenge_token' => $challengeToken,
                'sessions' => $this->sessionManager->listUserSessions($user),
            ], 409);
        }

        $this->sessionManager->consumeChallenge($challengeToken);
        $token = $this->sessionManager->issueToken($user, $request)->plainTextToken;
        $cookie = $this->createAuthCookie($token);

        return response()->json([
            'message' => 'دستگاه انتخاب‌شده با موفقیت خارج شد و ورود شما انجام گردید.',
            'user' => $user->serializeForApi(),
            'token' => $token,
        ])->withCookie($cookie);
    }

    /**
     * List active sessions for the currently authenticated user.
     */
    public function mySessions(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof PersonalAccessToken ? (int) $currentToken->id : null;

        return response()->json([
            'max_sessions' => SessionManager::MAX_ACTIVE_SESSIONS,
            'sessions' => $this->sessionManager->listUserSessions($user, $currentTokenId),
        ]);
    }

    /**
     * Revoke one of the authenticated user's own sessions.
     */
    public function revokeMySession(Request $request, int $tokenId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentTokenId = $currentToken instanceof PersonalAccessToken ? (int) $currentToken->id : null;

        $target = $user->tokens()->where('id', $tokenId)->first();
        if (!$target) {
            return response()->json([
                'message' => 'نشست مورد نظر یافت نشد.',
            ], 404);
        }

        $isCurrent = $currentTokenId !== null && (int) $target->id === $currentTokenId;
        $target->delete();

        $response = response()->json([
            'message' => $isCurrent
                ? 'نشست فعلی شما خاتمه یافت.'
                : 'نشست دستگاه انتخاب‌شده با موفقیت حذف گردید.',
            'revoked_current' => $isCurrent,
        ]);

        return $isCurrent ? $response->withCookie(cookie()->forget('crm_token', '/')) : $response;
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
            'name' => 'sometimes|required|string|max:100',
            'phone' => 'nullable|string|regex:/^09\d{9}$/|unique:users,phone,' . $user->id,
            'current_password' => 'required_with:password|nullable|string',
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            'avatar' => 'nullable|image|max:3072',
        ], [
            'name.required' => 'وارد کردن نام و نام خانوادگی الزامی است.',
            'phone.regex' => 'فرمت شماره موبایل نامعتبر است (باید ۱۱ رقم عددی بوده و با 09 شروع شود).',
            'phone.unique' => 'این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است.',
            'current_password.required_with' => 'برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است.',
            'password.min' => 'کلمه عبور باید حداقل ۸ کاراکتر باشد.',
            'password.regex' => 'کلمه عبور باید حداقل شامل یک حرف انگلیسی و یک عدد باشد.',
            'avatar.image' => 'فایل انتخابی باید تصویر باشد.',
            'avatar.max' => 'حداکثر حجم تصویر مجاز ۳ مگابایت است.',
        ]);

        if (!empty($validated['password'])) {
            $rawCurrent = (string) ($validated['current_password'] ?? '');
            $normCurrent = (string) $this->normalizeDigits($rawCurrent);
            $currentMatches = $rawCurrent !== '' && (
                Hash::check($rawCurrent, $user->password) ||
                ($normCurrent !== $rawCurrent && Hash::check($normCurrent, $user->password))
            );

            if (!$currentMatches) {
                throw ValidationException::withMessages([
                    'current_password' => ['رمز عبور فعلی صحیح نمی‌باشد.'],
                ]);
            }
        }

        if (array_key_exists('name', $validated)) {
            $user->name = $validated['name'];
        }
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        $passwordChanged = !empty($validated['password']);
        if ($passwordChanged) {
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

        // Force logout from ALL devices (including current) whenever password changes
        if ($passwordChanged) {
            $this->sessionManager->revokeAllSessions($user);

            return response()->json([
                'message' => 'رمز عبور با موفقیت تغییر یافت. برای امنیت بیشتر از همه دستگاه‌ها خارج شدید؛ لطفاً مجدداً وارد شوید.',
                'force_logout' => true,
                'user' => $user->fresh()->serializeForApi(),
            ])->withCookie(cookie()->forget('crm_token', '/'));
        }

        return response()->json([
            'message' => 'پروفایل شما با موفقیت بروزرسانی شد.',
            'force_logout' => false,
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
            secure: request()->isSecure(),
            httpOnly: true,
            raw: false,
            sameSite: 'Lax'
        );
    }
}

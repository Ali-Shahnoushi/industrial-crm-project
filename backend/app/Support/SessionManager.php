<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\NewAccessToken;
use Laravel\Sanctum\PersonalAccessToken;

class SessionManager
{
    public const MAX_ACTIVE_SESSIONS = 3;
    public const CHALLENGE_TTL_MINUTES = 5;

    /**
     * Prune expired / stale (>30 days) tokens for the user.
     */
    public function pruneStaleTokens(User $user): void
    {
        $user->tokens()
            ->where(function ($q) {
                $q->where('created_at', '<', now()->subDays(30))
                    ->orWhere(function ($exp) {
                        $exp->whereNotNull('expires_at')
                            ->where('expires_at', '<=', now());
                    });
            })
            ->delete();
    }

    /**
     * Query for currently active tokens of a user.
     */
    public function activeTokensQuery(User $user): MorphMany
    {
        return $user->tokens()->where(function ($q) {
            $q->whereNull('expires_at')
                ->orWhere('expires_at', '>', now());
        });
    }

    /**
     * Count active sessions for a user after pruning stale ones.
     */
    public function activeSessionCount(User $user): int
    {
        $this->pruneStaleTokens($user);

        return $this->activeTokensQuery($user)->count();
    }

    /**
     * Check whether the user has reached or exceeded the maximum concurrent device limit.
     */
    public function hasReachedSessionLimit(User $user): bool
    {
        return $this->activeSessionCount($user) >= self::MAX_ACTIVE_SESSIONS;
    }

    /**
     * Issue a new Sanctum personal access token with device/IP metadata attached.
     */
    public function issueToken(User $user, Request $request, string $tokenName = 'api-token'): NewAccessToken
    {
        $newToken = $user->createToken($tokenName);
        $ua = (string) ($request->userAgent() ?? '');
        $parsed = self::parseUserAgent($ua);

        $accessToken = $newToken->accessToken;
        if ($accessToken instanceof PersonalAccessToken && Schema::hasColumn('personal_access_tokens', 'ip_address')) {
            $accessToken->forceFill([
                'ip_address' => $request->ip(),
                'user_agent' => $ua !== '' ? mb_substr($ua, 0, 1000) : null,
                'device_name' => $parsed['device_name'],
                'browser' => $parsed['browser'],
                'platform' => $parsed['platform'],
            ])->save();
        }

        return $newToken;
    }

    /**
     * List formatted active sessions for a user.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listUserSessions(User $user, ?int $currentTokenId = null): array
    {
        $this->pruneStaleTokens($user);

        return $this->activeTokensQuery($user)
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (PersonalAccessToken $token) => self::formatToken($token, $currentTokenId))
            ->values()
            ->all();
    }

    /**
     * Create a short-lived login session-limit challenge stored in cache.
     *
     * @return array<string, mixed>
     */
    public function createSessionLimitChallenge(User $user): array
    {
        $challengeToken = bin2hex(random_bytes(32));

        Cache::put(
            $this->challengeCacheKey($challengeToken),
            ['user_id' => (int) $user->id],
            now()->addMinutes(self::CHALLENGE_TTL_MINUTES)
        );

        return [
            'code' => 'MAX_SESSIONS_REACHED',
            'message' => 'شما هم‌اکنون روی حداکثر ۳ دستگاه وارد شده‌اید. برای ورود در این دستگاه، ابتدا یکی از نشست‌های فعال زیر را خارج کنید.',
            'max_sessions' => self::MAX_ACTIVE_SESSIONS,
            'challenge_token' => $challengeToken,
            'sessions' => $this->listUserSessions($user),
        ];
    }

    /**
     * Retrieve the user ID associated with a login session-limit challenge token.
     */
    public function getChallengeUserId(string $challengeToken): ?int
    {
        $payload = Cache::get($this->challengeCacheKey($challengeToken));
        if (!is_array($payload) || empty($payload['user_id'])) {
            return null;
        }

        return (int) $payload['user_id'];
    }

    /**
     * Consume (delete) a login session-limit challenge token.
     */
    public function consumeChallenge(string $challengeToken): void
    {
        Cache::forget($this->challengeCacheKey($challengeToken));
    }

    /**
     * Revoke all sessions (tokens) for a user.
     */
    public function revokeAllSessions(User $user): int
    {
        return (int) $user->tokens()->delete();
    }

    protected function challengeCacheKey(string $token): string
    {
        return 'session_limit_challenge:' . hash('sha256', $token);
    }

    /**
     * Format a PersonalAccessToken into an API-friendly session summary.
     *
     * @return array<string, mixed>
     */
    public static function formatToken(PersonalAccessToken $token, ?int $currentTokenId = null): array
    {
        $ua = (string) ($token->getAttribute('user_agent') ?? '');
        $fallback = $ua !== '' ? self::parseUserAgent($ua) : null;

        $browser = $token->getAttribute('browser') ?: ($fallback['browser'] ?? 'نامشخص');
        $platform = $token->getAttribute('platform') ?: ($fallback['platform'] ?? 'نامشخص');
        $deviceName = $token->getAttribute('device_name') ?: ($fallback['device_name'] ?? 'دستگاه ناشناس');

        return [
            'id' => (int) $token->id,
            'name' => $token->name,
            'device_name' => $deviceName,
            'browser' => $browser,
            'platform' => $platform,
            'ip_address' => $token->getAttribute('ip_address'),
            'user_agent' => $ua !== '' ? $ua : null,
            'is_current' => $currentTokenId !== null && (int) $token->id === $currentTokenId,
            'last_used_at' => $token->last_used_at?->toIso8601String(),
            'created_at' => $token->created_at?->toIso8601String(),
        ];
    }

    /**
     * Parse browser, OS platform, and friendly Persian device label from User-Agent.
     *
     * @return array{browser: string, platform: string, device_name: string}
     */
    public static function parseUserAgent(?string $userAgent): array
    {
        $ua = trim((string) $userAgent);
        if ($ua === '') {
            return [
                'browser' => 'مرورگر وب',
                'platform' => 'نامشخص',
                'device_name' => 'دستگاه ناشناس',
            ];
        }

        $browser = 'مرورگر وب';
        if (stripos($ua, 'Edg/') !== false || stripos($ua, 'Edge/') !== false) {
            $browser = 'Microsoft Edge';
        } elseif (stripos($ua, 'OPR/') !== false || stripos($ua, 'Opera') !== false) {
            $browser = 'Opera';
        } elseif (stripos($ua, 'Firefox/') !== false) {
            $browser = 'Firefox';
        } elseif (stripos($ua, 'Chrome/') !== false && stripos($ua, 'Chromium') === false) {
            $browser = 'Chrome';
        } elseif (stripos($ua, 'Safari/') !== false && stripos($ua, 'Chrome/') === false) {
            $browser = 'Safari';
        } elseif (stripos($ua, 'Postman') !== false) {
            $browser = 'Postman';
        } elseif (stripos($ua, 'curl/') !== false) {
            $browser = 'cURL';
        } elseif (stripos($ua, 'Symfony') !== false) {
            $browser = 'تست / کلاینت API';
        }

        $platform = 'نامشخص';
        if (stripos($ua, 'iPhone') !== false) {
            $platform = 'iPhone (iOS)';
        } elseif (stripos($ua, 'iPad') !== false) {
            $platform = 'iPad (iPadOS)';
        } elseif (stripos($ua, 'Android') !== false) {
            $platform = 'Android';
        } elseif (stripos($ua, 'Windows') !== false) {
            $platform = 'Windows';
        } elseif (stripos($ua, 'Macintosh') !== false || stripos($ua, 'Mac OS X') !== false) {
            $platform = 'macOS';
        } elseif (stripos($ua, 'Linux') !== false) {
            $platform = 'Linux';
        }

        $deviceName = $platform !== 'نامشخص'
            ? "{$browser} روی {$platform}"
            : $browser;

        return [
            'browser' => $browser,
            'platform' => $platform,
            'device_name' => $deviceName,
        ];
    }
}

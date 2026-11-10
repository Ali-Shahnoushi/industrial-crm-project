<?php

namespace Tests\Feature;

use App\Models\SmsLog;
use App\Models\User;
use App\Services\Sms\MelipayamakService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthOtpAndSessionSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_otp_response_never_discloses_code_on_real_delivery(): void
    {
        User::create([
            'name' => 'OTP Staff',
            'email' => 'otp-staff@crm.local',
            'phone' => '09123456789',
            'password' => Hash::make('Staff@12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);

        $this->mock(MelipayamakService::class)
            ->shouldReceive('sendNormalSms')
            ->once()
            ->andReturn(['success' => true, 'message_id' => '987654', 'status' => 'OK', 'is_sandbox' => false]);

        $response = $this->postJson('/api/v1/auth/otp/send', ['phone' => '۰۹۱۲۳۴۵۶۷۸۹'])
            ->assertOk()
            ->assertJsonMissingPath('sandbox_code');

        $cachedCode = Cache::get('otp_09123456789');
        $this->assertNotEmpty($cachedCode);
        $this->assertStringNotContainsString((string) $cachedCode, $response->getContent());
    }

    public function test_sandbox_or_failed_otp_returns_503_and_clears_cached_code(): void
    {
        User::create([
            'name' => 'Sandbox Staff',
            'email' => 'sandbox-staff@crm.local',
            'phone' => '09127778899',
            'password' => Hash::make('Staff@12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);

        $this->mock(MelipayamakService::class)
            ->shouldReceive('sendNormalSms')
            ->once()
            ->andReturn(['success' => true, 'message_id' => 'SANDBOX-1', 'status' => 'Sandbox', 'is_sandbox' => true]);

        $this->postJson('/api/v1/auth/otp/send', ['phone' => '09127778899'])
            ->assertStatus(503)
            ->assertJsonMissingPath('sandbox_code');

        $this->assertNull(Cache::get('otp_09127778899'));
    }

    public function test_otp_locks_out_after_five_failed_attempts(): void
    {
        User::create([
            'name' => 'Brute Force Target',
            'email' => 'bf@crm.local',
            'phone' => '09125554433',
            'password' => Hash::make('Staff@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);

        Cache::put('otp_09125554433', '54321', now()->addMinutes(2));
        Cache::put('otp_attempts_09125554433', 0, now()->addMinutes(2));

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/otp/verify', [
                'phone' => '09125554433',
                'code' => '00000',
            ])->assertStatus(422);
        }

        // 6th attempt even with the right code must fail because the OTP was invalidated
        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '09125554433',
            'code' => '54321',
        ])->assertStatus(422);

        $this->assertNull(Cache::get('otp_09125554433'));
    }

    public function test_sms_logs_redact_otp_codes(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        SmsLog::create([
            'recipient_mobile' => '09123456789',
            'pattern_code' => 'NORMAL-OTP',
            'tokens' => ['text' => 'کد ورود شما: 84920'],
            'status' => 'sent',
        ]);

        Sanctum::actingAs($admin);
        $body = $this->getJson('/api/v1/sms/logs')->assertOk()->getContent();
        $this->assertStringNotContainsString('84920', $body);
    }

    public function test_deactivated_user_token_is_immediately_rejected_and_tokens_revoked(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $staff = User::create([
            'name' => 'Active Staff',
            'email' => 'active-staff@crm.local',
            'password' => Hash::make('Staff@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);

        $plainToken = $staff->createToken('api-token')->plainTextToken;
        $this->assertSame(1, $staff->tokens()->count());

        // Admin toggles staff inactive -> existing tokens must be deleted
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/users/{$staff->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('is_active', false);

        $this->assertSame(0, $staff->tokens()->count());

        // Even if a token exists on an inactive account, EnsureActiveUser middleware rejects with 401
        \Illuminate\Support\Facades\Auth::forgetGuards();
        $newToken = $staff->fresh()->createToken('leaked')->plainTextToken;
        $this->withHeader('Authorization', 'Bearer ' . $newToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_password_change_revokes_previous_tokens(): void
    {
        $staff = User::create([
            'name' => 'Password Staff',
            'email' => 'pwd-staff@crm.local',
            'password' => Hash::make('OldPass123'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);

        $staff->createToken('old-device-1');
        $staff->createToken('old-device-2');
        $this->assertSame(2, $staff->tokens()->count());

        Sanctum::actingAs($staff);

        // Omitting current_password must be rejected with 422
        $this->putJson('/api/v1/auth/me', [
            'name' => 'Password Staff',
            'password' => 'NewPass456',
        ])->assertStatus(422);

        // Wrong current_password must be rejected with 422
        $this->putJson('/api/v1/auth/me', [
            'name' => 'Password Staff',
            'current_password' => 'WrongPass999',
            'password' => 'NewPass456',
        ])->assertStatus(422);

        // Valid current_password succeeds and revokes previous tokens
        $this->putJson('/api/v1/auth/me', [
            'name' => 'Password Staff',
            'current_password' => 'OldPass123',
            'password' => 'NewPass456',
        ])->assertOk();

        $this->assertSame(0, $staff->tokens()->count());
        $this->assertTrue(Hash::check('NewPass456', $staff->fresh()->password));
    }
}

<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Part;
use App\Models\Sale;
use App\Models\Ticket;
use App\Models\User;
use App\Support\SystemFeatures;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SessionsFeaturesAndSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SystemFeatures::forgetCache();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_max_three_devices_enforced_and_challenge_resolves_cleanly(): void
    {
        $user = User::create([
            'name' => 'Multi Device Staff',
            'email' => 'devices@crm.local',
            'phone' => '09121112233',
            'password' => Hash::make('Device@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);

        // Login from 3 different devices -> all succeed
        $tokens = [];
        $userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
        ];

        foreach ($userAgents as $ua) {
            $res = $this->withHeader('User-Agent', $ua)
                ->postJson('/api/v1/auth/login', [
                    'login' => 'devices@crm.local',
                    'password' => 'Device@12345',
                ])
                ->assertOk();

            $tokens[] = $res->json('token');
        }

        $this->assertSame(3, $user->tokens()->count());

        // 4th login must return 409 MAX_SESSIONS_REACHED with challenge_token & 3 sessions
        $fourthRes = $this->withHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/127.0.0.0 Safari/537.36')
            ->postJson('/api/v1/auth/login', [
                'login' => 'devices@crm.local',
                'password' => 'Device@12345',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'MAX_SESSIONS_REACHED')
            ->assertJsonPath('max_sessions', 3)
            ->assertJsonCount(3, 'sessions');

        $challengeToken = $fourthRes->json('challenge_token');
        $sessions = $fourthRes->json('sessions');
        $this->assertNotEmpty($challengeToken);
        $this->assertSame(3, $user->tokens()->count());

        // IDOR check: trying to revoke another user's token must be rejected
        $otherAdmin = User::where('email', 'admin@crm.local')->firstOrFail();
        $otherTokenId = $otherAdmin->createToken('admin-device')->accessToken->id;

        $this->postJson('/api/v1/auth/sessions/resolve', [
            'challenge_token' => $challengeToken,
            'revoke_token_id' => $otherTokenId,
        ])->assertStatus(422);
        $this->assertSame(1, $otherAdmin->tokens()->count());

        // Revoke the first listed session and complete login on the 4th device
        $revokedId = $sessions[0]['id'];
        $resolvedRes = $this->withHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/127.0.0.0 Safari/537.36')
            ->postJson('/api/v1/auth/sessions/resolve', [
                'challenge_token' => $challengeToken,
                'revoke_token_id' => $revokedId,
            ])
            ->assertOk()
            ->assertJsonStructure(['message', 'user', 'token']);

        $newToken = $resolvedRes->json('token');
        $this->assertSame(3, $user->tokens()->count());
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $revokedId]);

        // Replaying consumed challenge token must fail with 410
        $this->postJson('/api/v1/auth/sessions/resolve', [
            'challenge_token' => $challengeToken,
            'revoke_token_id' => $sessions[1]['id'],
        ])->assertStatus(410);

        // New device token works on /auth/me
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $newToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'devices@crm.local');
    }

    public function test_admin_and_users_sessions_acl_can_list_and_force_logout_sessions(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $sales = User::create([
            'name' => 'Sales Rep',
            'email' => 'rep-sess@crm.local',
            'password' => Hash::make('Rep@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);
        $sales->syncPermissions(['customers.view']);

        $t1 = $sales->createToken('dev-1');
        $t2 = $sales->createToken('dev-2');

        // Salesperson without users.sessions cannot view or revoke sessions
        Sanctum::actingAs($sales);
        $this->getJson("/api/v1/users/{$sales->id}/sessions")->assertStatus(403);
        $this->deleteJson("/api/v1/users/{$sales->id}/sessions/{$t1->accessToken->id}")->assertStatus(403);

        // Manager with users.sessions can manage salesperson sessions, NOT admin sessions
        $manager = User::create([
            'name' => 'Session Manager',
            'email' => 'sess-mgr@crm.local',
            'password' => Hash::make('Mgr@12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);
        $manager->syncPermissions(['users.sessions']);

        Sanctum::actingAs($manager);
        $this->getJson('/api/v1/users')->assertOk();
        $this->getJson("/api/v1/users/{$admin->id}/sessions")->assertStatus(403);
        $this->getJson("/api/v1/users/{$sales->id}/sessions")
            ->assertOk()
            ->assertJsonCount(2, 'sessions');

        // Force-logout single session
        $this->deleteJson("/api/v1/users/{$sales->id}/sessions/{$t1->accessToken->id}")
            ->assertOk()
            ->assertJsonPath('active_sessions_count', 1);

        // Old token 1 is immediately rejected
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $t1->plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // Token 2 still works until revoked all
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $t2->plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        // Admin revokes all remaining sessions for sales
        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/users/{$sales->id}/sessions")
            ->assertOk()
            ->assertJsonPath('revoked_count', 1);

        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $t2->plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_permission_or_password_change_forces_logout_all_devices(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $staff = User::create([
            'name' => 'Perm Target',
            'email' => 'perm-target@crm.local',
            'password' => Hash::make('Target@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);
        $staff->syncPermissions(['customers.view', 'customers.create']);

        $tokenA = $staff->createToken('device-a')->plainTextToken;
        $tokenB = $staff->createToken('device-b')->plainTextToken;
        $this->assertSame(2, $staff->tokens()->count());

        // Updating name only (no permission/password change) keeps sessions intact
        Sanctum::actingAs($admin);
        $this->putJson("/api/v1/users/{$staff->id}", [
            'name' => 'Perm Target Renamed',
        ])->assertOk()->assertJsonPath('force_logged_out', false);
        $this->assertSame(2, $staff->tokens()->count());

        // Changing permissions via /users/{user}/permissions forces logout all devices
        $this->putJson("/api/v1/users/{$staff->id}/permissions", [
            'permissions' => ['customers.view'],
        ])->assertOk()->assertJsonPath('force_logged_out', true);

        $this->assertSame(0, $staff->tokens()->count());

        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $tokenA)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
        $this->withHeader('Authorization', 'Bearer ' . $tokenB)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // Self password change also revokes ALL sessions (including current) and returns force_logout: true
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'login' => 'perm-target@crm.local',
            'password' => 'Target@12345',
        ])->assertOk();
        $selfToken = $loginRes->json('token');

        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $selfToken)
            ->putJson('/api/v1/auth/me', [
                'current_password' => 'Target@12345',
                'password' => 'NewSecret@999',
            ])
            ->assertOk()
            ->assertJsonPath('force_logout', true);

        $this->assertSame(0, $staff->fresh()->tokens()->count());
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $selfToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_administrator_only_system_feature_toggles_block_everyone_when_disabled(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $manager = User::create([
            'name' => 'Settings Manager',
            'email' => 'settings-mgr@crm.local',
            'password' => Hash::make('Mgr@12345'),
            'user_type' => User::ROLE_MANAGER,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => true,
        ]);
        $manager->syncPermissions(['settings.manage', 'sales.view']);

        // Manager cannot view or modify system feature toggles
        Sanctum::actingAs($manager);
        $this->getJson('/api/v1/settings/features')->assertStatus(403);
        $this->putJson('/api/v1/settings/features', ['features' => ['sales' => false]])->assertStatus(403);

        // Administrator disables sales & otp_login
        Sanctum::actingAs($admin);
        $this->putJson('/api/v1/settings/features', [
            'features' => [
                'sales' => false,
                'otp_login' => false,
            ],
        ])
            ->assertOk()
            ->assertJsonPath('features.sales', false)
            ->assertJsonPath('features.otp_login', false);

        // Public company settings exposes synced version and feature states
        $this->getJson('/api/v1/settings/company')
            ->assertOk()
            ->assertJsonPath('app_version', config('app.version'))
            ->assertJsonPath('features.sales', false)
            ->assertJsonPath('features.otp_login', false);

        // Even Administrator is blocked from disabled modules until re-enabled
        $this->getJson('/api/v1/sales')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FEATURE_DISABLED')
            ->assertJsonPath('feature', 'sales');

        $this->postJson('/api/v1/auth/otp/send', ['phone' => '09120000000'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'FEATURE_DISABLED')
            ->assertJsonPath('feature', 'otp_login');

        // Re-enabling immediately restores access
        $this->putJson('/api/v1/settings/features', [
            'features' => [
                'sales' => true,
                'otp_login' => true,
            ],
        ])->assertOk();

        $this->getJson('/api/v1/sales')->assertOk();
    }

    public function test_deleting_user_preserves_all_business_data_they_created(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();

        $staff = User::create([
            'name' => 'Departing Staff',
            'email' => 'departing@crm.local',
            'password' => Hash::make('Staff@12345'),
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
            'is_active' => true,
        ]);

        $customer = Customer::create([
            'created_by_user_id' => $staff->id,
            'sales_manager_user_id' => $staff->id,
            'customer_type' => 'effective',
            'type' => 'individual',
            'first_name' => 'مشتری',
            'last_name' => 'حفظ‌شده',
            'mobile' => '09129991122',
        ]);

        $part = Part::create([
            'name' => 'دستگاه تست',
            'code' => 'TST-900',
            'periodic_service_months' => 6,
            'stock_quantity' => 5,
            'unit_price' => 1000000,
            'is_active' => true,
        ]);

        $sale = Sale::create([
            'customer_id' => $customer->id,
            'user_id' => $staff->id,
            'sale_date' => now()->toDateString(),
            'status' => Sale::STATUS_CONFIRMED,
            'payment_status' => 'paid',
            'subtotal' => 1000000,
            'total' => 1000000,
            'paid_amount' => 1000000,
        ]);

        $ticket = Ticket::create([
            'tracking_code' => 'TKT-KEEP-001',
            'customer_id' => $customer->id,
            'created_by_user_id' => $staff->id,
            'assigned_to_user_id' => $staff->id,
            'ticket_type' => 'general',
            'priority' => 'medium',
            'status' => 'open',
            'subject' => 'تیکت مهم نباید حذف شود',
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/users/{$staff->id}")->assertOk();

        // User is removed, but customer, sale, and ticket are 100% preserved
        $this->assertDatabaseMissing('users', ['id' => $staff->id]);
        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'created_by_user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('sales', ['id' => $sale->id]);
        $this->assertDatabaseHas('tickets', ['id' => $ticket->id]);
        $this->assertDatabaseHas('parts', ['id' => $part->id]);
    }

    public function test_changelog_endpoint_returns_parsed_version_timeline_with_jalali_dates(): void
    {
        $res = $this->getJson('/api/v1/settings/changelog')
            ->assertOk()
            ->assertJsonPath('current_version', config('app.version'));

        $releases = $res->json('releases');
        $this->assertIsArray($releases);
        $this->assertNotEmpty($releases);
        $this->assertSame('2.5.0', $releases[0]['version']);
        $this->assertSame('۱۴۰۵/۰۹/۰۴', $releases[0]['jalali_date']);
        $this->assertTrue($releases[0]['is_current']);
        $this->assertNotEmpty($releases[0]['sections']);
    }
}

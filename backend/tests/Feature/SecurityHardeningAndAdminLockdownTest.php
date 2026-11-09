<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SecurityHardeningAndAdminLockdownTest extends TestCase
{
    use RefreshDatabase;

    public function test_filament_admin_and_livewire_surfaces_are_completely_removed_and_blocked(): void
    {
        foreach (['/admin', '/admin/login', '/admin/users', '/livewire/update', '/livewire/livewire.js', '/filament/exports'] as $blockedUri) {
            $this->get($blockedUri)->assertNotFound();
            $this->post($blockedUri)->assertNotFound();
        }

        // Even an authenticated super-administrator must get 404 on /admin* and /livewire*
        foreach (User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_ADMINISTRATOR] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }
        $admin = User::create([
            'name' => 'مدیر ارشد',
            'email' => 'sec-admin@example.test',
            'password' => Hash::make('StrongAdmin1234'),
            'is_active' => true,
            'user_type' => User::ROLE_ADMINISTRATOR,
            'customer_scope' => User::SCOPE_ALL,
        ]);
        $admin->syncPermissions(Permission::all());

        $this->actingAs($admin, 'sanctum')->get('/admin')->assertNotFound();
        $this->actingAs($admin, 'sanctum')->get('/admin/login')->assertNotFound();

        // Ensure no Filament /admin panel routes are registered in the router
        foreach (Route::getRoutes() as $route) {
            $uri = ltrim($route->uri(), '/');
            $this->assertFalse(
                str_starts_with($uri, 'admin/') || $uri === 'admin',
                "Unexpected /admin route still registered: {$uri}"
            );
        }
    }

    public function test_security_headers_are_attached_to_responses(): void
    {
        $res = $this->getJson('/api/v1/settings/company');
        $res->assertOk();
        $res->assertHeader('X-Frame-Options', 'DENY');
        $res->assertHeader('X-Content-Type-Options', 'nosniff');
        $res->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $res->assertHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }

    public function test_inactive_user_cannot_authenticate(): void
    {
        User::create([
            'name' => 'کاربر غیرفعال',
            'email' => 'disabled@example.test',
            'password' => Hash::make('DisabledPass123'),
            'is_active' => false,
            'user_type' => User::ROLE_SALESPERSON,
            'customer_scope' => User::SCOPE_OWN,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'login' => 'disabled@example.test',
            'password' => 'DisabledPass123',
        ])->assertForbidden();
    }
}

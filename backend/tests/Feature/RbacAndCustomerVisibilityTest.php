<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RbacAndCustomerVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function makeStaff(string $role, string $scope, array $permissions = []): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $perms = $permissions ?: (User::ROLE_DEFAULT_PERMISSIONS[$role] ?? []);
        foreach ($perms as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        $user = User::create([
            'name' => ucfirst($role) . ' User',
            'email' => uniqid($role . '_') . '@example.test',
            'password' => Hash::make('SecretPass123'),
            'is_active' => true,
            'user_type' => $role,
            'customer_scope' => $scope,
        ]);

        $user->syncRoles([$role]);
        $user->syncPermissions($perms);

        return $user;
    }

    public function test_salesperson_with_own_scope_only_sees_own_customers(): void
    {
        $salesA = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);
        $salesB = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);

        $custA = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'علی',
            'last_name' => 'رضایی',
            'created_by_user_id' => $salesA->id,
        ]);

        $custB = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'شرکت صنعتی کاوه',
            'created_by_user_id' => $salesB->id,
        ]);

        $res = $this->actingAs($salesA, 'sanctum')->getJson('/api/v1/customers');
        $res->assertOk();
        $ids = collect($res->json('data'))->pluck('id')->all();

        $this->assertContains($custA->id, $ids);
        $this->assertNotContains($custB->id, $ids);

        // Direct show/update on colleague's customer must return 403
        $this->actingAs($salesA, 'sanctum')
            ->getJson("/api/v1/customers/{$custB->id}")
            ->assertForbidden();

        $this->actingAs($salesA, 'sanctum')
            ->putJson("/api/v1/customers/{$custB->id}", ['type' => 'company', 'company_name' => 'هک'])
            ->assertForbidden();
    }

    public function test_selected_scope_grants_colleague_and_specific_customer_access(): void
    {
        $salesA = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_SELECTED);
        $salesB = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);
        $salesC = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);

        $custOwn = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'سعید',
            'last_name' => 'امینی',
            'created_by_user_id' => $salesA->id,
        ]);

        $custFromColleagueB = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'فولاد سپاهان',
            'created_by_user_id' => $salesB->id,
        ]);

        $custSpecificFromC = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'پتروشیمی پارس',
            'created_by_user_id' => $salesC->id,
        ]);

        $custHiddenFromC = Customer::create([
            'customer_type' => 'potential',
            'type' => 'company',
            'company_name' => 'محرمانه سی',
            'created_by_user_id' => $salesC->id,
        ]);

        // Grant salesA access to ALL of salesB's customers + ONLY custSpecificFromC
        $salesA->grantedStaff()->sync([$salesB->id]);
        $salesA->grantedCustomers()->sync([$custSpecificFromC->id]);

        $res = $this->actingAs($salesA, 'sanctum')->getJson('/api/v1/customers');
        $res->assertOk();
        $ids = collect($res->json('data'))->pluck('id')->all();

        $this->assertContains($custOwn->id, $ids);
        $this->assertContains($custFromColleagueB->id, $ids);
        $this->assertContains($custSpecificFromC->id, $ids);
        $this->assertNotContains($custHiddenFromC->id, $ids);

        $this->actingAs($salesA, 'sanctum')
            ->getJson("/api/v1/customers/{$custHiddenFromC->id}")
            ->assertForbidden();
    }

    public function test_installer_can_record_service_history_but_cannot_manage_users_or_delete_customers(): void
    {
        $installer = $this->makeStaff(User::ROLE_INSTALLER, User::SCOPE_ALL);
        $customer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'کارخانه سیمان شرق',
        ]);

        $this->actingAs($installer, 'sanctum')
            ->getJson('/api/v1/customers')
            ->assertOk();

        $this->actingAs($installer, 'sanctum')
            ->deleteJson("/api/v1/customers/{$customer->id}")
            ->assertForbidden();

        $this->actingAs($installer, 'sanctum')
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_manager_cannot_view_or_modify_administrator_account(): void
    {
        $admin = $this->makeStaff(User::ROLE_ADMINISTRATOR, User::SCOPE_ALL);
        $manager = $this->makeStaff(User::ROLE_MANAGER, User::SCOPE_ALL, array_merge(
            User::ROLE_DEFAULT_PERMISSIONS[User::ROLE_MANAGER],
            ['users.manage']
        ));

        $this->actingAs($manager, 'sanctum')
            ->getJson("/api/v1/users/{$admin->id}")
            ->assertForbidden();

        $this->actingAs($manager, 'sanctum')
            ->deleteJson("/api/v1/users/{$admin->id}")
            ->assertForbidden();
    }

    public function test_customers_can_be_filtered_and_searched_by_creator_with_scoped_creator_options(): void
    {
        $admin = $this->makeStaff(User::ROLE_ADMINISTRATOR, User::SCOPE_ALL);
        $salesA = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);
        $salesA->update(['name' => 'محمد کارشناس']);
        $salesB = $this->makeStaff(User::ROLE_SALESPERSON, User::SCOPE_OWN);
        $salesB->update(['name' => 'سهراب فروشنده']);

        $custA = Customer::create([
            'customer_type' => 'effective',
            'type' => 'individual',
            'first_name' => 'نیما',
            'last_name' => 'صادقی',
            'created_by_user_id' => $salesA->id,
        ]);

        $custB = Customer::create([
            'customer_type' => 'potential',
            'type' => 'individual',
            'first_name' => 'آرش',
            'last_name' => 'مرادی',
            'created_by_user_id' => $salesB->id,
        ]);

        // Filter by creator id
        $filterRes = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/customers?created_by_user_id={$salesA->id}")
            ->assertOk();
        $filterIds = collect($filterRes->json('data'))->pluck('id')->all();
        $this->assertSame([$custA->id], $filterIds);

        // Search by creator name via q
        $searchRes = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/customers?q=' . urlencode('محمد کارشناس'))
            ->assertOk();
        $searchIds = collect($searchRes->json('data'))->pluck('id')->all();
        $this->assertContains($custA->id, $searchIds);
        $this->assertNotContains($custB->id, $searchIds);

        // Creator options respect scope: admin sees both, salesA (SCOPE_OWN) sees only salesA
        $adminOpts = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/customers-creator-options')
            ->assertOk();
        $adminOptIds = collect($adminOpts->json('data'))->pluck('id')->all();
        $this->assertContains($salesA->id, $adminOptIds);
        $this->assertContains($salesB->id, $adminOptIds);

        $salesAOpts = $this->actingAs($salesA, 'sanctum')
            ->getJson('/api/v1/customers-creator-options')
            ->assertOk();
        $salesAOptIds = collect($salesAOpts->json('data'))->pluck('id')->all();
        $this->assertSame([$salesA->id], $salesAOptIds);
    }
}

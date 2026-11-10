<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketDepartment;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TicketingDepartmentsAndRoutingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function createStaffAgent(string $name, string $email, string $role = User::ROLE_INSTALLER, bool $active = true): User
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make('Agent@12345'),
            'user_type' => $role,
            'customer_scope' => User::SCOPE_ALL,
            'is_active' => $active,
        ]);
        $user->syncPermissions(['customers.view', 'parts.view', 'tickets.view', 'tickets.reply']);

        return $user;
    }

    public function test_admin_can_configure_departments_and_round_robin_rotates_exact_order(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        $agentA = $this->createStaffAgent('Agent A', 'agent-a@crm.local');
        $agentB = $this->createStaffAgent('Agent B', 'agent-b@crm.local');
        $agentC = $this->createStaffAgent('Agent C', 'agent-c@crm.local');
        $inactiveAgent = $this->createStaffAgent('Inactive Agent', 'agent-off@crm.local', User::ROLE_INSTALLER, false);

        $customer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'کارخانه تست نوبتی',
            'mobile' => '09121110099',
            'created_by_user_id' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        // Create department with round_robin strategy and 4 agents (1 inactive)
        $deptRes = $this->postJson('/api/v1/settings/ticket-departments', [
            'name' => 'واحد تعمیرات نوبتی',
            'description' => 'پشتیبانی تخصصی دستگاه‌ها',
            'assignment_strategy' => 'round_robin',
            'is_default_repair' => true,
            'is_active' => true,
            'agent_ids' => [$agentA->id, $agentB->id, $agentC->id, $inactiveAgent->id],
        ])->assertStatus(201);

        $deptId = (int) $deptRes->json('department.id');

        // Submit 4 tickets sequentially -> must assign A, B, C, then wrap back to A (skipping inactiveAgent!)
        $assignedIds = [];
        for ($i = 1; $i <= 4; $i++) {
            $res = $this->postJson('/api/v1/tickets', [
                'customer_id' => $customer->id,
                'department_id' => $deptId,
                'ticket_type' => 'technical_support',
                'priority' => 'medium',
                'subject' => "تیکت تست نوبتی شماره {$i}",
                'body' => 'بررسی عملکرد توزیع چرخشی کارشناسان دپارتمان.',
            ])->assertStatus(201);

            $assignedIds[] = (int) $res->json('ticket.assigned_to_user_id');
        }

        $this->assertSame([$agentA->id, $agentB->id, $agentC->id, $agentA->id], $assignedIds);
    }

    public function test_least_loaded_strategy_picks_agent_with_fewest_open_tickets(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        $busyAgent = $this->createStaffAgent('Busy Agent', 'busy@crm.local');
        $lightAgent = $this->createStaffAgent('Light Agent', 'light@crm.local');

        $customer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'individual',
            'first_name' => 'رضا',
            'last_name' => 'کاظمی',
            'mobile' => '09123334455',
            'created_by_user_id' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $deptRes = $this->postJson('/api/v1/settings/ticket-departments', [
            'name' => 'دپارتمان کمترین بار کاری',
            'assignment_strategy' => 'least_loaded',
            'is_active' => true,
            'agent_ids' => [$busyAgent->id, $lightAgent->id],
        ])->assertStatus(201);

        $deptId = (int) $deptRes->json('department.id');

        // Give busyAgent 3 open tickets
        for ($i = 1; $i <= 3; $i++) {
            Ticket::create([
                'tracking_code' => "TKT-BUSY-{$i}",
                'customer_id' => $customer->id,
                'department_id' => $deptId,
                'created_by_user_id' => $admin->id,
                'assigned_to_user_id' => $busyAgent->id,
                'ticket_type' => 'technical_support',
                'priority' => 'high',
                'status' => 'open',
                'subject' => "Open {$i}",
                'last_reply_at' => now(),
            ]);
        }

        // Give lightAgent 1 open ticket and 5 CLOSED tickets (closed must NOT count as active load!)
        Ticket::create([
            'tracking_code' => 'TKT-LIGHT-OPEN-1',
            'customer_id' => $customer->id,
            'department_id' => $deptId,
            'created_by_user_id' => $admin->id,
            'assigned_to_user_id' => $lightAgent->id,
            'ticket_type' => 'technical_support',
            'priority' => 'medium',
            'status' => 'in_progress',
            'subject' => 'Light Open',
            'last_reply_at' => now(),
        ]);

        for ($j = 1; $j <= 5; $j++) {
            Ticket::create([
                'tracking_code' => "TKT-LIGHT-CLOSED-{$j}",
                'customer_id' => $customer->id,
                'department_id' => $deptId,
                'created_by_user_id' => $admin->id,
                'assigned_to_user_id' => $lightAgent->id,
                'ticket_type' => 'technical_support',
                'priority' => 'low',
                'status' => 'closed',
                'subject' => "Closed {$j}",
                'closed_at' => now(),
                'last_reply_at' => now(),
            ]);
        }

        // Next ticket must go to lightAgent (1 active vs 3 active)
        $res = $this->postJson('/api/v1/tickets', [
            'customer_id' => $customer->id,
            'department_id' => $deptId,
            'ticket_type' => 'repair_request',
            'priority' => 'urgent',
            'subject' => 'خرابی برد اصلی دستگاه',
            'body' => 'دستگاه روشن نمی‌شود و نیاز به بررسی فوری دارد.',
        ])->assertStatus(201);

        $this->assertSame($lightAgent->id, (int) $res->json('ticket.assigned_to_user_id'));
    }

    public function test_random_strategy_assigns_only_among_active_department_agents(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        $agent1 = $this->createStaffAgent('Rand 1', 'rand1@crm.local');
        $agent2 = $this->createStaffAgent('Rand 2', 'rand2@crm.local');
        $outsider = $this->createStaffAgent('Outsider', 'outsider@crm.local');

        $customer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'individual',
            'first_name' => 'حسین',
            'last_name' => 'موسوی',
            'mobile' => '09128887766',
            'created_by_user_id' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $dept = TicketDepartment::create([
            'name' => 'دپارتمان تصادفی',
            'assignment_strategy' => 'random',
            'is_active' => true,
        ]);
        $dept->agents()->sync([$agent1->id, $agent2->id]);

        for ($i = 1; $i <= 5; $i++) {
            $res = $this->postJson('/api/v1/tickets', [
                'customer_id' => $customer->id,
                'department_id' => $dept->id,
                'ticket_type' => 'general',
                'priority' => 'low',
                'subject' => "Random {$i}",
                'body' => 'تست تخصیص تصادفی بین اعضای مجاز دپارتمان.',
            ])->assertStatus(201);

            $assigned = (int) $res->json('ticket.assigned_to_user_id');
            $this->assertContains($assigned, [$agent1->id, $agent2->id]);
            $this->assertNotSame($outsider->id, $assigned);
        }
    }

    public function test_staff_reply_and_internal_note_and_department_transfer(): void
    {
        $admin = User::where('email', 'admin@crm.local')->firstOrFail();
        $agent = $this->createStaffAgent('Support Tech', 'tech-reply@crm.local');

        $customer = Customer::create([
            'customer_type' => 'effective',
            'type' => 'company',
            'company_name' => 'پتروشیمی پارس',
            'mobile' => '09124445566',
            'created_by_user_id' => $admin->id,
        ]);

        $dept = TicketDepartment::create([
            'name' => 'فنی ویژه',
            'assignment_strategy' => 'round_robin',
            'is_active' => true,
        ]);
        $dept->agents()->sync([$agent->id]);

        Sanctum::actingAs($admin);
        $createRes = $this->postJson('/api/v1/tickets', [
            'customer_id' => $customer->id,
            'department_id' => $dept->id,
            'ticket_type' => 'technical_support',
            'priority' => 'high',
            'subject' => 'کالیبراسیون سنسور فشار',
            'body' => 'مقدار نمایشگر ۱۰ درصد خطا دارد.',
        ])->assertStatus(201);

        $ticketId = (int) $createRes->json('ticket.id');
        $this->assertSame($agent->id, (int) $createRes->json('ticket.assigned_to_user_id'));

        // Assigned agent can view, post internal note, and post public reply
        Sanctum::actingAs($agent);

        $this->postJson("/api/v1/tickets/{$ticketId}/messages", [
            'body' => 'یادداشت داخلی: نیاز به قطعه یدکی کد P-22 از انبار داریم.',
            'is_internal_note' => true,
        ])->assertStatus(201);

        // Internal note should NOT switch ticket status to answered
        $this->assertSame('open', Ticket::findOrFail($ticketId)->status);

        // Public reply switches status to answered
        $this->postJson("/api/v1/tickets/{$ticketId}/messages", [
            'body' => 'کارشناس فنی فردا ساعت ۹ صبح جهت کالیبراسیون اعزام می‌شود.',
            'is_internal_note' => false,
        ])->assertStatus(201);

        $this->assertSame('answered', Ticket::findOrFail($ticketId)->status);

        // Staff detail view includes both internal note and public reply
        $detail = $this->getJson("/api/v1/tickets/{$ticketId}")->assertOk();
        $this->assertCount(3, $detail->json('ticket.messages'));
    }
}

<?php

namespace Tests\Unit;

use App\Support\JalaliDate;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class JalaliDateTest extends TestCase
{
    public function test_converts_standard_gregorian_date_to_jalali(): void
    {
        // 2026-11-09 corresponds to 1405/08/18 (18 Aban 1405)
        $this->assertSame([1405, 8, 18], JalaliDate::gregorianToJalali(2026, 11, 9));
        $this->assertSame('1405/08/18', JalaliDate::format('2026-11-09'));
    }

    public function test_handles_nowruz_and_leap_year_boundaries_accurately(): void
    {
        // 1403 is a leap year (30 Esfand = 2025-03-20), 1404 Nowruz = 2025-03-21
        $this->assertSame('1403/12/30', JalaliDate::format('2025-03-20'));
        $this->assertSame('1404/01/01', JalaliDate::format('2025-03-21'));

        // 1404 is a normal year (29 Esfand = 2026-03-20), 1405 Nowruz = 2026-03-21
        $this->assertSame('1404/12/29', JalaliDate::format('2026-03-20'));
        $this->assertSame('1405/01/01', JalaliDate::format('2026-03-21'));
    }

    public function test_formats_datetime_with_hour_and_minute(): void
    {
        $dt = Carbon::create(2026, 11, 9, 14, 35, 10, 'UTC');
        $this->assertSame('1405/08/18 14:35', JalaliDate::formatDateTime($dt));
    }

    public function test_returns_empty_string_for_null_or_blank_input(): void
    {
        $this->assertSame('', JalaliDate::format(null));
        $this->assertSame('', JalaliDate::format(''));
        $this->assertSame('', JalaliDate::formatDateTime(null));
    }
}

<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeInterface;

class JalaliDate
{
    /**
     * Convert a Gregorian (gy, gm, gd) tuple into Jalali [jy, jm, jd].
     *
     * @return array{0:int,1:int,2:int}
     */
    public static function gregorianToJalali(int $gy, int $gm, int $gd): array
    {
        $gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        $gy2 = ($gm > 2) ? ($gy + 1) : $gy;

        $days = 355666
            + (365 * $gy)
            + intdiv($gy2 + 3, 4)
            - intdiv($gy2 + 99, 100)
            + intdiv($gy2 + 399, 400)
            + $gd
            + $gDaysInMonth[$gm - 1];

        $jy = -1595 + (33 * intdiv($days, 12053));
        $days %= 12053;

        $jy += 4 * intdiv($days, 1461);
        $days %= 1461;

        if ($days > 365) {
            $jy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }

        if ($days < 186) {
            $jm = 1 + intdiv($days, 31);
            $jd = 1 + ($days % 31);
        } else {
            $jm = 7 + intdiv($days - 186, 30);
            $jd = 1 + (($days - 186) % 30);
        }

        return [$jy, $jm, $jd];
    }

    /**
     * Format a date or ISO string as YYYY/MM/DD in Jalali calendar.
     */
    public static function format(DateTimeInterface|string|null $value, string $separator = '/'): string
    {
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return '';
        }

        $dt = $value instanceof DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value);
        [$jy, $jm, $jd] = self::gregorianToJalali((int) $dt->year, (int) $dt->month, (int) $dt->day);

        return sprintf('%04d%s%02d%s%02d', $jy, $separator, $jm, $separator, $jd);
    }

    /**
     * Format a datetime or ISO string as "YYYY/MM/DD HH:MM" in Jalali calendar.
     */
    public static function formatDateTime(DateTimeInterface|string|null $value, string $separator = '/'): string
    {
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return '';
        }

        $dt = $value instanceof DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value);
        $datePart = self::format($dt, $separator);

        return sprintf('%s %02d:%02d', $datePart, (int) $dt->hour, (int) $dt->minute);
    }
}

<?php

namespace App\Support;

class ChangelogParser
{
    /**
     * Resolve CHANGELOG.md path across local, Docker, and cPanel deployments.
     */
    public static function resolvePath(): ?string
    {
        $candidates = [
            base_path('../CHANGELOG.md'),
            base_path('CHANGELOG.md'),
        ];

        foreach ($candidates as $path) {
            if (is_file($path) && is_readable($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Parse CHANGELOG.md into a structured timeline of versions with Jalali dates.
     *
     * @return array<int, array{
     *     version: string,
     *     jalali_date: string,
     *     gregorian_date: string|null,
     *     is_current: bool,
     *     sections: array<int, array{title: string, items: array<int, string>}>
     * }>
     */
    public static function parse(?string $markdown = null): array
    {
        if ($markdown === null) {
            $path = self::resolvePath();
            if ($path === null) {
                return [];
            }
            $markdown = (string) file_get_contents($path);
        }

        $currentVersion = (string) config('app.version', '2.5.0');
        $lines = preg_split('/\r\n|\r|\n/', $markdown) ?: [];

        $releases = [];
        $currentRelease = null;
        $currentSectionIndex = null;

        foreach ($lines as $rawLine) {
            $line = rtrim($rawLine);

            // Version heading: ## [2.5.0] — ۱۴۰۵/۰۹/۰۴ (2026-11-25)
            if (preg_match('/^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+(?:-[^\s\]]+)?)\]?(?:\s*[—–-]\s*(.+))?$/u', $line, $m)) {
                if ($currentRelease !== null) {
                    $releases[] = $currentRelease;
                }

                $version = trim($m[1]);
                $dateMeta = trim($m[2] ?? '');

                $gregorianDate = null;
                if (preg_match('/\((\d{4}-\d{2}-\d{2})\)/', $dateMeta, $gm)) {
                    $gregorianDate = $gm[1];
                } elseif (preg_match('/\b(\d{4}-\d{2}-\d{2})\b/', $dateMeta, $gm)) {
                    $gregorianDate = $gm[1];
                }

                $jalaliDate = '';
                $cleanedMeta = trim(preg_replace('/\(\d{4}-\d{2}-\d{2}\)/', '', $dateMeta) ?? '');
                if ($cleanedMeta !== '' && preg_match('/[0-9۰-۹]{4}\/[0-9۰-۹]{2}\/[0-9۰-۹]{2}/u', $cleanedMeta, $jm)) {
                    $jalaliDate = self::toPersianDigits($jm[0]);
                } elseif ($gregorianDate !== null) {
                    $jalaliDate = self::toPersianDigits(JalaliDate::format($gregorianDate));
                }

                $currentRelease = [
                    'version' => $version,
                    'jalali_date' => $jalaliDate,
                    'gregorian_date' => $gregorianDate,
                    'is_current' => $version === $currentVersion,
                    'sections' => [],
                ];
                $currentSectionIndex = null;
                continue;
            }

            if ($currentRelease === null) {
                continue;
            }

            // Section heading: ### ۱. عنوان بخش
            if (preg_match('/^###\s+(.+)$/u', $line, $sm)) {
                $currentRelease['sections'][] = [
                    'title' => trim($sm[1]),
                    'items' => [],
                ];
                $currentSectionIndex = count($currentRelease['sections']) - 1;
                continue;
            }

            // Bullet item (top-level or nested)
            if (preg_match('/^\s*[-*]\s+(.+)$/u', $line, $bm)) {
                if ($currentSectionIndex === null) {
                    $currentRelease['sections'][] = [
                        'title' => 'تغییرات این نسخه',
                        'items' => [],
                    ];
                    $currentSectionIndex = 0;
                }

                $currentRelease['sections'][$currentSectionIndex]['items'][] = trim($bm[1]);
            }
        }

        if ($currentRelease !== null) {
            $releases[] = $currentRelease;
        }

        return $releases;
    }

    protected static function toPersianDigits(string $value): string
    {
        return str_replace(
            ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
            $value
        );
    }
}

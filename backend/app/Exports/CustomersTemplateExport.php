<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\AfterSheet;

class CustomersTemplateExport implements FromArray, WithHeadings, ShouldAutoSize, WithCustomCsvSettings, WithEvents
{
    public function getCsvSettings(): array
    {
        return [
            'use_bom' => true,
            'output_encoding' => 'UTF-8',
        ];
    }

    public function headings(): array
    {
        return [
            'نوع مشتری',
            'نوع شخص',
            'نام',
            'نام خانوادگی',
            'نام شرکت',
            'کد ملی / شناسه ملی',
            'شماره همراه',
            'تلفن ثابت',
            'ایمیل',
            'استان',
            'شهر',
            'آدرس',
            'یادداشت',
        ];
    }

    public function array(): array
    {
        return [
            [
                'بالفعل',
                'حقوقی',
                '',
                '',
                'شرکت فولاد فرایند',
                '10103456789',
                '',
                '02188776655',
                'info@foulad.ir',
                'تهران',
                'تهران',
                'خیابان مطهری، پلاک ۱۲',
                'مشتری حقوقی فعال خط تولید دستگاه‌های صنعتی (ثبت فقط با نام شرکت)',
            ],
            [
                'بالقوه',
                'حقیقی',
                'رضا',
                'محمودی',
                '',
                '0012345678',
                '09359876543',
                '03133221100',
                'reza@gmail.com',
                'اصفهان',
                'نجف‌آباد',
                'بلوار صنعت، کوچه امید',
                'علاقه‌مند به تهیه دستگاه پمپ هیدرولیک',
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $event->sheet->getDelegate()->setRightToLeft(true);
            },
        ];
    }
}

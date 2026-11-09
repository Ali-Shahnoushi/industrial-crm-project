<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CustomerResource\Pages;
use App\Models\Customer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class CustomerResource extends Resource
{
    protected static ?string $model = Customer::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'مشتریان';

    protected static ?string $modelLabel = 'مشتری';

    protected static ?string $pluralModelLabel = 'مشتریان';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('customer_type')
                    ->label('وضعیت مشتری')
                    ->options([
                        'potential' => 'بالقوه (سرنخ)',
                        'effective' => 'بالفعل (خریدار)',
                    ])
                    ->default('potential')
                    ->required(),
                Forms\Components\Select::make('type')
                    ->label('نوع شخصیت')
                    ->options([
                        'individual' => 'حقیقی',
                        'company' => 'حقوقی',
                    ])
                    ->default('individual')
                    ->live()
                    ->required(),
                Forms\Components\TextInput::make('first_name')
                    ->label('نام')
                    ->required(fn (Get $get): bool => $get('type') !== 'company')
                    ->maxLength(100),
                Forms\Components\TextInput::make('last_name')
                    ->label('نام خانوادگی')
                    ->required(fn (Get $get): bool => $get('type') !== 'company')
                    ->maxLength(100),
                Forms\Components\TextInput::make('company_name')
                    ->label('نام شرکت / سازمان')
                    ->required(fn (Get $get): bool => $get('type') === 'company')
                    ->maxLength(150),
                Forms\Components\TextInput::make('national_code')
                    ->label('کد ملی / شناسه ملی')
                    ->maxLength(20),
                Forms\Components\TextInput::make('mobile')
                    ->label('شماره موبایل')
                    ->maxLength(20),
                Forms\Components\TextInput::make('phone')
                    ->label('تلفن ثابت')
                    ->maxLength(20),
                Forms\Components\TextInput::make('email')
                    ->label('ایمیل')
                    ->email()
                    ->maxLength(150),
                Forms\Components\TextInput::make('province')
                    ->label('استان')
                    ->maxLength(50),
                Forms\Components\TextInput::make('city')
                    ->label('شهر')
                    ->maxLength(50),
                Forms\Components\Textarea::make('address')
                    ->label('نشانی پستی')
                    ->columnSpanFull(),
                Forms\Components\Textarea::make('notes')
                    ->label('یادداشت‌ها')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('display_name')
                    ->label('نام مشتری / شرکت')
                    ->searchable(['first_name', 'last_name', 'company_name']),
                Tables\Columns\BadgeColumn::make('customer_type')
                    ->label('نوع مشتری')
                    ->colors([
                        'warning' => 'potential',
                        'success' => 'effective',
                    ])
                    ->formatStateUsing(fn (string $state): string => $state === 'effective' ? 'بالفعل' : 'بالقوه'),
                Tables\Columns\TextColumn::make('mobile')
                    ->label('شماره موبایل')
                    ->placeholder('—')
                    ->searchable(),
                Tables\Columns\TextColumn::make('city')
                    ->label('شهر')
                    ->searchable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('تاریخ ثبت')
                    ->dateTime('Y-m-d')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('customer_type')
                    ->label('وضعیت مشتری')
                    ->options([
                        'potential' => 'بالقوه',
                        'effective' => 'بالفعل',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCustomers::route('/'),
            'create' => Pages\CreateCustomer::route('/create'),
            'edit' => Pages\EditCustomer::route('/{record}/edit'),
        ];
    }
}

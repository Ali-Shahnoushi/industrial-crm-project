<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-shield-check';

    protected static ?string $navigationLabel = 'کاربران و سطح دسترسی';

    protected static ?string $modelLabel = 'کاربر';

    protected static ?string $pluralModelLabel = 'کاربران';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->label('نام و نام خانوادگی')
                    ->required()
                    ->maxLength(100),
                Forms\Components\TextInput::make('email')
                    ->label('ایمیل')
                    ->email()
                    ->required()
                    ->unique(ignoreRecord: true),
                Forms\Components\TextInput::make('phone')
                    ->label('شماره موبایل')
                    ->maxLength(20),
                Forms\Components\Select::make('user_type')
                    ->label('نقش سازمانی')
                    ->options([
                        User::ROLE_SALESPERSON => 'کارمند فروش',
                        User::ROLE_INSTALLER => 'نصاب',
                        User::ROLE_MANAGER => 'مدیر / سرپرست',
                        User::ROLE_ADMINISTRATOR => 'مدیر ارشد',
                    ])
                    ->default(User::ROLE_SALESPERSON)
                    ->required(),
                Forms\Components\Select::make('customer_scope')
                    ->label('محدوده دسترسی به مشتریان')
                    ->options([
                        User::SCOPE_OWN => 'فقط مشتریان ثبت‌شده توسط خود کارمند',
                        User::SCOPE_SELECTED => 'مشتریان خود + استثناهای انتخاب‌شده',
                        User::SCOPE_ALL => 'همه مشتریان سیستم',
                    ])
                    ->default(User::SCOPE_OWN)
                    ->required(),
                Forms\Components\TextInput::make('password')
                    ->label('رمز عبور')
                    ->password()
                    ->dehydrateStateUsing(fn ($state) => filled($state) ? bcrypt($state) : null)
                    ->dehydrated(fn ($state) => filled($state))
                    ->required(fn (string $operation): bool => $operation === 'create'),
                Forms\Components\Toggle::make('is_active')
                    ->label('وضعیت فعال')
                    ->default(true),
                Forms\Components\CheckboxList::make('permissions')
                    ->label('مجوزهای دسترسی عملیاتی (ACL)')
                    ->relationship('permissions', 'name')
                    ->columns(2)
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('نام کاربر')
                    ->searchable(),
                Tables\Columns\TextColumn::make('email')
                    ->label('ایمیل')
                    ->searchable(),
                Tables\Columns\TextColumn::make('role_label')
                    ->label('نقش سازمانی')
                    ->badge(),
                Tables\Columns\IconColumn::make('is_active')
                    ->label('فعال')
                    ->boolean(),
                Tables\Columns\TextColumn::make('permissions.name')
                    ->label('مجوزها')
                    ->badge()
                    ->limitList(4),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}

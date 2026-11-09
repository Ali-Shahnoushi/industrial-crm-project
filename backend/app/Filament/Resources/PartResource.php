<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PartResource\Pages;
use App\Models\Part;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class PartResource extends Resource
{
    protected static ?string $model = Part::class;

    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationLabel = 'دستگاه‌ها';

    protected static ?string $modelLabel = 'دستگاه';

    protected static ?string $pluralModelLabel = 'دستگاه‌ها';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->label('نام دستگاه')
                    ->required()
                    ->maxLength(150),
                Forms\Components\TextInput::make('code')
                    ->label('کد فنی دستگاه')
                    ->required()
                    ->unique(ignoreRecord: true)
                    ->maxLength(50),
                Forms\Components\TextInput::make('stock_quantity')
                    ->label('موجودی انبار')
                    ->numeric()
                    ->default(0)
                    ->minValue(0)
                    ->required(),
                Forms\Components\TextInput::make('periodic_service_months')
                    ->label('بازه سرویس دوره‌ای (ماه)')
                    ->numeric()
                    ->default(6)
                    ->minValue(1)
                    ->required(),
                Forms\Components\Toggle::make('is_active')
                    ->label('فعال در کاتالوگ')
                    ->default(true),
                Forms\Components\Textarea::make('description')
                    ->label('توضیحات فنی')
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('نام دستگاه')
                    ->searchable(),
                Tables\Columns\TextColumn::make('code')
                    ->label('کد فنی')
                    ->searchable()
                    ->badge()
                    ->color('gray'),
                Tables\Columns\TextColumn::make('stock_quantity')
                    ->label('موجودی انبار')
                    ->suffix(' عدد')
                    ->sortable(),
                Tables\Columns\TextColumn::make('periodic_service_months')
                    ->label('دوره سرویس')
                    ->suffix(' ماه'),
                Tables\Columns\IconColumn::make('is_active')
                    ->label('وضعیت')
                    ->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListParts::route('/'),
            'create' => Pages\CreatePart::route('/create'),
            'edit' => Pages\EditPart::route('/{record}/edit'),
        ];
    }
}

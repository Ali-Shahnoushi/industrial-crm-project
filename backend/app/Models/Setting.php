<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class Setting extends Model
{
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'key',
        'value',
        'is_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'is_encrypted' => 'boolean',
        ];
    }

    public static function get(string $key, $default = null)
    {
        $setting = static::find($key);
        if (!$setting || $setting->value === null) {
            return $default;
        }

        if ($setting->is_encrypted) {
            try {
                return Crypt::decryptString($setting->value);
            } catch (\Exception $e) {
                return $default;
            }
        }

        return $setting->value;
    }

    public static function set(string $key, $value, bool $encrypted = false): self
    {
        $valToStore = $value;
        if ($encrypted && $value !== null) {
            $valToStore = Crypt::encryptString((string)$value);
        }

        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $valToStore, 'is_encrypted' => $encrypted]
        );
    }
}

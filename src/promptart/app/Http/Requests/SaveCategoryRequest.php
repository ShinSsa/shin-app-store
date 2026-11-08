<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            // #RGB ou #RRGGBB; o CategoryColor normaliza e cai no padrão se vier lixo
            'color' => ['nullable', 'string', 'regex:/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/'],
            'thumb_path' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}

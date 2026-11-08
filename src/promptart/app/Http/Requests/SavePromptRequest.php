<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SavePromptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $pos = ['nullable', 'in:left,center,right'];
        $posY = ['nullable', 'in:top,center,bottom'];

        return [
            'title' => ['required', 'string', 'max:255'],
            'tag' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:65000'],
            'description' => ['nullable', 'string', 'max:65000'],
            'thumb1_path' => ['nullable', 'string', 'max:2048'],
            'thumb1_pos_x' => $pos,
            'thumb1_pos_y' => $posY,
            'thumb2_path' => ['nullable', 'string', 'max:2048'],
            'thumb2_pos_x' => $pos,
            'thumb2_pos_y' => $posY,
            'attachment_path' => ['nullable', 'string', 'max:2048'],
            'attachment_name' => ['nullable', 'string', 'max:255'],
            'is_favorite' => ['nullable', 'boolean'],
            'subcategories' => ['nullable', 'array'],
            'subcategories.*' => ['string', 'max:255'],
        ];
    }
}

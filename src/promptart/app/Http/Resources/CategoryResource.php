<?php

namespace App\Http\Resources;

use App\Support\CategoryColor;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            // cor da frente, a de trás e o texto legível sobre ela — o app não
            // precisa saber a fórmula, só pintar
            'color' => CategoryColor::normalizar($this->color),
            'color_back' => CategoryColor::fundo($this->color),
            'color_text' => CategoryColor::textoSobreFundo($this->color),
            'sort_order' => $this->sort_order,
            'prompts_count' => $this->whenCounted('prompts'),
            'subcategories' => $this->whenLoaded(
                'subcategories',
                fn () => $this->subcategories->map(fn ($s) => ['id' => $s->id, 'name' => $s->name])->values()
            ),
            'prompts' => PromptResource::collection($this->whenLoaded('prompts')),
        ];
    }
}

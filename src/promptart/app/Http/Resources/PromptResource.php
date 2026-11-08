<?php

namespace App\Http\Resources;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Prompt */
class PromptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'title' => $this->title,
            'tag' => $this->tag,
            'body' => $this->body,
            'description' => $this->description,
            'thumb1_path' => $this->thumb1_path,
            'thumb1_url' => MediaUrl::resolve($this->thumb1_path),
            'thumb1_thumb_url' => MediaUrl::resolveThumb($this->thumb1_path),
            'thumb1_pos_x' => $this->thumb1_pos_x,
            'thumb1_pos_y' => $this->thumb1_pos_y,
            'thumb2_path' => $this->thumb2_path,
            'thumb2_url' => MediaUrl::resolve($this->thumb2_path),
            'thumb2_thumb_url' => MediaUrl::resolveThumb($this->thumb2_path),
            'thumb2_pos_x' => $this->thumb2_pos_x,
            'thumb2_pos_y' => $this->thumb2_pos_y,
            'attachment_path' => $this->attachment_path,
            'attachment_url' => MediaUrl::resolve($this->attachment_path),
            'attachment_thumb_url' => MediaUrl::resolveThumb($this->attachment_path),
            'attachment_name' => $this->attachment_name,
            'is_favorite' => $this->is_favorite,
            'char_count' => $this->char_count,
            'subcategories' => $this->whenLoaded(
                'subcategories',
                fn () => $this->subcategories->pluck('name')->values()
            ),
        ];
    }
}

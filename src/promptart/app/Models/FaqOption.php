<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Um botão dentro de uma resposta. `target` é o slug do nó que ele abre. */
class FaqOption extends Model
{
    protected $fillable = ['faq_node_id', 'label', 'target', 'sort_order'];

    public function node(): BelongsTo
    {
        return $this->belongsTo(FaqNode::class, 'faq_node_id');
    }
}

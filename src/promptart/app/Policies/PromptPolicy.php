<?php

namespace App\Policies;

use App\Models\Prompt;
use App\Models\User;

class PromptPolicy
{
    public function view(User $user, Prompt $prompt): bool
    {
        return $prompt->user_id === $user->id;
    }

    public function update(User $user, Prompt $prompt): bool
    {
        return $prompt->user_id === $user->id;
    }

    public function delete(User $user, Prompt $prompt): bool
    {
        return $prompt->user_id === $user->id;
    }
}

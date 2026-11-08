<?php

namespace App\Policies;

use App\Models\Subcategory;
use App\Models\User;

class SubcategoryPolicy
{
    public function update(User $user, Subcategory $subcategory): bool
    {
        return $subcategory->category->user_id === $user->id;
    }

    public function delete(User $user, Subcategory $subcategory): bool
    {
        return $subcategory->category->user_id === $user->id;
    }
}

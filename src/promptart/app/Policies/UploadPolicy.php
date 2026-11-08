<?php

namespace App\Policies;

use App\Models\Upload;
use App\Models\User;

class UploadPolicy
{
    public function delete(User $user, Upload $upload): bool
    {
        return $upload->user_id === $user->id;
    }
}

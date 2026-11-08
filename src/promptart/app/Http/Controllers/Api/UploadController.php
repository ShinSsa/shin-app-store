<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Upload;
use App\Services\UploadService;
use App\Support\MediaUrl;
use Illuminate\Http\Request;

class UploadController extends Controller
{
    public function __construct(private UploadService $service) {}

    public function store(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file'],
        ]);

        $upload = $this->service->store($request->user(), $request->file('file'));

        return response()->json([
            'id' => $upload->id,
            'path' => $upload->path,
            'url' => MediaUrl::resolve($upload->path),
            'thumb_url' => MediaUrl::resolveThumb($upload->path),
            'original_name' => $upload->original_name,
            'size_bytes' => $upload->size_bytes,
        ], 201);
    }

    public function destroy(Upload $upload)
    {
        $this->authorize('delete', $upload);

        $this->service->delete($upload);

        return response()->noContent();
    }

    public function storage(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'used_bytes' => $user->storage_used_bytes,
            'limit_bytes' => $user->hasUnlimitedStorage() ? null : $user->storageLimitBytes(),
        ]);
    }
}

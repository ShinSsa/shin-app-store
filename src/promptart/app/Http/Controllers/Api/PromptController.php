<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SavePromptRequest;
use App\Http\Resources\PromptResource;
use App\Models\Category;
use App\Models\Prompt;
use App\Services\HtmlSanitizer;
use App\Services\UploadService;
use Illuminate\Http\Request;

class PromptController extends Controller
{
    public function __construct(private HtmlSanitizer $sanitizer) {}

    public function index(Request $request, Category $category)
    {
        $this->authorize('view', $category);

        $query = $category->prompts()->with('subcategories');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('body', 'like', "%{$search}%")
                    ->orWhere('tag', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($sub = $request->query('subcategory')) {
            $query->whereHas('subcategories', fn ($q) => $q->where('name', $sub));
        }

        if ($request->query('sort') === 'alpha') {
            $query->orderBy('title');
        } else {
            $query->orderBy('id');
        }

        return PromptResource::collection($query->get());
    }

    public function store(SavePromptRequest $request, Category $category)
    {
        $this->authorize('update', $category);

        $data = $this->prepare($request->validated());

        $prompt = $category->prompts()->make($data);
        $prompt->user_id = $request->user()->id;
        $prompt->save();

        $this->syncSubcategories($prompt, $category, $request->validated()['subcategories'] ?? []);

        return new PromptResource($prompt->load('subcategories'));
    }

    public function update(SavePromptRequest $request, Prompt $prompt)
    {
        $this->authorize('update', $prompt);

        $data = $this->prepare($request->validated());
        $prompt->update($data);

        $this->syncSubcategories($prompt, $prompt->category, $request->validated()['subcategories'] ?? []);

        return new PromptResource($prompt->load('subcategories'));
    }

    public function destroy(Request $request, Prompt $prompt, UploadService $uploads)
    {
        $this->authorize('delete', $prompt);

        $uploads->deleteByPaths($request->user(), [
            $prompt->thumb1_path, $prompt->thumb2_path, $prompt->attachment_path,
        ]);

        $prompt->delete();

        return response()->noContent();
    }

    public function move(Request $request, Prompt $prompt)
    {
        $this->authorize('update', $prompt);

        $data = $request->validate([
            'category_id' => ['required', 'integer'],
            'subcategory' => ['nullable', 'string', 'max:255'],
        ]);

        $dest = $request->user()->categories()->findOrFail($data['category_id']);

        $prompt->update(['category_id' => $dest->id]);

        // subcategorias antigas não valem na categoria destino
        $names = [];
        if (! empty($data['subcategory'])) {
            $names = [$data['subcategory']];
        }
        $this->syncSubcategories($prompt, $dest, $names);

        return new PromptResource($prompt->load('subcategories'));
    }

    public function favorite(Prompt $prompt)
    {
        $this->authorize('update', $prompt);

        $prompt->update(['is_favorite' => ! $prompt->is_favorite]);

        return new PromptResource($prompt->load('subcategories'));
    }

    public function favorites(Request $request)
    {
        $prompts = $request->user()->prompts()
            ->where('is_favorite', true)
            ->with('subcategories')
            ->get();

        return PromptResource::collection($prompts);
    }

    private function prepare(array $data): array
    {
        $data['body'] = $this->sanitizer->sanitize($data['body']);
        $data['description'] = $this->sanitizer->sanitize($data['description'] ?? null);
        $data['char_count'] = mb_strlen(trim(strip_tags($data['body'])));

        unset($data['subcategories']);

        return $data;
    }

    private function syncSubcategories(Prompt $prompt, Category $category, array $names): void
    {
        $ids = $category->subcategories()
            ->whereIn('name', $names)
            ->pluck('id');

        $prompt->subcategories()->sync($ids);
    }
}

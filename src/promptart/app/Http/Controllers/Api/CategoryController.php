<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\HtmlSanitizer;
use App\Services\UploadService;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Bootstrap do SPA: categorias do usuário com subcategorias e prompts.
     */
    public function index(Request $request)
    {
        $categories = $request->user()->categories()
            ->with(['subcategories', 'prompts.subcategories'])
            ->withCount('prompts')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return CategoryResource::collection($categories);
    }

    public function store(SaveCategoryRequest $request)
    {
        $category = $request->user()->categories()->create($request->validated());

        return new CategoryResource($category->load('subcategories')->loadCount('prompts'));
    }

    public function update(SaveCategoryRequest $request, Category $category)
    {
        $this->authorize('update', $category);

        $category->update($request->validated());

        return new CategoryResource($category->load('subcategories')->loadCount('prompts'));
    }

    public function destroy(Request $request, Category $category, UploadService $uploads)
    {
        $this->authorize('delete', $category);

        // cascata em prompts + arquivos (guia §5)
        $paths = [$category->thumb_path];
        foreach ($category->prompts()->get(['thumb1_path', 'thumb2_path', 'attachment_path']) as $p) {
            array_push($paths, $p->thumb1_path, $p->thumb2_path, $p->attachment_path);
        }

        $uploads->deleteByPaths($request->user(), $paths);
        $category->delete();

        return response()->noContent();
    }
}

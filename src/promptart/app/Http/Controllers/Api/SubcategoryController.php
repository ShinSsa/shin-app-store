<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Subcategory;
use Illuminate\Http\Request;

class SubcategoryController extends Controller
{
    public function index(Request $request, Category $category)
    {
        $this->authorize('view', $category);

        return response()->json(
            $category->subcategories->map(fn ($s) => ['id' => $s->id, 'name' => $s->name])
        );
    }

    public function store(Request $request, Category $category)
    {
        $this->authorize('update', $category);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        if ($category->subcategories()->where('name', $data['name'])->exists()) {
            return response()->json(['message' => 'Já existe uma subcategoria com esse nome.'], 422);
        }

        $sub = $category->subcategories()->create([
            'name' => $data['name'],
            'sort_order' => ($category->subcategories()->max('sort_order') ?? 0) + 1,
        ]);

        return response()->json(['id' => $sub->id, 'name' => $sub->name], 201);
    }

    public function update(Request $request, Subcategory $subcategory)
    {
        $this->authorize('update', $subcategory);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $exists = $subcategory->category->subcategories()
            ->where('name', $data['name'])
            ->where('id', '!=', $subcategory->id)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Já existe uma subcategoria com esse nome.'], 422);
        }

        $subcategory->update(['name' => $data['name']]);

        return response()->json(['id' => $subcategory->id, 'name' => $subcategory->name]);
    }

    public function destroy(Subcategory $subcategory)
    {
        $this->authorize('delete', $subcategory);

        $subcategory->delete(); // pivot cai em cascata

        return response()->noContent();
    }
}

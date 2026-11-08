<?php

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PromptController;
use App\Http\Controllers\Api\SubcategoryController;
use App\Http\Controllers\Api\UploadController;
use Illuminate\Support\Facades\Route;

/* Carregado por routes/web.php com o prefixo /api (middleware web + pessoal). */

// Categorias
Route::get('/categories', [CategoryController::class, 'index']);
Route::post('/categories', [CategoryController::class, 'store']);
Route::put('/categories/{category}', [CategoryController::class, 'update']);
Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

// Subcategorias
Route::get('/categories/{category}/subcategories', [SubcategoryController::class, 'index']);
Route::post('/categories/{category}/subcategories', [SubcategoryController::class, 'store']);
Route::put('/subcategories/{subcategory}', [SubcategoryController::class, 'update']);
Route::delete('/subcategories/{subcategory}', [SubcategoryController::class, 'destroy']);

// Prompts
Route::get('/categories/{category}/prompts', [PromptController::class, 'index']);
Route::post('/categories/{category}/prompts', [PromptController::class, 'store']);
Route::put('/prompts/{prompt}', [PromptController::class, 'update']);
Route::delete('/prompts/{prompt}', [PromptController::class, 'destroy']);
Route::post('/prompts/{prompt}/move', [PromptController::class, 'move']);
Route::post('/prompts/{prompt}/favorite', [PromptController::class, 'favorite']);
Route::get('/favorites', [PromptController::class, 'favorites']);

// Fotos
Route::post('/uploads', [UploadController::class, 'store']);
Route::delete('/uploads/{upload}', [UploadController::class, 'destroy']);
Route::get('/me/storage', [UploadController::class, 'storage']);

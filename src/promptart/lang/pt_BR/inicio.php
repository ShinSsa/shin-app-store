<?php

/*
 * Conteúdo que a conta nova já nasce com: uma categoria e um card dentro dela.
 * O texto de cada campo explica para que serve aquele campo — assim a primeira
 * tela não é um vazio, e o usuário vê um exemplo do que ele mesmo vai montar.
 */
return [
    'categoria_nome' => 'Nome da categoria aqui',
    'categoria_desc' => 'Uma breve descrição sobre a categoria',

    'subcategorias' => ['Casal', 'CEO'],

    'card_titulo' => 'Nome do prompt aqui',
    'card_tag' => 'Tags, separadas, por vírgulas',
    // o trecho colorido mostra na prática o destaque de texto do editor
    'card_texto' => 'Cole ou escreva seu prompt aqui. Selecione um texto para <span style="color:#007aff">destacar com cor</span>.',
    'card_desc' => 'Uma descrição ou dica sobre o prompt.',
];

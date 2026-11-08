<?php

return [
    'start_sem_codigo' => "¡Hola! Guardo prompts en tu cuenta de PromptArt.\n\n".
        "Para empezar, entra en <b>Mi Cuenta → Telegram</b> en el sitio, toca <b>Conectar Telegram</b> y envíame el código que aparezca.\n\n".
        ':site',

    'codigo_invalido' => "Código inválido o vencido.\n\n".
        'Genera uno nuevo en <b>Mi Cuenta → Telegram</b>. Cada código vale :minutos minutos.',

    'codigo_muitas_tentativas' => 'Demasiados intentos. Espera una hora y vuelve a intentarlo.',

    'chat_de_outra_conta' => "Esta conversación ya está vinculada a otra cuenta de PromptArt.\n\n".
        'Envía <b>/desvincular confirmar</b> antes de vincular una cuenta distinta.',

    'vinculado' => "Listo, :nome — tu cuenta está vinculada. ✅\n\n".
        "Ahora envíame un prompt así:\n\n".
        "<code>/novo\nRetrato cinematográfico\nPersonajes\nprimer plano, luz lateral dramática, lente 85mm</code>\n\n".
        'Usa <b>/ajuda</b> cuando lo necesites.',

    'nao_vinculado' => "Esta conversación aún no está vinculada a ninguna cuenta.\n\n".
        'Entra en <b>Mi Cuenta → Telegram</b> en el sitio y envíame el código de allí.',

    'sem_comando' => 'No entendí. Usa <b>/novo</b> para guardar un prompt o <b>/ajuda</b> para ver cómo.',

    'muitas_mensagens' => 'Con calma — demasiados mensajes seguidos. Inténtalo en un minuto.',

    'ajuda' => "Envía tu prompt en cuatro líneas:\n\n".
        "<code>/novo\nNombre del card\nCategoría\nEl texto del prompt</code>\n\n".
        "O todo en una línea, separado por barra vertical:\n\n".
        "<code>/novo Nombre del card | Categoría | El texto del prompt</code>\n\n".
        "Si la categoría no existe, la creo.\n\n".
        "<b>/status</b> — ver tu cuenta\n<b>/desvincular</b> — soltar esta conversación",

    'formato' => "Falta alguna parte. El formato es:\n\n".
        "<code>/novo\nNombre del card\nCategoría\nEl texto del prompt</code>\n\n".
        'Usa <b>/ajuda</b> para ver un ejemplo.',

    'sem_assinatura' => "Tu suscripción no está activa, así que no puedo guardarlo.\n\n".
        'Renueva en :site y envíame el prompt de nuevo.',

    'titulo_longo' => 'El nombre del card superó los :max caracteres.',
    'categoria_longa' => 'El nombre de la categoría superó los :max caracteres.',
    'texto_longo' => 'El texto del prompt superó los :max caracteres.',

    'salvo' => "✅ Card <b>:titulo</b> guardado en <b>:categoria</b>.\n\n:site",
    'salvo_categoria_nova' => "✅ Card <b>:titulo</b> guardado.\nCreé la categoría <b>:categoria</b> para él.\n\n:site",

    'status' => "Cuenta: <b>:email</b>\nPlan: <b>:plano</b>\nPrompts creados desde aquí: <b>:n</b>",
    'status_plano_nenhum' => 'sin suscripción activa',

    'desvincular_confirmar' => "¿Seguro? Esto suelta esta conversación de tu cuenta.\n\n".
        'Envía <b>/desvincular confirmar</b> para continuar.',
    'desvinculado' => 'Listo, esta conversación ya no está vinculada a ninguna cuenta.',

    'faq_nao_sei' => "No encontré una respuesta lista para eso. 🤔\n\nYa anoté tu pregunta y alguien te responderá. Mientras tanto, mira si alguno de estos temas ayuda:",
    'faq_vazio' => 'El asistente aún se está preparando. Inténtalo más tarde.',
    'faq_aviso_adm' => "🔔 <b>:n pregunta(s)</b> esperando respuesta en el asistente.\n\n:site",
    'faq_dica_privacidade' => 'Consejo: no escribas contraseñas ni datos de pago aquí.',
];

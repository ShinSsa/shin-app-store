<?php

return [
    'start_sem_codigo' => "Hi! I save prompts into your PromptArt account.\n\n".
        "To get started, go to <b>My Account → Telegram</b> on the site, tap <b>Connect Telegram</b> and send me the code you see there.\n\n".
        ':site',

    'codigo_invalido' => "Invalid or expired code.\n\n".
        'Generate a new one in <b>My Account → Telegram</b>. Each code is valid for :minutos minutes.',

    'codigo_muitas_tentativas' => 'Too many attempts. Wait an hour and try again.',

    'chat_de_outra_conta' => "This chat is already linked to another PromptArt account.\n\n".
        'Send <b>/desvincular confirmar</b> before linking a different one.',

    'vinculado' => "All set, :nome — your account is linked. ✅\n\n".
        "Now just send me a prompt like this:\n\n".
        "<code>/novo\nCinematic portrait\nCharacters\nclose-up, dramatic side lighting, 85mm lens</code>\n\n".
        'Use <b>/ajuda</b> whenever you need.',

    'nao_vinculado' => "This chat is not linked to any account yet.\n\n".
        'Go to <b>My Account → Telegram</b> on the site and send me the code from there.',

    'sem_comando' => 'I did not get that. Use <b>/novo</b> to save a prompt or <b>/ajuda</b> to see how.',

    'muitas_mensagens' => 'Easy there — too many messages too fast. Try again in a minute.',

    'ajuda' => "Send your prompt in four lines:\n\n".
        "<code>/novo\nCard name\nCategory\nThe prompt text</code>\n\n".
        "Or all in one line, separated by a pipe:\n\n".
        "<code>/novo Card name | Category | The prompt text</code>\n\n".
        "If the category does not exist, I create it.\n\n".
        "<b>/status</b> — see your account\n<b>/desvincular</b> — unlink this chat",

    'formato' => "Something is missing. The format is:\n\n".
        "<code>/novo\nCard name\nCategory\nThe prompt text</code>\n\n".
        'Use <b>/ajuda</b> to see an example.',

    'sem_assinatura' => "Your subscription is not active, so I cannot save this.\n\n".
        'Renew at :site and send the prompt again.',

    'titulo_longo' => 'The card name went over :max characters.',
    'categoria_longa' => 'The category name went over :max characters.',
    'texto_longo' => 'The prompt text went over :max characters.',

    'salvo' => "✅ Card <b>:titulo</b> saved in <b>:categoria</b>.\n\n:site",
    'salvo_categoria_nova' => "✅ Card <b>:titulo</b> saved.\nI created the category <b>:categoria</b> for it.\n\n:site",

    'status' => "Account: <b>:email</b>\nPlan: <b>:plano</b>\nPrompts created from here: <b>:n</b>",
    'status_plano_nenhum' => 'no active subscription',

    'desvincular_confirmar' => "Are you sure? This unlinks this chat from your account.\n\n".
        'Send <b>/desvincular confirmar</b> to proceed.',
    'desvinculado' => 'Done, this chat is no longer linked to any account.',

    'faq_nao_sei' => "I could not find a ready answer for that. 🤔\n\nI have noted your question and someone will get back to you. Meanwhile, see if one of these helps:",
    'faq_vazio' => 'The assistant is still being set up. Please try again later.',
    'faq_aviso_adm' => "🔔 <b>:n question(s)</b> waiting for an answer in the assistant.\n\n:site",
    'faq_dica_privacidade' => 'Tip: do not type passwords or payment details here.',
];

<?php

/* Respostas do bot. Saem no idioma da conta vinculada; antes de vincular,
   no idioma que o Telegram informa. */
return [
    'start_sem_codigo' => "Olá! Eu guardo prompts na sua conta do PromptArt.\n\n".
        "Para começar, entre em <b>Minha Conta → Telegram</b> no site, toque em <b>Conectar Telegram</b> e me mande o código que aparecer.\n\n".
        ':site',

    'codigo_invalido' => "Código inválido ou expirado.\n\n".
        'Gere um novo em <b>Minha Conta → Telegram</b> no site. Cada código vale por :minutos minutos.',

    'codigo_muitas_tentativas' => 'Muitas tentativas. Espere uma hora e tente de novo.',

    'chat_de_outra_conta' => "Esta conversa já está ligada a outra conta do PromptArt.\n\n".
        'Envie <b>/desvincular confirmar</b> antes de ligar a uma conta diferente.',

    'vinculado' => "Pronto, :nome — sua conta está vinculada. ✅\n\n".
        "Agora é só me mandar um prompt assim:\n\n".
        "<code>/novo\nRetrato cinematográfico\nPersonagem\nclose-up, luz lateral dramática, lente 85mm</code>\n\n".
        'Use <b>/ajuda</b> quando precisar.',

    'nao_vinculado' => "Esta conversa ainda não está ligada a nenhuma conta.\n\n".
        'Entre em <b>Minha Conta → Telegram</b> no site e me mande o código de lá.',

    'sem_comando' => 'Não entendi. Use <b>/novo</b> para cadastrar um prompt ou <b>/ajuda</b> para ver como.',

    'muitas_mensagens' => 'Calma aí — muitas mensagens em pouco tempo. Tente de novo em um minuto.',

    'ajuda' => "Mande seu prompt em quatro linhas:\n\n".
        "<code>/novo\nNome do card\nCategoria\nO texto do prompt</code>\n\n".
        "Ou tudo em uma linha, separado por barra vertical:\n\n".
        "<code>/novo Nome do card | Categoria | O texto do prompt</code>\n\n".
        "Se a categoria não existir, eu crio.\n\n".
        "<b>/status</b> — ver sua conta\n<b>/desvincular</b> — soltar esta conversa",

    'formato' => "Faltou alguma parte. O formato é:\n\n".
        "<code>/novo\nNome do card\nCategoria\nO texto do prompt</code>\n\n".
        'Use <b>/ajuda</b> para ver um exemplo.',

    'sem_assinatura' => "Sua assinatura não está ativa, então não consigo salvar.\n\n".
        'Renove em :site e me mande o prompt de novo.',

    'titulo_longo' => 'O nome do card passou de :max caracteres.',
    'categoria_longa' => 'O nome da categoria passou de :max caracteres.',
    'texto_longo' => 'O texto do prompt passou de :max caracteres.',

    'salvo' => "✅ Card <b>:titulo</b> salvo em <b>:categoria</b>.\n\n:site",
    'salvo_categoria_nova' => "✅ Card <b>:titulo</b> salvo.\nCriei a categoria <b>:categoria</b> para ele.\n\n:site",

    'status' => "Conta: <b>:email</b>\nPlano: <b>:plano</b>\nPrompts criados por aqui: <b>:n</b>",
    'status_plano_nenhum' => 'sem assinatura ativa',

    'desvincular_confirmar' => "Tem certeza? Isto solta esta conversa da sua conta.\n\n".
        'Mande <b>/desvincular confirmar</b> para seguir.',
    'desvinculado' => 'Pronto, esta conversa não está mais ligada a nenhuma conta.',

    'faq_nao_sei' => "Não encontrei uma resposta pronta para isso. 🤔\n\nJá anotei sua pergunta e alguém vai responder. Enquanto isso, veja se um dos assuntos abaixo ajuda:",
    'faq_vazio' => 'O assistente ainda está sendo preparado. Tente de novo mais tarde.',
    'faq_aviso_adm' => "🔔 <b>:n pergunta(s)</b> esperando resposta no assistente.\n\n:site",
    'faq_dica_privacidade' => 'Dica: não escreva senha nem dados de pagamento por aqui.',
];

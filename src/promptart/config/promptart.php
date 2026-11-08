<?php

return [

    // Idiomas oferecidos nas bandeirinhas. O primeiro é o padrão do site.
    'locales' => [
        'pt_BR' => ['label' => 'Português', 'flag' => '🇧🇷', 'html' => 'pt-BR'],
        'es' => ['label' => 'Español', 'flag' => '🇪🇸', 'html' => 'es'],
        'en' => ['label' => 'English', 'flag' => '🇺🇸', 'html' => 'en'],
    ],

    // Dias de trial gratuito ao registrar (guia §8: sugestão 7 dias)
    'trial_days' => (int) env('PROMPTART_TRIAL_DAYS', 7),

    'subscription' => [
        // Dias de tolerância após o fim do período contratado antes de cortar
        // o acesso (o Mercado Pago pode demorar a confirmar a renovação).
        'grace_days' => (int) env('PROMPTART_GRACE_DAYS', 3),
    ],

    'inactivity' => [
        // A partir de quantos dias sem entrar o usuário aparece como inativo
        'days' => (int) env('PROMPTART_INACTIVITY_DAYS', 60),
        // Prazo dado no aviso antes de sugerir a exclusão da conta
        'grace_days' => (int) env('PROMPTART_INACTIVITY_GRACE_DAYS', 30),
        // Teto de e-mails por dia no envio automático: o acúmulo sai aos poucos,
        // para não esbarrar no limite do Zoho nem cair no spam
        'daily_limit' => (int) env('PROMPTART_INACTIVITY_DAILY_LIMIT', 20),
    ],

    'storage' => [
        // Limite de armazenamento durante o trial (MB)
        'trial_mb' => (int) env('PROMPTART_TRIAL_STORAGE_MB', 200),

        // Padrão dos ADMs comuns; o master ajusta no painel (setting admin_storage_mb).
        // O próprio master é ilimitado — ver User::hasUnlimitedStorage().
        'admin_mb' => (int) env('PROMPTART_ADMIN_STORAGE_MB', 2048),

        // Tamanho máximo por arquivo (KB) — 2 MB
        'max_image_kb' => (int) env('PROMPTART_MAX_IMAGE_KB', 2048),
        'max_video_kb' => (int) env('PROMPTART_MAX_VIDEO_KB', 2048),
    ],

    'backup' => [
        // Onde ficam as cópias diárias. No servidor aponte para FORA da pasta
        // do site (ex.: /home/USUARIO/backups/promptart).
        'path' => env('PROMPTART_BACKUP_PATH', storage_path('backups')),

        // Pasta das fotos que entra no backup.
        'uploads_path' => env('PROMPTART_BACKUP_UPLOADS_PATH', storage_path('app/uploads')),

        'keep_days' => (int) env('PROMPTART_BACKUP_KEEP_DAYS', 30),
    ],

    'uploads' => [
        'allowed_mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
        // disco PRIVADO por padrão; troque para s3/r2 via env sem mudar código
        'disk' => env('PROMPTART_UPLOAD_DISK', 'uploads'),
    ],

    // Miniatura leve gerada no upload (o original fica guardado para o clique/ampliar).
    'thumbnail' => [
        'max_dimension' => (int) env('PROMPTART_THUMB_MAX_DIMENSION', 600), // maior lado, px
        'quality' => (int) env('PROMPTART_THUMB_QUALITY', 70),              // WebP 0-100
    ],

    // Google Analytics 4. Vazio = nenhum script de medição sai na página.
    // O ID tem a forma G-XXXXXXXXXX e vem do painel do Google Analytics.
    'analytics' => [
        'ga_id' => env('GOOGLE_ANALYTICS_ID', ''),
        // Por padrão só mede em produção: sem isso, cada teste no Mac vira
        // visita no relatório e os números do site ficam sujos.
        'em_local' => (bool) env('GOOGLE_ANALYTICS_EM_LOCAL', false),
    ],
];

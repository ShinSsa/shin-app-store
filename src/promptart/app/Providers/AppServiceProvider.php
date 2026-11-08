<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        /* Contador de pendências ao lado da aba do Assistente. Fica no menu
           do ADM, então precisa estar disponível em toda tela do painel —
           e só é consultado quando alguma delas é montada. */
        \Illuminate\Support\Facades\View::composer('admin.layout', function ($view) {
            $view->with(
                'pendentesAssistente',
                \App\Models\FaqQuestion::where('status', \App\Models\FaqQuestion::PENDENTE)->count()
            );
        });

        /**
         * Quem marcou "lembrar de mim" volta sem digitar a senha, e aí o login
         * do AuthController não roda. Sem isto a pessoa usa o app e continua
         * aparecendo como inativa, com a conta liberada para exclusão.
         * (O cadastro também dispara este evento, mas com remember = false.)
         */
        \Illuminate\Support\Facades\Event::listen(
            \Illuminate\Auth\Events\Login::class,
            function (\Illuminate\Auth\Events\Login $evento) {
                if ($evento->remember && $evento->user instanceof \App\Models\User) {
                    $evento->user->forceFill(['last_login_at' => now()])->save();
                }
            }
        );

        /**
         * O Laravel usa a MESMA frase no assunto e no botão do e-mail de
         * confirmação, o que deixa o botão com um texto longo demais.
         * Aqui o assunto explica e o botão age.
         */
        \Illuminate\Auth\Notifications\VerifyEmail::toMailUsing(
            fn ($notifiable, string $url) => (new \Illuminate\Notifications\Messages\MailMessage)
                ->subject(__('site.verify.mail_subject'))
                ->greeting(__('site.verify.mail_greeting', ['name' => explode(' ', (string) $notifiable->name)[0]]))
                ->line(__('site.verify.mail_line'))
                ->action(__('site.verify.mail_button'), $url)
                ->line(__('site.verify.mail_ignore'))
        );
    }
}

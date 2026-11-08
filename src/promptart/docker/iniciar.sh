#!/bin/sh
# Sobe o PromptArt pessoal: prepara a pasta de dados, a chave, o banco e liga o Apache.
set -e
DATA="${PROMPTART_DATA:-/data}"
APP=/var/www/html

mkdir -p "$DATA/storage/app/uploads" "$DATA/storage/framework/cache/data" \
         "$DATA/storage/framework/sessions" "$DATA/storage/framework/views" "$DATA/storage/logs"

# chave de criptografia: criada uma vez e guardada junto dos dados
if [ ! -s "$DATA/app.key" ]; then
  php -r 'echo "base64:".base64_encode(random_bytes(32));' > "$DATA/app.key"
fi
touch "$DATA/promptart.sqlite"

cat > "$APP/.env" <<ENV
APP_NAME=PromptArt
APP_ENV=production
APP_DEBUG=false
APP_KEY=$(cat "$DATA/app.key")
APP_LOCALE=pt_BR
APP_FALLBACK_LOCALE=pt_BR
APP_TIMEZONE=${TZ:-America/Sao_Paulo}
DB_CONNECTION=sqlite
DB_DATABASE=$DATA/promptart.sqlite
SESSION_DRIVER=file
SESSION_LIFETIME=525600
CACHE_STORE=file
QUEUE_CONNECTION=sync
LOG_CHANNEL=stderr
LOG_LEVEL=warning
MAIL_MAILER=log
PROMPTART_NOME=${PROMPTART_NOME:-Ramon}
PROMPTART_MAX_IMAGE_KB=51200
PROMPTART_MAX_VIDEO_KB=512000
ENV

chown -R 1000:1000 "$DATA" "$APP/bootstrap/cache"

cd "$APP"
su_php() { su -s /bin/sh promptart -c "$*"; }
su_php "php artisan migrate --force --no-interaction"
su_php "php artisan config:cache && php artisan route:cache && php artisan view:cache"

exec apache2-foreground

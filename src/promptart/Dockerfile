# PromptArt pessoal para o Umbrel (Laravel + SQLite + Apache)

# 1) dependências PHP, montadas na máquina do GitHub (rápido, sem emulação)
FROM --platform=$BUILDPLATFORM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts

# 2) imagem final
FROM php:8.4-apache
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN install-php-extensions gd zip exif intl \
 && groupadd -g 1000 promptart && useradd -u 1000 -g 1000 -M -s /usr/sbin/nologin promptart \
 && a2enmod rewrite \
 && rm -f /etc/apache2/sites-enabled/000-default.conf \
 && sed -i 's/^Listen 80$//' /etc/apache2/ports.conf

COPY docker/apache.conf /etc/apache2/sites-enabled/promptart.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/promptart.ini
COPY docker/iniciar.sh /usr/local/bin/iniciar-promptart

WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html
RUN rm -rf storage ferramentas docker Dockerfile VERSION \
 && ln -s /data/storage storage \
 && php artisan package:discover --ansi \
 && chown -R 1000:1000 bootstrap/cache

# o Apache roda os processos PHP com o mesmo usuário dos arquivos do Umbrel
ENV APACHE_RUN_USER=promptart APACHE_RUN_GROUP=promptart PROMPTART_DATA=/data
EXPOSE 8798
CMD ["iniciar-promptart"]

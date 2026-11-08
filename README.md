# Loja do Shin — loja da comunidade para o Umbrel

Apps pessoais do Ramon para o umbrelOS.

## Como adicionar no Umbrel
App Store → menu ⋯ (canto superior) → **Community App Stores** → cole
`https://github.com/ShinSsa/shin-app-store` → **Add**.

## Apps
| App | Pasta | Imagem Docker |
|---|---|---|
| Estúdio do Shin | `shin-estudio-do-shin` | `ghcr.io/shinssa/estudio-do-shin` |
| Ramotion | `shin-ramotion` | `ghcr.io/shinssa/ramotion` |
| Escola do Shin | `shin-escola-do-shin` | `ghcr.io/shinssa/escola-do-shin` |

## Atualizar um app
1. Troque os arquivos em `src/<app>/` e aumente o número em `src/<app>/VERSION`.
2. O GitHub monta a imagem nova sozinho (aba **Actions**).
3. Atualize `version` no `umbrel-app.yml` e a tag da imagem no `docker-compose.yml` do app.
4. No Umbrel, o app mostra que há atualização.

## Escola do Shin: apontar as pastas
Depois de instalar, clique com o botão direito no ícone › configurações ›
**Acesso às suas pastas** › **Acesso avançado a pastas**. Em cada pasta abaixo, use **Alterar**:

| Caminho no app | Aponte para | Permissão |
|---|---|---|
| `/cursos` | Home › Videos › Cursos | Somente leitura |
| `/dados` | Home › escola-do-shin › dados (progresso e anotações) | Leitura e gravação |

Mais de uma pasta de cursos (ex.: HD externo): **Adicionar pasta personalizada** › serviço `web`, caminho `/cursos2` (e `/cursos3` para uma terceira), somente leitura.

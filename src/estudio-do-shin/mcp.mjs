#!/usr/bin/env node
// =========================================================
// Estúdio do Shin — servidor MCP para o Claude
// Sem dependências. O Claude roda este arquivo; ele conversa com o
// servidor local (server.mjs), que repassa os pedidos ao app aberto no navegador.
// Requisitos: iniciar.command rodando + app aberto em http://localhost:8787
// =========================================================
import readline from 'node:readline';

const BASE = (process.env.SHIN_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const RATIOS = ['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '4:5', '5:4', '21:9'];

const TOOLS = [
  {
    name: 'status',
    description: 'Mostra o que o Estúdio do Shin tem disponível: provedores e modelos de imagem (e quais estão prontos para uso), projetos, elementos (@personagens/locais/objetos), modelo selecionado e crédito do Google. Chame antes de gerar se não souber qual modelo usar.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'generate_image',
    description: 'Gera imagens no Estúdio do Shin. As imagens aparecem na galeria do app, são salvas na pasta do disco e voltam aqui para você ver. Escreva o prompt em inglês e bem detalhado. Use @handle para incluir elementos cadastrados (ex.: @valdir). Para usar imagens da galeria como referência, passe os IDs em reference_ids (modelos Gemini e Runware aceitam referência; Pollinations e Qwen não).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt da imagem (de preferência em inglês).' },
        model: { type: 'string', description: 'ID ou nome do modelo (ex.: gemini-3.1-flash-image, "Nano Banana Pro", "Z Image Turbo"). Vazio = o selecionado no app.' },
        ratio: { type: 'string', enum: RATIOS, description: 'Proporção. Vazio = a do app.' },
        resolution: { type: 'string', enum: ['1K', '2K', '4K'], description: 'Só faz diferença no Gemini.' },
        count: { type: 'integer', minimum: 1, maximum: 4, description: 'Quantas imagens (padrão 1).' },
        project: { type: 'string', description: 'Nome do projeto onde salvar (é criado se não existir). Vazio = projeto aberto no app.' },
        reference_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de imagens da galeria para usar como referência.' },
        reference_types: { type: 'array', items: { type: 'string', enum: ['style', 'char', 'place', 'obj', 'free'] }, description: 'Tipo de cada referência, na mesma ordem (estilo, personagem, cenário, objeto, livre).' },
        improve_prompt: { type: 'boolean', description: 'Pedir para o Gemini reescrever o prompt antes (normalmente desnecessário: você já escreve bem).' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'edit_image',
    description: 'Edita uma imagem da galeria com o Gemini (a imagem toda, por instrução). Ex.: "troque o fundo por uma praia ao pôr do sol", "deixe em estilo aquarela". O resultado vira uma nova imagem na galeria.',
    inputSchema: {
      type: 'object',
      properties: {
        image_id: { type: 'string' },
        instruction: { type: 'string', description: 'O que mudar (pode ser em português ou inglês).' },
        model: { type: 'string', description: 'Modelo Gemini (padrão: o primeiro da lista, Nano Banana 2).' }
      },
      required: ['image_id', 'instruction']
    }
  },
  {
    name: 'list_images',
    description: 'Lista as imagens e vídeos da galeria (mais recentes primeiro) com ID, tipo, prompt, modelo, projeto e arquivo no disco.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Padrão 20.' },
        query: { type: 'string', description: 'Filtra pelo texto do prompt.' },
        project: { type: 'string', description: 'Nome do projeto (ou "Sem projeto").' },
        favorites: { type: 'boolean', description: 'Só favoritas.' },
        kind: { type: 'string', enum: ['image', 'video'], description: 'Só imagens ou só vídeos.' }
      }
    }
  },
  {
    name: 'get_image',
    description: 'Mostra uma imagem da galeria para você ver (e os dados dela).',
    inputSchema: { type: 'object', properties: { image_id: { type: 'string' }, max_size: { type: 'integer', minimum: 256, maximum: 1600, description: 'Lado maior em px (padrão 1024).' } }, required: ['image_id'] }
  },
  {
    name: 'list_projects',
    description: 'Lista os projetos e quantas imagens cada um tem.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_project',
    description: 'Cria um projeto novo no app.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'move_images',
    description: 'Move imagens para um projeto (o arquivo no disco também muda de pasta). Use project vazio para "Sem projeto".',
    inputSchema: { type: 'object', properties: { image_ids: { type: 'array', items: { type: 'string' } }, project: { type: 'string' } }, required: ['image_ids'] }
  },
  {
    name: 'favorite_image',
    description: 'Marca ou desmarca uma imagem como favorita.',
    inputSchema: { type: 'object', properties: { image_id: { type: 'string' }, favorite: { type: 'boolean' } }, required: ['image_id'] }
  },
  {
    name: 'generate_video_scene',
    description: 'Gera uma cena de vídeo com o Veo e coloca na sequência do projeto (aba Vídeo do app). Por padrão a cena começa do ÚLTIMO QUADRO da cena anterior, para o vídeo continuar sem cortes (multishot). Leva de 1 a 3 minutos. Custa crédito do Google (Veo 3.1 Fast ≈ US$0,15/s; Veo 3.1 ≈ US$0,40/s). Escreva o prompt em inglês descrevendo ação, câmera, luz e som. Devolve o último quadro para você conferir a continuidade.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrição da cena (ação, câmera, luz, som, falas entre aspas).' },
        model: { type: 'string', enum: ['Veo 3.1 Fast', 'Veo 3.1'], description: 'Padrão: o escolhido no app (Veo 3.1 Fast).' },
        duration: { type: 'integer', enum: [4, 6, 8], description: 'Segundos (padrão 8).' },
        ratio: { type: 'string', enum: ['16:9', '9:16'] },
        resolution: { type: 'string', enum: ['720p', '1080p'] },
        audio: { type: 'boolean', description: 'Gerar som (padrão sim).' },
        continue_previous: { type: 'boolean', description: 'Começar do último quadro da cena anterior (padrão true). Use false para uma cena nova do zero.' },
        after_scene: { type: 'integer', minimum: 1, description: 'Inserir depois desta cena (e continuar dela). Vazio = no fim.' },
        start_image_id: { type: 'string', description: 'ID de imagem da galeria para ser o primeiro quadro (substitui a continuação).' },
        end_image_id: { type: 'string', description: 'ID de imagem da galeria para ser o último quadro (o Veo cria o movimento até ela).' },
        project: { type: 'string', description: 'Projeto da sequência (criado se não existir). Vazio = o aberto no app.' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'list_video_scenes',
    description: 'Lista as cenas da sequência de vídeo de um projeto, em ordem, com prompt, duração e arquivo.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } } }
  },
  {
    name: 'join_video',
    description: 'Junta todas as cenas prontas da sequência num vídeo único (mp4) na pasta do projeto. Precisa do ffmpeg no Mac (brew install ffmpeg).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } } }
  },
  {
    name: 'delete_video_scene',
    description: 'Apaga uma cena da sequência (o arquivo vai para a _Lixeira).',
    inputSchema: { type: 'object', properties: { scene: { type: 'integer', minimum: 1 }, project: { type: 'string' } }, required: ['scene'] }
  },
  {
    name: 'save_template',
    description: 'Salva um prompt como template no app (aparece digitando / na barra de prompt). Use [colchetes] para os campos a trocar.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' } }, required: ['name', 'text'] }
  }
];

async function call(cmd, args) {
  let r;
  try { r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd, args }) }); }
  catch { throw new Error('O servidor do Estúdio do Shin está desligado. Dê dois cliques em iniciar.command e abra http://localhost:8787 no navegador.'); }
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j.result;
}

// separa imagens (base64) do texto para devolver como conteúdo de imagem
function toContent(result) {
  const content = [], images = [];
  const strip = o => {
    if (Array.isArray(o)) return o.map(strip);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) {
        if (k === 'image' && v && v.data) { images.push(v); out.image = `(imagem ${images.length} abaixo)`; }
        else out[k] = strip(v);
      }
      return out;
    }
    return o;
  };
  const clean = strip(result);
  content.push({ type: 'text', text: JSON.stringify(clean, null, 2) });
  for (const im of images) content.push({ type: 'image', data: im.data, mimeType: im.mime || 'image/jpeg' });
  return content;
}

const send = msg => process.stdout.write(JSON.stringify(msg) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  if (!line.trim()) return;
  let m; try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m;
  const reply = result => id !== undefined && send({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => id !== undefined && send({ jsonrpc: '2.0', id, error: { code, message } });
  try {
    if (method === 'initialize') return reply({
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'estudio-do-shin', version: '1.0.0' },
      instructions: 'Ferramentas do Estúdio do Shin, o estúdio de imagens com IA do Ramon. O app precisa estar aberto no navegador (http://localhost:8787). Prefira prompts em inglês, detalhados. Gerações com Gemini gastam crédito do Google Cloud do Ramon; Pollinations e Qwen (ModelScope) são grátis. Vídeo: use generate_video_scene em sequência para montar um filme por cenas; cada cena continua do último quadro da anterior. Confira os modelos prontos com status antes de escolher um.'
    });
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: TOOLS });
    if (method === 'tools/call') {
      const name = params?.name, args = params?.arguments || {};
      if (!TOOLS.some(t => t.name === name)) return fail(-32602, 'Ferramenta desconhecida: ' + name);
      try { return reply({ content: toContent(await call(name, args)) }); }
      catch (e) { return reply({ content: [{ type: 'text', text: 'Erro: ' + e.message }], isError: true }); }
    }
    if (method?.startsWith('notifications/')) return;
    if (method === 'resources/list') return reply({ resources: [] });
    if (method === 'prompts/list') return reply({ prompts: [] });
    fail(-32601, 'Método não suportado: ' + method);
  } catch (e) { fail(-32603, e.message); }
});

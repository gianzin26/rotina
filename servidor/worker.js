// servidor/worker.js — Cloudflare Worker que guarda o estado por código.
//
// Faz uma coisa só: GET devolve o documento daquele código, PUT o substitui.
// Não sabe nada sobre rotina, peso ou sono — para ele é um JSON opaco.
//
// O código é a única credencial. Quem tiver o código lê e escreve; por isso
// ele é gerado com 12 caracteres aleatórios e nunca aparece na URL de nada
// que seja compartilhado.

const LIMITE = 2 * 1024 * 1024; // o estado real tem ~36 KB; 2 MB já é folga enorme

export default {
  async fetch(pedido, ambiente) {
    const url = new URL(pedido.url);
    const codigo = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    const cors = {
      'Access-Control-Allow-Origin': ambiente.ORIGEM || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    };

    if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // 12 a 40 caracteres do alfabeto do gerador, mais os hífens
    if (!/^[a-z0-9-]{12,40}$/.test(codigo)) {
      return new Response('código inválido', { status: 400, headers: cors });
    }

    if (pedido.method === 'GET') {
      const guardado = await ambiente.ROTINA.get(codigo);
      if (guardado === null) return new Response('sem dados ainda', { status: 404, headers: cors });
      return new Response(guardado, { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (pedido.method === 'PUT') {
      const corpo = await pedido.text();
      if (corpo.length > LIMITE) return new Response('grande demais', { status: 413, headers: cors });
      try { JSON.parse(corpo); } catch { return new Response('JSON inválido', { status: 400, headers: cors }); }
      await ambiente.ROTINA.put(codigo, corpo);
      return new Response('ok', { status: 200, headers: cors });
    }

    return new Response('método não suportado', { status: 405, headers: cors });
  },
};

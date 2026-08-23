// servidor/worker.js — guarda o estado por código, e recebe corridas do atalho.
//
// Faz duas coisas, e nada além disso:
//
//   GET    /codigo        devolve o documento           PUT /codigo   substitui
//   GET    /codigo/gpx    devolve as corridas na fila   POST /codigo/gpx  enfileira
//   DELETE /codigo/gpx    esvazia a fila
//
// Não sabe o que é uma corrida: para ele o documento é JSON opaco e o GPX é
// texto. Quem interpreta é o app, num lugar só.
//
// O código é a única credencial. Quem o tiver lê e escreve.

const LIMITE_DOC = 2 * 1024 * 1024;   // o estado real tem ~40 KB; folga enorme
const LIMITE_GPX = 4 * 1024 * 1024;   // um GPX de corrida longa não passa disso
const FILA_MAX = 10;                  // corridas esperando o app abrir

export default {
  async fetch(pedido, ambiente) {
    const url = new URL(pedido.url);
    const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [codigo, secao] = partes;

    const cors = {
      'Access-Control-Allow-Origin': ambiente.ORIGEM || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    };
    const responder = (corpo, status = 200, extra = {}) =>
      new Response(corpo, { status, headers: { ...cors, ...extra } });

    if (pedido.method === 'OPTIONS') return responder(null, 204);

    if (!/^[a-z0-9-]{12,40}$/.test(codigo || '')) return responder('código inválido', 400);
    if (partes.length > 2 || (secao && secao !== 'gpx')) return responder('caminho desconhecido', 404);

    /* ---------- a fila de corridas que o atalho enviou ---------- */
    if (secao === 'gpx') {
      const chave = `${codigo}:gpx`;

      if (pedido.method === 'POST') {
        const corpo = await pedido.text();
        if (corpo.length > LIMITE_GPX) return responder('arquivo grande demais', 413);
        if (!corpo.includes('<trkpt')) return responder('não parece um GPX com trajeto', 400);

        const fila = JSON.parse((await ambiente.ROTINA.get(chave)) || '[]');
        fila.push({ em: Date.now(), gpx: corpo });
        // a fila é caixa de entrada, não arquivo: o mais velho sai primeiro
        await ambiente.ROTINA.put(chave, JSON.stringify(fila.slice(-FILA_MAX)));
        return responder(`recebida (${fila.length} na fila)`);
      }

      if (pedido.method === 'GET') {
        const fila = (await ambiente.ROTINA.get(chave)) || '[]';
        return responder(fila, 200, { 'Content-Type': 'application/json' });
      }

      if (pedido.method === 'DELETE') {
        await ambiente.ROTINA.delete(chave);
        return responder('fila esvaziada');
      }

      return responder('método não suportado', 405);
    }

    /* ---------- o documento da sincronização ---------- */
    if (pedido.method === 'GET') {
      const guardado = await ambiente.ROTINA.get(codigo);
      if (guardado === null) return responder('sem dados ainda', 404);
      return responder(guardado, 200, { 'Content-Type': 'application/json' });
    }

    if (pedido.method === 'PUT') {
      const corpo = await pedido.text();
      if (corpo.length > LIMITE_DOC) return responder('grande demais', 413);
      try { JSON.parse(corpo); } catch { return responder('JSON inválido', 400); }
      await ambiente.ROTINA.put(codigo, corpo);
      return responder('ok');
    }

    return responder('método não suportado', 405);
  },
};

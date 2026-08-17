// sw.js — cache do app para funcionar offline.
//
// VERSAO é carimbada por ferramentas/versionar.js a partir do conteúdo dos
// arquivos, e o workflow de publicação roda essa ferramenta sozinho. Não edite
// à mão: mudou um byte do app, muda a versão; não mudou, ela fica igual.
//
// O worker novo NÃO assume sozinho. Ele espera, o app mostra o aviso de versão
// nova e só troca quando a pessoa toca em Atualizar — assim nenhuma tela fica
// com metade dos arquivos velhos e metade novos.

const VERSAO = 'rotina-d3a747e867f3';

const ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './js/nucleo/acoes.js',
  './js/nucleo/aderencia.js',
  './js/nucleo/agenda.js',
  './icons/nav/visao.png',
  './icons/nav/hoje.png',
  './icons/nav/semana.png',
  './icons/nav/treino.png',
  './icons/nav/corpo.png',
  './icons/nav/ajustes.png',
  './js/nucleo/creatina.js',
  './js/nucleo/cronometro.js',
  './js/nucleo/demo.js',
  './js/nucleo/janelas.js',
  './js/nucleo/metas.js',
  './js/nucleo/deslocamento.js',
  './js/nucleo/peso.js',
  './js/nucleo/resumo.js',
  './js/nucleo/store.js',
  './js/nucleo/treino.js',
  './js/nucleo/util.js',
  './js/ui/alarme.js',
  './js/ui/arquivos.js',
  './js/ui/atualizacao.js',
  './js/ui/cartao.js',
  './js/ui/dom.js',
  './js/ui/folha.js',
  './js/ui/grafico.js',
  './js/ui/icones.js',
  './js/ui/linhaDoTempo.js',
  './js/ui/periodo.js',
  './js/ui/telas/ajustes.js',
  './js/ui/telas/corpo.js',
  './js/ui/telas/hoje.js',
  './js/ui/telas/semana.js',
  './js/ui/telas/treino.js',
  './js/ui/telas/visaoGeral.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    // addAll falha inteiro se um arquivo faltar; adiciona um a um para ser tolerante
    await Promise.all(ARQUIVOS.map((a) => cache.add(a).catch(() => null)));
  })());
});

// O app pede a troca depois que a pessoa aceita o aviso de versão nova.
self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'ATUALIZAR') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navegação: tenta a rede para pegar versão nova, cai no cache se estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const resposta = await fetch(req);
        const cache = await caches.open(VERSAO);
        cache.put('./index.html', resposta.clone());
        return resposta;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Demais arquivos: responde do cache e atualiza por trás.
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(req);
    const rede = fetch(req).then((resposta) => {
      if (resposta && resposta.ok) cache.put(req, resposta.clone());
      return resposta;
    }).catch(() => null);
    return guardado || (await rede) || Response.error();
  })());
});

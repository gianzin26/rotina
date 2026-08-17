// ui/atualizacao.js — registra o service worker e avisa quando há versão nova.
//
// O worker novo instala e fica esperando. Só troca quando a pessoa toca em
// Atualizar: aí ele assume, a página recarrega e todos os arquivos vêm da mesma
// versão. Nada de tela montada com metade dos arquivos antigos.

import { h, limpar } from './dom.js';
import { icone } from './icones.js';

const INTERVALO = 30 * 60 * 1000; // procura versão nova a cada meia hora

let barra = null;

export function iniciarAtualizacoes() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // já havia uma versão instalada esperando de uma visita anterior
    if (reg.waiting && navigator.serviceWorker.controller) mostrarAviso(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        // sem controller é a primeira instalação: não há o que avisar
        if (novo.state === 'installed' && navigator.serviceWorker.controller) mostrarAviso(novo);
      });
    });

    const procurar = () => reg.update().catch(() => {});
    setInterval(procurar, INTERVALO);
    // no iPhone o app fica suspenso; ao voltar para a tela, procura de novo
    document.addEventListener('visibilitychange', () => { if (!document.hidden) procurar(); });
    window.addEventListener('online', procurar);
  }).catch((e) => console.warn('SW não registrado', e));

  // quando o worker novo assume, recarrega uma única vez
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });
}

function mostrarAviso(trabalhador) {
  if (barra) return;

  const aplicar = () => {
    limpar(botao).append(icone('zerar'), 'Atualizando…');
    botao.disabled = true;
    trabalhador.postMessage({ tipo: 'ATUALIZAR' });
  };

  const botao = h('button', { class: 'botao primario', onclick: aplicar }, icone('baixar'), 'Atualizar');

  barra = h('div', {
    class: 'barra-atualizacao', role: 'status', 'aria-live': 'polite',
  },
    h('div', { class: 'atualizacao-texto' },
      h('span', { class: 'atualizacao-titulo' }, 'Nova versão disponível'),
      h('span', { class: 'atualizacao-sub' }, 'Atualize para receber as mudanças.')),
    botao,
    h('button', {
      class: 'icone-botao', 'aria-label': 'Agora não',
      onclick: () => { barra.remove(); barra = null; },
    }, icone('fechar')));

  document.body.append(barra);
  requestAnimationFrame(() => barra.classList.add('visivel'));
}

// app.js — casca do app: abas, rota por hash e o ciclo de redesenho.

import { carregar, definirRelatorDeFalha } from './js/nucleo/store.js';
import { iniciarAtualizacoes } from './js/ui/atualizacao.js';
import { $, h, limpar } from './js/ui/dom.js';
import { icone } from './js/ui/icones.js';
import * as ajustes from './js/ui/telas/ajustes.js';
import * as hoje from './js/ui/telas/hoje.js';
import * as insights from './js/ui/telas/insights.js';
import * as peso from './js/ui/telas/peso.js';
import * as treino from './js/ui/telas/treino.js';

const ABAS = [
  { id: 'hoje', rotulo: 'Hoje', view: hoje },
  { id: 'insights', rotulo: 'Insights', view: insights },
  { id: 'treino', rotulo: 'Treino', view: treino },
  { id: 'peso', rotulo: 'Peso', view: peso },
  { id: 'ajustes', rotulo: 'Ajustes', view: ajustes },
];

let abaAtual = 'hoje';

const tela = $('#tela');
const rodape = $('#rodape');

function montarNavegacao() {
  const lateral = $('#lateral');
  const abas = $('#abas');
  limpar(lateral);
  limpar(abas);

  lateral.append(h('div', { class: 'marca' }, icone('hoje', { classe: 'icone-g' }), 'Rotina'));

  for (const alvo of [abas, lateral]) {
    for (const aba of ABAS) {
      alvo.append(h('button', {
        class: `aba ${aba.id === abaAtual ? 'ativa' : ''}`,
        'aria-current': aba.id === abaAtual ? 'page' : null,
        onclick: () => ir(aba.id),
      }, icone(aba.id), h('span', {}, aba.rotulo)));
    }
  }
}

const ctx = {
  rodape,
  ir(id) { ir(id); },
  recarregar() { desenhar(); },
};

function desenhar(preservarRolagem = true) {
  const y = tela.scrollTop;
  limpar(tela);
  limpar(rodape);
  const aba = ABAS.find((a) => a.id === abaAtual) || ABAS[0];
  document.body.dataset.aba = aba.id;
  aba.view.render(tela, ctx);
  if (preservarRolagem) tela.scrollTop = y;
}

function ir(id) {
  if (!ABAS.some((a) => a.id === id)) id = 'hoje';
  const mudou = id !== abaAtual;
  abaAtual = id;
  if (location.hash.slice(1) !== id) location.hash = id;
  montarNavegacao();
  desenhar(!mudou);
  if (mudou) window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', () => ir(location.hash.slice(1) || 'hoje'));

const editando = (no) => !!no && (/^(INPUT|TEXTAREA|SELECT)$/.test(no.tagName) || no.isContentEditable);

/* Atalhos de teclado — registro rápido no desktop. */
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (editando(e.target) || editando(document.activeElement)) return;
  if (document.querySelector('.folha-fundo')) return;
  const indice = Number(e.key) - 1;
  if (indice >= 0 && indice < ABAS.length) { ir(ABAS[indice].id); return; }
  if (e.key.toLowerCase() === 'r' && abaAtual === 'hoje') {
    $('.barra-acao .botao-acao')?.click();
  }
});

/* O minuto virou: o marcador de agora e o botão contextual mudam sozinhos. */
setInterval(() => {
  if (abaAtual !== 'hoje') return;
  if (document.querySelector('.folha-fundo')) return;
  if (editando(document.activeElement)) return;
  desenhar();
}, 60000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && abaAtual === 'hoje') desenhar();
});

/* Redesenha quando outra aba do navegador grava no mesmo localStorage. */
window.addEventListener('storage', () => { carregar(); desenhar(); });

definirRelatorDeFalha((mensagem) => alert(mensagem));

carregar();
ir(location.hash.slice(1) || 'hoje');

window.addEventListener('load', iniciarAtualizacoes);

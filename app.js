// app.js — casca do app: abas, rota por hash e o ciclo de redesenho.

import { carregar, definirRelatorDeFalha } from './js/nucleo/store.js';
import { iniciarAtualizacoes } from './js/ui/atualizacao.js';
import { $, h, limpar } from './js/ui/dom.js';
import { icone } from './js/ui/icones.js';
import * as ajustes from './js/ui/telas/ajustes.js';
import * as corpo from './js/ui/telas/corpo.js';
import * as hoje from './js/ui/telas/hoje.js';
import * as semana from './js/ui/telas/semana.js';
import * as treino from './js/ui/telas/treino.js';
import * as visaoGeral from './js/ui/telas/visaoGeral.js';

/* Visão geral só entra na navegação onde há espaço para a grade densa.
   No celular a lista de abas começa em Hoje, que é a tela de uso. */
const VISAO_GERAL = { id: 'visao', rotulo: 'Visão geral', view: visaoGeral, soComputador: true };

const ABAS = [
  VISAO_GERAL,
  { id: 'hoje', rotulo: 'Hoje', view: hoje },
  { id: 'semana', rotulo: 'Semana', view: semana },
  { id: 'treino', rotulo: 'Treino', view: treino },
  { id: 'corpo', rotulo: 'Corpo', view: corpo },
  { id: 'ajustes', rotulo: 'Ajustes', view: ajustes },
];

const noComputador = () => window.matchMedia('(min-width: 900px)').matches;
const abaInicial = () => (noComputador() ? 'visao' : 'hoje');

let abaAtual = abaInicial();

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
      // no celular a barra inferior não mostra Visão geral
      if (aba.soComputador && alvo === abas) continue;
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
  const alvo = ABAS.find((a) => a.id === id);
  if (!alvo || (alvo.soComputador && !noComputador())) id = abaInicial();
  const mudou = id !== abaAtual;
  abaAtual = id;
  if (location.hash.slice(1) !== id) location.hash = id;
  montarNavegacao();
  desenhar(!mudou);
  if (mudou) window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', () => ir(location.hash.slice(1) || abaInicial()));

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
ir(location.hash.slice(1) || abaInicial());

/* Girar o aparelho ou redimensionar a janela pode tirar Visão geral do ar. */
window.matchMedia('(min-width: 900px)').addEventListener('change', () => {
  montarNavegacao();
  if (abaAtual === 'visao' && !noComputador()) ir('hoje');
});

window.addEventListener('load', iniciarAtualizacoes);

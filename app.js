// app.js — casca do app: abas, rota por hash e o ciclo de redesenho.

import { desligar as desligarDemo, ligado as demoLigado } from './js/nucleo/demo.js';
import { configurada as sincConfigurada, observarEscritas, sincronizar } from './js/nucleo/nuvem.js';
import { carregar, definirRelatorDeFalha } from './js/nucleo/store.js';
import { iniciarAtualizacoes } from './js/ui/atualizacao.js';
import { aviso as avisar } from './js/ui/folha.js';
import { $, h, limpar, variaveis } from './js/ui/dom.js';
import { icone } from './js/ui/icones.js';
import { aplicarTema, observarSistema } from './js/ui/tema.js';
import * as ajustes from './js/ui/telas/ajustes.js';
import * as corpo from './js/ui/telas/corpo.js';
import * as dinheiro from './js/ui/telas/dinheiro.js';
import * as hoje from './js/ui/telas/hoje.js';
import * as semana from './js/ui/telas/semana.js';
import * as treino from './js/ui/telas/treino.js';
import * as visaoGeral from './js/ui/telas/visaoGeral.js';

/* Visão geral existe nos dois tamanhos. No celular só o rótulo encolhe, para
   caber seis abas na barra; a tela inicial continua sendo Hoje. */
const VISAO_GERAL = { id: 'visao', rotulo: 'Visão geral', rotuloCurto: 'Geral', view: visaoGeral };

const ABAS = [
  VISAO_GERAL,
  { id: 'hoje', rotulo: 'Hoje', view: hoje },
  { id: 'semana', rotulo: 'Semana', view: semana },
  { id: 'treino', rotulo: 'Treino', view: treino },
  { id: 'corpo', rotulo: 'Corpo', view: corpo },
  { id: 'dinheiro', rotulo: 'Finanças', view: dinheiro },
  { id: 'ajustes', rotulo: 'Ajustes', view: ajustes },
];

/* Os arquivos do Icons8 têm áreas de tinta bem diferentes — medi no PNG: o
   halter ocupa 46 dos 48px de largura, a lista só 32. Desenhados na mesma
   caixa, Treino aparece maior que os vizinhos.

   A escala normaliza a MAIOR dimensão de tinta em 34/48 para todos. É ajuste
   de exibição: o desenho continua o do arquivo, sem redesenho. */
/* Só estas abas têm arte do Icons8. As demais caem no traçado desenhado, para
   uma aba nova nunca aparecer sem ícone enquanto a arte não chega. */
const COM_ARTE = new Set(['visao', 'hoje', 'semana', 'treino', 'corpo', 'ajustes']);

const ESCALA_ICONE = {
  visao: 1,        // tinta 34x34
  hoje: 1.06,      // 32x24
  semana: 1.06,    // 32x30
  treino: 0.74,    // 46x28  <= o que destoava
  corpo: 0.89,     // 38x35
  ajustes: 1,      // 34x34
};

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
      // a barra inferior é estreita: usa o rótulo curto quando existe
      const rotulo = alvo === abas ? aba.rotuloCurto || aba.rotulo : aba.rotulo;
      // o ícone do menu é a arte original, aplicada como máscara para receber
      // a cor do CSS; a forma vem do arquivo, sem redesenho
      alvo.append(h('button', {
        class: `aba ${aba.id === abaAtual ? 'ativa' : ''}`,
        'aria-label': rotulo === aba.rotulo ? null : aba.rotulo,
        'aria-current': aba.id === abaAtual ? 'page' : null,
        onclick: () => ir(aba.id),
      }, COM_ARTE.has(aba.id)
        ? variaveis(h('span', { class: 'aba-icone', 'aria-hidden': 'true' }), {
          'arte-aba': `url("./icons/nav/${aba.id}.png")`,
          'escala-aba': ESCALA_ICONE[aba.id] ?? 1,
        })
        : icone(aba.id, { classe: 'aba-icone-traco' }),
      h('span', {}, rotulo)));
    }
  }
}

const ctx = {
  rodape,
  ir(id) { ir(id); },
  recarregar() { desenhar(); },
};

/* A faixa fica sempre visível durante a demonstração: sem ela é fácil registrar
   algo de verdade sobre dados falsos e perder ao desligar. */
function faixaDemo() {
  const marca = document.body.dataset.demo === 'sim';
  if (demoLigado() === marca) return;
  document.body.dataset.demo = demoLigado() ? 'sim' : 'nao';
  $('#faixa-demo')?.remove();
  if (!demoLigado()) return;
  document.body.prepend(h('div', { class: 'faixa-demo', id: 'faixa-demo', role: 'status' },
    icone('alvo'),
    h('span', {}, 'Modo demonstração · dados de exemplo'),
    h('button', {
      class: 'faixa-demo-sair',
      onclick: () => { try { desligarDemo(); } catch { /* a tela Ajustes explica */ } ir('ajustes'); },
    }, 'Sair')));
}

function desenhar(preservarRolagem = true) {
  const y = tela.scrollTop;
  limpar(tela);
  limpar(rodape);
  faixaDemo();
  const aba = ABAS.find((a) => a.id === abaAtual) || ABAS[0];
  document.body.dataset.aba = aba.id;
  aba.view.render(tela, ctx);
  if (preservarRolagem) tela.scrollTop = y;
}

function ir(id) {
  // hash desconhecido (link velho, digitação) cai na tela inicial do aparelho
  if (!ABAS.some((a) => a.id === id)) id = abaInicial();
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

/* Tema antes de desenhar, para não haver um piscar claro no escuro. */
aplicarTema();
observarSistema();

definirRelatorDeFalha((mensagem) => alert(mensagem));

carregar();
observarEscritas();
ir(location.hash.slice(1) || abaInicial());

/* Sincroniza ao abrir, ao voltar para o app e quando a rede volta. Um envio de
   cada vez, e o redesenho só acontece se algo mudou de verdade. */
let sincronizando = false;
async function sincronizarSePuder() {
  if (sincronizando || !sincConfigurada()) return;
  sincronizando = true;
  try {
    const r = await sincronizar();
    if (r.estado !== 'sincronizado') return;
    desenhar();
    if (r.corridasNovas) {
      avisar(r.corridasNovas === 1
        ? 'Uma corrida chegou do atalho.'
        : `${r.corridasNovas} corridas chegaram do atalho.`);
    }
  } finally {
    sincronizando = false;
  }
}
sincronizarSePuder();
window.addEventListener('online', sincronizarSePuder);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizarSePuder(); });

/* Girar o aparelho ou redimensionar a janela troca a barra pela lateral, e com
   isso o rótulo de Visão geral. A aba em si continua onde estava. */
window.matchMedia('(min-width: 900px)').addEventListener('change', montarNavegacao);

window.addEventListener('load', iniciarAtualizacoes);

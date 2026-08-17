// ui/linhaDoTempo.js — o eixo do dia, com o real desenhado sobre o previsto.
//
// O JS só informa minutos; quantos pixels vale um minuto é decisão do CSS
// (--lt-px-minuto). Por isso a janela vai daqui em minutos, não em pixels.

import { blocosSono, ocorrencias } from '../nucleo/agenda.js';
import { agoraNoDia } from '../nucleo/acoes.js';
import { diaLogico, fmtDesvio, hhmm } from '../nucleo/util.js';
import { classeSituacao, h } from './dom.js';
import { icone, iconeDoTipo } from './icones.js';

const INICIO = 300;   // 5:00 — começo da régua
const FIM = 1440;     // 00:00 — fim da régua

const dentro = (m) => Math.max(INICIO, Math.min(m, FIM));

/**
 * @param {string} dataISO
 * @param {(o:object)=>void} aoTocarOcorrencia corrigir por toque
 */
export function linhaDoTempo(dataISO, aoTocarOcorrencia) {
  const pista = h('div', { class: 'lt-pista' });
  const horas = h('div', { class: 'lt-horas' });

  for (let m = INICIO; m <= FIM; m += 60) {
    horas.append(h('div', { class: 'lt-hora', vars: { inicio: m } }, h('span', {}, hhmm(m))));
  }

  // sono primeiro, para ficar por baixo de tudo
  for (const b of blocosSono(dataISO).blocos) {
    if (b.fim <= INICIO || b.inicio >= FIM) continue;
    pista.append(h('div', {
      class: 'bloco tipo-sono fundo',
      vars: { inicio: dentro(b.inicio), fim: dentro(b.fim) },
    }, h('span', { class: 'bloco-titulo' }, 'Sono')));
  }

  for (const o of ocorrencias(dataISO)) {
    if (o.inicio == null) continue;
    pista.append(o.fim != null ? blocoDuracao(o, aoTocarOcorrencia) : marco(o, aoTocarOcorrencia));
  }

  if (dataISO === diaLogico()) {
    const agora = agoraNoDia(dataISO);
    pista.append(h('div', { class: 'lt-agora', vars: { inicio: dentro(agora) } },
      h('span', { class: 'lt-agora-hora' }, hhmm(agora))));
  }

  return h('div', { class: 'linha-tempo' }, horas, pista);
}

function blocoDuracao(o, aoTocar) {
  const registravel = o.registravel;
  const el = h(registravel ? 'button' : 'div', {
    class: `bloco tipo-${o.tipo} ${registravel ? 'tocavel' : 'fundo'}`,
    vars: { inicio: dentro(o.inicio), fim: dentro(o.fim) },
    onclick: registravel ? () => aoTocar(o) : null,
  },
    h('span', { class: 'bloco-titulo' }, o.titulo),
    h('span', { class: 'bloco-hora' }, `${hhmm(o.inicio)}–${hhmm(o.fim)}`));

  if (o.real?.inicio != null) {
    const fimReal = o.real.fim ?? Math.min(o.real.inicio + (o.fim - o.inicio), FIM);
    // --inicio é herdado do bloco: a barra se posiciona pela diferença
    el.append(h('div', {
      class: `bloco-real ${classeSituacao(o.status)}`,
      vars: { 'real-inicio': o.real.inicio, 'real-fim': fimReal },
    }));
    if (o.desvio != null && Math.abs(o.desvio) >= 1) {
      el.append(h('span', { class: `bloco-desvio ${classeSituacao(o.status)}` }, fmtDesvio(o.desvio)));
    }
  }
  return el;
}

function marco(o, aoTocar) {
  const el = h('button', {
    class: `marco tipo-${o.tipo} tocavel`,
    vars: { inicio: dentro(o.inicio) },
    onclick: () => aoTocar(o),
  },
    h('span', { class: 'marco-ponto' }),
    h('span', { class: 'marco-titulo' }, icone(iconeDoTipo(o.tipo), { classe: 'icone-p' }), o.titulo),
    h('span', { class: 'marco-hora' }, hhmm(o.inicio)));

  if (o.real?.inicio != null) {
    el.classList.add('com-real');
    el.append(h('span', {
      class: `marco-real ${classeSituacao(o.status)}`,
      vars: { 'real-inicio': o.real.inicio },
    }, `${hhmm(o.real.inicio)} · ${fmtDesvio(o.desvio)}`));
  }
  return el;
}

/**
 * Rola até o marcador de agora, deixando-o a um terço da altura.
 * No celular quem rola é a página; no desktop, a própria coluna.
 */
export function centralizarAgora(raiz, container) {
  const agora = raiz.querySelector('.lt-agora');
  if (!agora) return;
  const rolador = container.scrollHeight > container.clientHeight + 4 ? container : paiRolavel(container);
  if (!rolador) return;
  const topoAgora = agora.getBoundingClientRect().top;
  const topoRolador = rolador === document.scrollingElement ? 0 : rolador.getBoundingClientRect().top;
  rolador.scrollBy({ top: topoAgora - topoRolador - rolador.clientHeight / 3, behavior: 'auto' });
}

function paiRolavel(no) {
  for (let p = no.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p).overflowY;
    if ((s === 'auto' || s === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
  }
  return document.scrollingElement;
}

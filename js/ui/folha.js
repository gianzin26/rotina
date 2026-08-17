// ui/folha.js — folha inferior, seletores e avisos.
// Componentes compartilhados por todas as telas.

import { hhmm, min } from '../nucleo/util.js';
import { vibrar } from './alarme.js';
import { h } from './dom.js';
import { icone } from './icones.js';

let aberta = null;

export function fecharFolha() {
  if (!aberta) return;
  const { fundo, aoFechar, focoAnterior } = aberta;
  aberta = null;
  fundo.classList.add('saindo');
  setTimeout(() => fundo.remove(), 180);
  focoAnterior?.focus?.();
  aoFechar?.();
}

/**
 * Folha inferior modal. `construir(fechar)` devolve o conteúdo.
 */
export function folha(titulo, construir, { aoFechar } = {}) {
  fecharFolha();
  const focoAnterior = document.activeElement;
  const fechar = () => fecharFolha();

  const painel = h('div', {
    class: 'folha', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo,
    onclick: (e) => e.stopPropagation(),
  },
    h('div', { class: 'folha-topo' },
      h('h2', {}, titulo),
      h('button', { class: 'icone-botao', 'aria-label': 'Fechar', onclick: fechar }, icone('fechar'))),
    h('div', { class: 'folha-corpo' }, construir(fechar)));

  const fundo = h('div', { class: 'folha-fundo', onclick: fechar }, painel);
  document.body.append(fundo);
  aberta = { fundo, aoFechar, focoAnterior };

  requestAnimationFrame(() => {
    fundo.classList.add('visivel');
    (painel.querySelector('input, select, textarea, button.primario') || painel).focus?.();
  });
  return fechar;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aberta) fecharFolha();
});

/** Seletor de horário — usado na correção por toque longo. */
export function escolherHorario({ titulo, minutos, aoEscolher, aoApagar }) {
  folha(titulo, (fechar) => {
    const entrada = h('input', { type: 'time', class: 'entrada-hora', value: hhmm(minutos ?? 0), step: 60 });
    const confirmar = () => {
      const m = min(entrada.value);
      if (m == null) return;
      fechar();
      aoEscolher(m);
    };
    return h('div', { class: 'pilha' },
      entrada,
      h('button', { class: 'botao primario largura-total', onclick: confirmar },
        icone('check'), 'Salvar horário'),
      aoApagar && h('button', {
        class: 'botao perigo-texto largura-total',
        onclick: () => { fechar(); aoApagar(); },
      }, icone('lixeira'), 'Apagar registro'));
  });
}

/** Entrada numérica com teclado decimal (peso, carga, distância…). */
export function escolherNumero({ titulo, rotulo, valor, passo = 0.1, sufixo = '', aoEscolher, aoApagar }) {
  folha(titulo, (fechar) => {
    const entrada = h('input', {
      type: 'number', inputmode: 'decimal', step: passo, class: 'entrada-num',
      value: valor ?? '', placeholder: '0',
    });
    const enviar = () => {
      const v = parseFloat(String(entrada.value).replace(',', '.'));
      if (Number.isNaN(v)) return;
      fechar();
      aoEscolher(v);
    };
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
    return h('div', { class: 'pilha' },
      rotulo && h('label', { class: 'rotulo' }, rotulo),
      h('div', { class: 'linha-num' }, entrada, sufixo && h('span', { class: 'sufixo' }, sufixo)),
      h('button', { class: 'botao primario largura-total', onclick: enviar }, icone('check'), 'Salvar'),
      aoApagar && h('button', {
        class: 'botao perigo-texto largura-total',
        onclick: () => { fechar(); aoApagar(); },
      }, icone('lixeira'), 'Apagar'));
  });
}

/** Confirmação em folha, para não depender do confirm() do sistema. */
export function confirmar(titulo, texto, rotuloOk = 'Confirmar', perigo = false) {
  return new Promise((resolve) => {
    let respondeu = false;
    folha(titulo, (fechar) => h('div', { class: 'pilha' },
      texto && h('p', { class: 'texto-suave' }, texto),
      h('button', {
        class: `botao largura-total ${perigo ? 'perigo' : 'primario'}`,
        onclick: () => { respondeu = true; fechar(); resolve(true); },
      }, rotuloOk),
      h('button', {
        class: 'botao largura-total',
        onclick: () => { respondeu = true; fechar(); resolve(false); },
      }, 'Cancelar')),
    { aoFechar: () => { if (!respondeu) resolve(false); } });
  });
}

let timerAviso = null;
export function aviso(texto) {
  let no = document.querySelector('.aviso');
  if (!no) { no = h('div', { class: 'aviso', role: 'status', 'aria-live': 'polite' }); document.body.append(no); }
  no.textContent = texto;
  no.classList.add('visivel');
  vibrar(8);
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => no.classList.remove('visivel'), 2200);
}

/* ---------- peças reaproveitadas ---------- */

export function campo(rotulo, entrada, dica) {
  return h('label', { class: 'campo' },
    h('span', { class: 'rotulo' }, rotulo),
    entrada,
    dica && h('span', { class: 'dica' }, dica));
}

export function entradaTexto(valor, aoMudar, props = {}) {
  return h('input', { type: 'text', value: valor ?? '', oninput: (e) => aoMudar(e.target.value), ...props });
}

export function entradaHora(valor, aoMudar) {
  return h('input', { type: 'time', step: 60, value: valor || '', onchange: (e) => aoMudar(e.target.value || null) });
}

export function entradaNumero(valor, aoMudar, props = {}) {
  return h('input', {
    type: 'number', inputmode: 'decimal', value: valor ?? '',
    onchange: (e) => aoMudar(e.target.value === '' ? null : parseFloat(String(e.target.value).replace(',', '.'))),
    ...props,
  });
}

/** Grupo de botões exclusivos (segmented control). */
export function segmentos(itens, valorAtual, aoTrocar) {
  return h('div', { class: 'segmentos', role: 'tablist' },
    itens.map((it) => h('button', {
      class: `segmento ${it.id === valorAtual ? 'ativo' : ''}`,
      role: 'tab', 'aria-selected': String(it.id === valorAtual),
      onclick: () => aoTrocar(it.id),
    }, it.rotulo)));
}

/** Fileira 1–10 do RPE. */
export function fileiraRPE(valor, aoEscolher) {
  return h('div', { class: 'rpe' },
    Array.from({ length: 10 }, (_, i) => i + 1).map((n) => h('button', {
      class: `rpe-item ${valor === n ? 'ativo' : ''}`,
      'aria-pressed': String(valor === n),
      onclick: () => aoEscolher(valor === n ? null : n),
    }, n)));
}

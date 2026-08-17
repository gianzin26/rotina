// ui/dom.js — construção de elementos e o vocabulário visual do semáforo.

import { vibrar } from './alarme.js';

export function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'vars') variaveis(e, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  anexar(e, filhos);
  return e;
}

/** append que ignora null/false — deixa usar condicionais soltas na lista. */
export function anexar(pai, ...filhos) {
  for (const f of filhos.flat(9)) {
    if (f == null || f === false) continue;
    pai.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return pai;
}

/**
 * Único lugar do JS que escreve no atributo style, e escreve **dado**, não estilo:
 * números sem unidade em variáveis CSS. Quantos pixels vale um minuto, qual cor
 * ou qual raio — isso é decidido em styles.css.
 *
 *   variaveis(el, { inicio: 430 })  →  style="--inicio: 430"
 *   CSS:  top: calc((var(--inicio) - var(--lt-minuto-inicial)) * var(--lt-px-minuto) * 1px)
 */
export function variaveis(el, vars) {
  for (const [nome, valor] of Object.entries(vars)) {
    if (valor == null) continue;
    el.style.setProperty(`--${nome}`, String(valor));
  }
  return el;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function limpar(no) {
  while (no.firstChild) no.removeChild(no.firstChild);
  return no;
}

/**
 * Tradução do vocabulário de domínio para o visual. É a única ponte entre
 * as situações que o núcleo calcula e as cores que o CSS pinta.
 */
const CLASSE_DA_SITUACAO = {
  noAlvo: 'verde',
  deriva: 'amarelo',
  fora: 'vermelho',
  semRegistro: 'neutro',
  atipico: 'atipica',
  futuro: 'futuro',
};

export const classeSituacao = (s) => CLASSE_DA_SITUACAO[s] || 'neutro';

export function vazio(texto) {
  return h('p', { class: 'vazio' }, texto);
}

export function bolinha(situacao) {
  return h('span', { class: `bolinha ${classeSituacao(situacao)}`, 'aria-hidden': 'true' });
}

/* ---------- gestos ---------- */

/** Toque longo (500 ms) sem atrapalhar o clique curto. */
export function toqueLongo(el, aoLongo) {
  let timer = null;
  let disparou = false;
  const inicia = () => {
    disparou = false;
    timer = setTimeout(() => { disparou = true; vibrar(12); aoLongo(); }, 500);
  };
  const cancela = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', inicia);
  el.addEventListener('pointerup', cancela);
  el.addEventListener('pointerleave', cancela);
  el.addEventListener('pointercancel', cancela);
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  el.addEventListener('click', (ev) => {
    if (disparou) { ev.preventDefault(); ev.stopImmediatePropagation(); disparou = false; }
  }, true);
  return el;
}

export { vibrar };

// ui/tema.js — aplica o tema no documento.
//
// Separado do núcleo porque mexe em atributo do DOM e na cor da barra de
// status; o núcleo só sabe qual é a escolha, não como pintá-la.

import { tema, temaEfetivo } from '../nucleo/tema.js';

/* Sem escolha manual o atributo sai do caminho e o prefers-color-scheme
   assume. Com escolha, ele vence nos dois sentidos. */
export function aplicarTema() {
  const escolhido = tema();
  if (escolhido === 'auto') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = escolhido;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', temaEfetivo() === 'escuro' ? '#000000' : '#F5F5F7');
}

/** Seguir o sistema significa reagir quando ele muda, sem recarregar. */
export function observarSistema() {
  globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener('change', aplicarTema);
}

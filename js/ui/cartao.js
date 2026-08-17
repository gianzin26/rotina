// ui/cartao.js — a anatomia única de cartão do painel.
//
// Todo cartão segue a mesma ordem, como no App Store Connect:
// título · seletor de período · subtítulo · número grande · legenda · gráfico.

import { classeSituacao, h } from './dom.js';
import { icone } from './icones.js';

/**
 * @param {string|object} opcoes título, ou:
 *   {titulo, periodo, subtitulo, metrica, unidade, legenda, delta, acao, largo, alto}
 *   `delta` = {texto, situacao, sentido:'subiu'|'desceu'}
 *   `periodo` = {rotulo, aoTrocar} — vira botão; só texto se não houver aoTrocar
 * @param {...Node} conteudo o que vem depois do cabeçalho (gráfico, listas…)
 */
export function cartao(opcoes, ...conteudo) {
  const o = typeof opcoes === 'string' || opcoes == null ? { titulo: opcoes } : opcoes;
  const classes = ['cartao', o.pequeno && 'pequeno', o.classe].filter(Boolean).join(' ');

  const cabecalho = (o.titulo || o.periodo || o.acao) && h('div', { class: 'cartao-topo' },
    h('div', { class: 'cartao-identidade' },
      o.titulo && h('h2', { class: 'cartao-titulo' }, o.titulo),
      o.subtitulo && h('p', { class: 'cartao-subtitulo' }, o.subtitulo)),
    o.periodo && (o.periodo.aoTrocar
      ? h('button', { class: 'periodo', onclick: o.periodo.aoTrocar },
        o.periodo.rotulo, icone('chevron'))
      : h('span', { class: 'periodo' }, o.periodo.rotulo || o.periodo)),
    o.acao);

  const metrica = o.metrica != null && h('div', { class: 'cartao-metrica' },
    h('div', { class: 'metrica-linha' },
      h('span', { class: 'metrica-num' }, o.metrica,
        o.unidade && h('span', { class: 'metrica-unidade' }, o.unidade)),
      o.delta && h('span', { class: `delta ${classeSituacao(o.delta.situacao)}` },
        o.delta.sentido && icone(o.delta.sentido),
        o.delta.texto)),
    o.legenda && h('span', {
      class: `metrica-legenda ${o.legendaSituacao ? classeSituacao(o.legendaSituacao) : ''}`.trim(),
    }, o.legenda));

  return h('section', { class: classes }, cabecalho, metrica, ...conteudo);
}

/** Bloco de número pequeno com rótulo — usado em fileiras de 2 a 4. */
export function dado(rotulo, valor, opcoes = {}) {
  const { situacao, aoTocar, sufixo } = opcoes;
  return h(aoTocar ? 'button' : 'div', {
    class: `dado ${aoTocar ? 'tocavel' : ''}`.trim(),
    onclick: aoTocar || null,
  },
    h('span', { class: 'dado-rotulo' }, rotulo),
    h('span', { class: `dado-valor ${situacao ? classeSituacao(situacao) : ''}`.trim() },
      valor, sufixo && h('span', { class: 'dado-sufixo' }, sufixo)));
}

export function fileiraDados(...dados) {
  return h('div', { class: 'dados-linha' }, ...dados);
}

/** Linha de lista: identidade à esquerda, valor ou etiqueta à direita. */
export function linha(esquerda, direita, opcoes = {}) {
  return h(opcoes.aoTocar ? 'button' : 'div', {
    class: `linha ${opcoes.aoTocar ? 'tocavel' : ''}`.trim(),
    onclick: opcoes.aoTocar || null,
  },
    h('div', { class: 'linha-info' }, esquerda),
    direita && h('div', { class: 'linha-fim' }, direita));
}

export function titulo(texto, icone2) {
  return h('h3', { class: 'sub' }, icone2, texto);
}

export function etiqueta(texto, situacao) {
  return h('span', { class: `etiqueta ${situacao ? classeSituacao(situacao) : ''}`.trim() }, texto);
}

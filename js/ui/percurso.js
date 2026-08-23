// ui/percurso.js — o traçado do percurso em SVG.
//
// Sem mapa por baixo: só a forma do caminho. É o suficiente para bater o olho
// e reconhecer a volta, e não arrasta provedor de tiles, chave de API nem
// dependência de rede para dentro de um app que funciona offline.

import { decodificar, projetar } from '../nucleo/percurso.js';
import { h, limpar, variaveis } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

const s = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
};

/**
 * @param {string} polyline traçado codificado, como o Strava devolve
 * @param {{altura?:number, descricao?:string}} [opcoes]
 */
export function percurso(polyline, { altura = 180, descricao = 'percurso da corrida' } = {}) {
  const caixa = h('div', { class: 'percurso', role: 'img', 'aria-label': descricao });
  variaveis(caixa, { 'percurso-altura': altura });

  const coordenadas = decodificar(polyline);
  if (coordenadas.length < 2) {
    caixa.append(h('p', { class: 'percurso-vazio' }, 'sem traçado nesta corrida'));
    return caixa;
  }

  let ultimaLargura = 0;
  const desenhar = (largura) => {
    if (!(largura > 0) || largura === ultimaLargura) return;
    ultimaLargura = largura;
    limpar(caixa);
    caixa.append(desenhoSvg(coordenadas, largura, altura));
  };

  // mesma razão do gráfico: clientWidth força o layout na hora, sem depender
  // de um quadro de renderização que não vem com a aba em segundo plano
  setTimeout(() => desenhar(Math.round(caixa.clientWidth)), 0);
  new ResizeObserver((e) => desenhar(Math.round(e[0].contentRect.width))).observe(caixa);

  return caixa;
}

function desenhoSvg(coordenadas, L, A) {
  const svg = s('svg', { viewBox: `0 0 ${L} ${A}`, width: L, height: A, class: 'percurso-svg' });
  const { pontos } = projetar(coordenadas, L, A);

  const d = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  // traço de baixo mais grosso e apagado: dá corpo à linha sem competir com ela
  svg.append(s('path', { d, class: 'percurso-sombra' }));
  svg.append(s('path', { d, class: 'percurso-linha' }));

  const [xi, yi] = pontos[0];
  const [xf, yf] = pontos[pontos.length - 1];
  // partida cheia, chegada vazada: distingue as duas quando a volta fecha
  svg.append(s('circle', { cx: xf, cy: yf, r: 5, class: 'percurso-fim' }));
  svg.append(s('circle', { cx: xi, cy: yi, r: 4, class: 'percurso-inicio' }));
  return svg;
}

// ui/grafico.js — gráficos completos em SVG puro, sem biblioteca.
//
// Eixo Y à direita, grade horizontal, rótulos de data no eixo X.
// O SVG é desenhado no tamanho real do cartão (1 unidade = 1 pixel), então
// os rótulos saem no corpo certo em vez de escalarem junto com a caixa.

import { h, limpar, variaveis } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
}

/* Geometria do desenho, medida na referência (App Store Connect):
   - a grade horizontal atravessa a largura inteira do conteúdo do cartão;
   - os rótulos do eixo Y ficam à direita, alinhados à borda do conteúdo e
     centrados na própria linha de grade;
   - os dados param antes dos rótulos, para não passarem por baixo deles.
   Fica aqui, e não no CSS, porque o SVG precisa dos números para posicionar. */
const MARGEM = { topo: 10, baixo: 22, esquerda: 0 };
const FAIXA_ROTULO = 42; // reservado à direita para o rótulo do eixo Y
const BARRA_MAX = 4;     // barra de 4px com passo de 10, como na referência
const BARRA_VAO = 6;

let contadorGradiente = 0;

/**
 * @param {object} cfg
 * @param {number} cfg.altura altura do desenho em pixels
 * @param {Array<{tipo:'barras'|'linha'|'area'|'pontos', serie:string, pontos:Array<{x:number,y:number,situacao?:string}>, marcadores?:boolean}>} cfg.series
 * @param {Array<{x:number, texto:string}>} [cfg.rotulosX]
 * @param {(y:number)=>string} [cfg.formatoY]
 * @param {number} [cfg.meta] linha tracejada de alvo
 * @param {boolean} [cfg.yInvertido] horários: mais cedo em cima
 * @param {string} [cfg.descricao] texto alternativo
 */
export function grafico(cfg) {
  const caixa = h('div', { class: 'grafico', role: 'img', 'aria-label': cfg.descricao || 'gráfico' });
  variaveis(caixa, { 'g-altura': cfg.altura || 180 });

  let ultimaLargura = 0;
  const desenhar = (largura) => {
    if (!(largura > 0) || largura === ultimaLargura) return;
    ultimaLargura = largura;
    limpar(caixa);
    caixa.append(desenharSvg(cfg, largura, cfg.altura || 180));
  };

  // Mede assim que a tela termina de montar. clientWidth força o cálculo de
  // layout na hora, então não dependemos de um quadro de renderização — o que
  // importa quando a aba está em segundo plano.
  const medir = () => desenhar(Math.round(caixa.clientWidth));
  setTimeout(medir, 0);

  // ResizeObserver cobre o resto: giro de tela, painel que muda de largura.
  new ResizeObserver((entradas) => desenhar(Math.round(entradas[0].contentRect.width))).observe(caixa);

  return caixa;
}

function desenharSvg(cfg, L, A) {
  const svg = s('svg', { viewBox: `0 0 ${L} ${A}`, width: L, height: A, class: 'g-svg' });
  // cartão pequeno: sem eixo nem rótulo, o desenho ocupa tudo
  const faixa = cfg.semRotulos ? 0 : FAIXA_ROTULO;
  const baixo = cfg.semRotulos ? 2 : MARGEM.baixo;
  const larg = L - MARGEM.esquerda - faixa; // área dos dados
  const alt = A - MARGEM.topo - baixo;

  const todos = cfg.series.flatMap((se) => se.pontos).filter((p) => p && Number.isFinite(p.y));
  if (!todos.length || larg <= 0) {
    const t = s('text', { x: L / 2, y: A / 2, 'text-anchor': 'middle', class: 'g-vazio' });
    t.textContent = 'sem dados ainda';
    svg.append(t);
    return svg;
  }

  const ys = todos.map((p) => p.y);
  const xs = todos.map((p) => p.x);
  let y0 = cfg.yMin ?? Math.min(...ys);
  let y1 = cfg.yMax ?? Math.max(...ys);
  if (cfg.base0 && y0 > 0) y0 = 0;
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  // com yMax explícito a escala é exatamente a pedida: os cortes saem redondos
  if (cfg.yMax == null || cfg.yMin == null) {
    const folga = (y1 - y0) * 0.1;
    if (cfg.yMin == null) y0 -= folga;
    if (cfg.yMax == null) y1 += folga;
  }
  if (cfg.base0) y0 = 0; // barras nascem no zero, sem eixo negativo
  const x0 = Math.min(...xs), x1 = Math.max(...xs);

  const px = (x) => MARGEM.esquerda + (x1 === x0 ? larg / 2 : ((x - x0) / (x1 - x0)) * larg);
  const py = (y) => {
    const t = (y - y0) / (y1 - y0);
    return MARGEM.topo + (cfg.yInvertido ? t : 1 - t) * alt;
  };

  /* grade horizontal de ponta a ponta + rótulo do eixo Y encostado na direita */
  const nTicks = cfg.semRotulos ? 0 : (cfg.yTicks ?? 4);
  for (let i = 0; i <= nTicks && !cfg.semRotulos; i++) {
    const y = y0 + ((y1 - y0) * i) / nTicks;
    const yy = Math.round(py(y)) + 0.5; // meia unidade: linha de 1px sem borrar
    svg.append(s('line', { x1: MARGEM.esquerda, x2: L, y1: yy, y2: yy, class: 'g-grade' }));
    const t = s('text', {
      x: L, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'g-rotulo',
    });
    t.textContent = cfg.formatoY ? cfg.formatoY(y) : Math.round(y * 10) / 10;
    svg.append(t);
  }

  /* meta como linha tracejada cinza */
  if (cfg.meta != null && cfg.meta >= y0 && cfg.meta <= y1) {
    const yy = Math.round(py(cfg.meta)) + 0.5;
    svg.append(s('line', { x1: MARGEM.esquerda, x2: L, y1: yy, y2: yy, class: 'g-meta' }));
  }

  /* séries */
  for (const se of cfg.series) {
    const pts = se.pontos.filter((p) => Number.isFinite(p.y)).sort((a, b) => a.x - b.x);
    if (!pts.length) continue;
    const classe = se.serie || 'serie-principal';

    if (se.tipo === 'barras') {
      // Referência: passo de 12px com barra de 8px e vão de 4px. Quando cabem
      // menos pixels por ponto, a barra encolhe mas o vão nunca some.
      const passo = pts.length > 1 ? larg / pts.length : larg;
      const largura = Math.max(1.5, Math.min(BARRA_MAX, passo - BARRA_VAO));
      const base = py(Math.max(y0, 0));
      for (const p of pts) {
        const yy = py(p.y);
        const altura = Math.max(1.5, Math.abs(base - yy));
        svg.append(s('rect', {
          x: px(p.x) - largura / 2, y: Math.min(yy, base),
          width: largura, height: altura, rx: Math.min(1, largura / 2),
          class: `${classe} g-barra ${p.situacao ? `sit-${p.situacao}` : ''}`.trim(),
        }));
      }
    } else if (se.tipo === 'area' || se.tipo === 'linha') {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
      if (se.tipo === 'area') {
        // gradiente da cor da série até transparente, como na referência
        const id = `grad-${++contadorGradiente}`;
        const defs = s('defs');
        const grad = s('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 });
        grad.append(s('stop', { offset: '0%', class: `${classe} g-area-grad` }));
        grad.append(s('stop', { offset: '100%', class: `${classe}`, 'stop-opacity': 0 }));
        defs.append(grad);
        svg.append(defs);
        const base = A - baixo;
        svg.append(s('path', {
          d: `${d} L${px(pts[pts.length - 1].x).toFixed(1)} ${base.toFixed(1)} L${px(pts[0].x).toFixed(1)} ${base.toFixed(1)} Z`,
          class: 'g-area', fill: `url(#${id})`,
        }));
      }
      svg.append(s('path', { d, class: `${classe} g-linha` }));
    }

    if (se.tipo === 'pontos' || se.marcadores) {
      for (const p of pts) {
        svg.append(s('circle', {
          cx: px(p.x), cy: py(p.y),
          class: `${classe} g-ponto ${p.situacao ? `sit-${p.situacao}` : ''}`.trim(),
        }));
      }
    }
  }

  /* rótulos de data no eixo X */
  for (const r of (cfg.semRotulos ? [] : cfg.rotulosX || [])) {
    const x = px(r.x);
    const t = s('text', {
      x: Math.min(Math.max(x, 14), L - faixa - 4),
      y: A - 6, 'text-anchor': 'middle', class: 'g-rotulo',
    });
    t.textContent = r.texto;
    svg.append(t);
  }

  return svg;
}

/** Legenda de séries, em bolinhas coloridas sob o gráfico. */
export function legenda(itens) {
  return h('div', { class: 'g-legenda' },
    itens.map((i) => h('span', { class: 'g-legenda-item' },
      h('span', { class: `g-legenda-cor ${i.serie}` }),
      i.rotulo)));
}

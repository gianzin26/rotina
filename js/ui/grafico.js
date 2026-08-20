// ui/grafico.js — gráficos completos em SVG puro, sem biblioteca.
//
// Eixo Y à direita, grade horizontal, rótulos de data no eixo X.
// O SVG é desenhado no tamanho real do cartão (1 unidade = 1 pixel), então
// os rótulos saem no corpo certo em vez de escalarem junto com a caixa.

import { classeSituacao, h, limpar, variaveis } from './dom.js';

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
/* Medido nas referências do Stitch: a barra ocupa de 35% a 39% da banda, e a
   mais larga (Aderência, 7 barras) tem 16px de corpo. O canto é uma
   semicircunferência de raio igual a metade da largura — o perfil do topo
   cresce até a largura cheia em exatamente meia largura, e a base repete. */
const BARRA_OCUPACAO = 0.36;
const BARRA_MIN = 2;
const BARRA_MAX = 16;

let contadorGradiente = 0;

/**
 * Arredonda o passo do eixo para 1, 2, 2,5 ou 5 vezes uma potência de dez.
 * Em minutos isso cai em 15, 30 ou 60; em horas e quilos, em unidades inteiras.
 */
function passoRedondo(bruto) {
  if (!(bruto > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/**
 * @param {object} cfg
 * @param {number} cfg.altura altura do desenho em pixels
 * @param {Array<{tipo:'barras'|'linha'|'area'|'pontos', serie:string, pontos:Array<{x:number,y:number,situacao?:string}>, marcadores?:boolean}>} cfg.series
 * @param {Array<{x:number, texto:string}>} [cfg.rotulosX]
 * @param {number} [cfg.xMin] primeira banda da janela, mesmo sem dado nela
 * @param {number} [cfg.xMax] última banda da janela, mesmo sem dado nela
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
  const temBarras = cfg.series.some((se) => se.tipo === 'barras');
  let y0 = cfg.yMin ?? Math.min(...ys);
  let y1 = cfg.yMax ?? Math.max(...ys);
  if (cfg.base0 && y0 > 0) y0 = 0;
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  // com yMax explícito a escala é exatamente a pedida: os cortes saem redondos
  if (cfg.yMax == null || cfg.yMin == null) {
    // Barra precisa de chão: no modelo o eixo começa bem abaixo do menor dado,
    // senão o dia mais baixo vira um ponto sem corpo. Linha não precisa disso.
    const folgaBaixo = (y1 - y0) * (temBarras && !cfg.base0 ? 0.35 : 0.1);
    const folgaCima = (y1 - y0) * 0.1;
    if (cfg.yMin == null) y0 -= folgaBaixo;
    if (cfg.yMax == null) y1 += folgaCima;
  }
  if (cfg.base0) y0 = 0; // barras nascem no zero, sem eixo negativo
  // Corta em valores redondos, como os 5AM..10AM da referência. Os cortes
  // passam a cair nos múltiplos do passo, senão o rótulo arredondado repete
  // ("7h 7h 8h 8h 9h") quando o passo é mais fino que a casa exibida.
  let ticksDoPasso = null;
  if (temBarras && cfg.yMin == null && cfg.yMax == null) {
    const rotular = cfg.formatoY || ((v) => String(Math.round(v)));
    let passo = passoRedondo((y1 - y0) / (cfg.yTicks ?? 4));
    const bruto0 = y0;
    const bruto1 = y1;
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      y0 = Math.floor(bruto0 / passo) * passo;
      y1 = Math.ceil(bruto1 / passo) * passo;
      ticksDoPasso = Math.max(1, Math.round((y1 - y0) / passo));
      const rotulos = Array.from({ length: ticksDoPasso + 1 }, (_, i) => rotular(y0 + passo * i));
      if (new Set(rotulos).size === rotulos.length) break;
      passo = passoRedondo(passo * 1.6); // sobe um degrau: 0,5 → 1 → 2 → 2,5 → 5
    }
  }
  // A janela mandada por quem chama vence: senão um dia sem registro encolhe o
  // eixo, as barras escorregam de banda e os rótulos caem fora do domínio.
  const x0 = cfg.xMin ?? Math.min(...xs);
  const x1 = cfg.xMax ?? Math.max(...xs);

  // Barra ocupa uma faixa, não um ponto: com escala contínua a primeira e a
  // última ficam metade para fora. Com banda, cada uma senta no meio da sua.
  const banda = larg / Math.max(1, x1 - x0 + 1);
  const px = temBarras
    ? (x) => MARGEM.esquerda + banda * (x - x0 + 0.5)
    : (x) => MARGEM.esquerda + (x1 === x0 ? larg / 2 : ((x - x0) / (x1 - x0)) * larg);
  const py = (y) => {
    const t = (y - y0) / (y1 - y0);
    return MARGEM.topo + (cfg.yInvertido ? t : 1 - t) * alt;
  };

  /* grade horizontal de ponta a ponta + rótulo do eixo Y encostado na direita */
  const nTicks = cfg.semRotulos ? 0 : (ticksDoPasso ?? cfg.yTicks ?? 4);
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
      const largura = Math.max(BARRA_MIN, Math.min(BARRA_MAX, banda * BARRA_OCUPACAO));
      // com eixo invertido o zero fica em cima; a barra continua crescendo
      // do chão do desenho, senão sai pendurada de cabeça para baixo
      const base = cfg.yInvertido ? MARGEM.topo + alt : py(Math.max(y0, 0));
      for (const p of pts) {
        const yy = py(p.y);
        const altura = Math.max(1.5, Math.abs(base - yy));
        svg.append(s('rect', {
          x: px(p.x) - largura / 2, y: Math.min(yy, base),
          // rx sozinho já define ry igual: cápsula de ponta a ponta
          width: largura, height: altura, rx: largura / 2,
          class: `${classe} g-barra ${p.situacao ? `sit-${classeSituacao(p.situacao)}` : ''}`.trim(),
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
          class: `${classe} g-ponto ${p.situacao ? `sit-${classeSituacao(p.situacao)}` : ''}`.trim(),
        }));
      }
    }
  }

  /* rótulos de data no eixo X */
  // Largura aproximada de "20/08" no corpo do eixo, com uma folga.
  const LARGURA_ROTULO = 34;
  let ultimoX = -Infinity;
  for (const r of (cfg.semRotulos ? [] : cfg.rotulosX || [])) {
    if (r.x < x0 || r.x > x1) continue;      // fora da janela: não existe eixo para ele
    const x = px(r.x);
    if (x - ultimoX < LARGURA_ROTULO) continue; // encostaria no anterior
    ultimoX = x;
    const t = s('text', {
      x, y: A - 6, 'text-anchor': 'middle', class: 'g-rotulo',
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

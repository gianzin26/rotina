// ui/telas/visaoGeral.js — painel de entrada no computador.
// Contagem para a próxima saída, tendências e resumo de treino.

import { diaAderencia } from '../../nucleo/aderencia.js';
import { horasDeSono, ocorrencias } from '../../nucleo/agenda.js';
import {
  alternar as alternarCreatina, contagemSemana as contagemCreatina,
  semana as semanaCreatina, sequencia as sequenciaCreatina,
} from '../../nucleo/creatina.js';
import { comparacao } from '../../nucleo/deslocamento.js';
import {
  alvoSono, situacaoAcordar, situacaoDoPercentual, situacaoSono,
} from '../../nucleo/metas.js';
import { resumo as resumoPeso, serie as seriePeso } from '../../nucleo/peso.js';
import { estado, registroDoDia, trajeto } from '../../nucleo/store.js';
import { corridas, historico } from '../../nucleo/treino.js';
import {
  DIAS, agoraMin, dataCurta, diaLogico, diffDias, duracao, hhmm, inicioSemana,
  media, min, nUm, somaDias,
} from '../../nucleo/util.js';
import { cartao } from '../cartao.js';
import { anexar, h, vazio } from '../dom.js';
import { grafico } from '../grafico.js';
import { icone } from '../icones.js';
import { janela, periodoEmDias, periodoEmSemanas } from '../periodo.js';

/**
 * Rótulos de data espalhados por igual, sempre incluindo o primeiro e o último.
 * Distribuir por índice em vez de somar um passo evita o encavalamento que
 * aparecia quando o último rótulo caía colado no anterior.
 */
function rotulosDeDatas(datas, quantos = 5) {
  const n = datas.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, texto: dataCurta(datas[0]) }];
  const total = Math.min(quantos, n);
  const vistos = new Set();
  const fora = [];
  for (let i = 0; i < total; i++) {
    const idx = Math.round((i * (n - 1)) / (total - 1));
    if (vistos.has(idx)) continue;
    vistos.add(idx);
    fora.push({ x: idx, texto: dataCurta(datas[idx]) });
  }
  return fora;
}

/** 5.2 → "5:12" */
export function paceTexto(minPorKm) {
  if (!Number.isFinite(minPorKm)) return '—';
  const m = Math.floor(minPorKm);
  const s = Math.round((minPorKm - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function render(tela, ctx) {
  const dia = diaLogico();

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {}, h('h1', {}, 'Visão geral'))),
    h('div', { class: 'grade' },
      cartaoContagem(dia),
      cartaoHoraDeAcordar(dia, ctx),
      cartaoPeso(ctx),
      cartaoSono(dia, ctx),
      cartaoAderencia(dia, ctx),
      cartaoCreatina(dia, ctx),
      cartaoDeslocamento(),
      cartaoVolume(ctx),
      cartaoCorrida(ctx)));
}

/* ---------------- contagem para a próxima saída ---------------- */

/** Próximo deslocamento previsto: hoje, ou o primeiro de amanhã. */
function proximaSaida(dia) {
  const agora = agoraMin();
  const hoje = ocorrencias(dia)
    .filter((o) => o.tipo === 'transito' && o.inicio != null && o.inicio > agora && !o.real)
    .sort((a, b) => a.inicio - b.inicio)[0];
  if (hoje) return { o: hoje, dataISO: dia, amanha: false };

  const amanha = somaDias(dia, 1);
  const primeira = ocorrencias(amanha)
    .filter((o) => o.tipo === 'transito' && o.inicio != null)
    .sort((a, b) => a.inicio - b.inicio)[0];
  return primeira ? { o: primeira, dataISO: amanha, amanha: true } : null;
}

function cartaoContagem(dia) {
  const alvo = proximaSaida(dia);
  if (!alvo) {
    return cartao({ titulo: 'Próxima saída', metrica: '—', legenda: 'Nenhum deslocamento na agenda' });
  }

  // descrição do trajeto: de onde para onde, e quanto costuma levar
  const t = trajeto(alvo.o.trajetoId);
  const percurso = t ? `${t.origem} → ${t.destino}` : alvo.o.titulo;
  const estimativa = t?.minutosEstimados ? ` · ~${t.minutosEstimados} min` : '';
  const relogio = h('span', { class: 'contagem' }, '--:--:--');

  // um alvo em Date para poder contar segundos, não só minutos
  const [ano, mes, diaDoMes] = alvo.dataISO.split('-').map(Number);
  const quando = new Date(ano, mes - 1, diaDoMes, Math.floor(alvo.o.inicio / 60), alvo.o.inicio % 60, 0);

  const pintar = () => {
    const resta = Math.max(0, Math.round((quando - Date.now()) / 1000));
    const p = (n) => String(n).padStart(2, '0');
    relogio.textContent = resta > 0
      ? `${p(Math.floor(resta / 3600))}:${p(Math.floor((resta % 3600) / 60))}:${p(resta % 60)}`
      : 'agora';
    relogio.classList.toggle('urgente', resta > 0 && resta <= 15 * 60);
  };
  pintar();

  // o intervalo se desliga sozinho quando a tela é trocada
  const tique = setInterval(() => {
    if (!relogio.isConnected) { clearInterval(tique); return; }
    pintar();
  }, 1000);

  return cartao({
    titulo: 'Próxima saída',
    periodo: alvo.amanha ? 'Amanhã' : 'Hoje',
    legenda: `${percurso} · sai ${hhmm(alvo.o.inicio)}${estimativa}`,
    classe: 'tipo-transito',
  },
    h('div', { class: 'contagem-linha' }, icone('relogio'), relogio));
}

/* ---------------- hora de acordar ---------------- */

function cartaoHoraDeAcordar(dia, ctx) {
  const dias = janela('horaAcordar');
  const datas = [];
  const pontos = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    datas.push(d);
    const s = registroDoDia('sono', d);
    if (s?.acordou) pontos.push({ x: dias - 1 - i, y: min(s.acordou), situacao: situacaoAcordar(d) });
  }
  const plano = estado.rotina.find((r) => r.tipo === 'acordar');
  const alvo = plano ? min(plano.inicio) : null;
  const m = media(pontos.map((p) => p.y));

  return cartao({
    titulo: 'Hora de acordar',
    periodo: periodoEmDias('horaAcordar', ctx),
    metrica: m != null ? hhmm(Math.round(m)) : '—',
    legenda: alvo != null ? `Média · alvo ${hhmm(alvo)}` : 'Média',
  },
    grafico({
      altura: 140, descricao: `hora de acordar nos últimos ${dias} dias`,
      xMin: 0, xMax: dias - 1,
      // barras crescendo do chão, como no modelo: mais alto = acordou mais tarde
      formatoY: (y) => hhmm(y), meta: alvo,
      rotulosX: rotulosDeDatas(datas, 5),
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- peso ---------------- */

function cartaoPeso(ctx) {
  const s = seriePeso().slice(-janela('peso'));
  const r = resumoPeso();
  if (!s.length) {
    return cartao({ titulo: 'Peso', periodo: periodoEmDias('peso', ctx) },
      vazio('Registre o peso por alguns dias para ver a curva.'));
  }
  const base = s[0].data;
  const linhaMedia = s.filter((p) => p.media7 != null).map((p) => ({ x: diffDias(base, p.data), y: p.media7 }));
  const v = r.variacaoSemana;
  const [gMin, gMax] = r.ganhoAlvo;
  const passo = Math.max(1, Math.round(s.length / 5));

  return cartao({
    titulo: 'Peso',
    // o seletor governa a curva; o número grande continua sendo a média de 7 dias
    subtitulo: 'Média de 7 dias',
    periodo: periodoEmDias('peso', ctx),
    metrica: r.media7 != null ? nUm(r.media7, 1) : '—',
    unidade: 'kg',
    legenda: v != null
      ? `${v >= 0 ? '+' : '−'}${nUm(Math.abs(v), 2)} kg esta semana`
      : 'aguardando 7 dias de pesagem',
    legendaSituacao: v == null ? null : v >= gMin && v <= gMax ? 'noAlvo' : v > 0 ? 'deriva' : 'fora',
  },
    grafico({
      altura: 140, descricao: 'média de 7 dias do peso',
      formatoY: (y) => `${nUm(y, 1)} kg`, meta: r.alvo,
      rotulosX: s.filter((_, i) => i % passo === 0 || i === s.length - 1)
        .map((p) => ({ x: diffDias(base, p.data), texto: dataCurta(p.data) })),
      series: [{ tipo: 'area', serie: 'serie-principal', pontos: linhaMedia }],
    }));
}

/* ---------------- sono ---------------- */

function cartaoSono(dia, ctx) {
  const dias = janela('sono');
  const datas = [];
  const pontos = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    datas.push(d);
    const hS = horasDeSono(d);
    if (hS != null) pontos.push({ x: dias - 1 - i, y: hS, situacao: situacaoSono(d) });
  }
  const m = media(pontos.map((p) => p.y));
  const alvo = alvoSono();
  // conta pela mesma régua que pinta as barras, senão o texto contradiz a cor
  const falhas = datas.filter((d) => situacaoSono(d) === 'fora').length;

  return cartao({
    titulo: 'Sono',
    periodo: periodoEmDias('sono', ctx),
    metrica: m != null ? duracao(m * 60) : '—',
    legenda: falhas
      ? `${falhas} ${falhas === 1 ? 'noite fora' : 'noites fora'} do alvo`
      : (alvo != null ? `Média por noite · alvo ${duracao(alvo * 60)}` : 'Média por noite'),
    legendaSituacao: falhas ? 'fora' : 'noAlvo',
  },
    grafico({
      // sem base0: no modelo o eixo vai de 4h a 9h, não do zero
      altura: 140, descricao: 'horas de sono por noite', meta: alvo,
      xMin: 0, xMax: dias - 1,
      formatoY: (y) => `${Math.round(y)}h`,
      rotulosX: rotulosDeDatas(datas, 5),
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- aderência ---------------- */

function cartaoAderencia(dia, ctx) {
  const n = janela('aderencia');
  const dias = Array.from({ length: n }, (_, i) => somaDias(dia, -(n - 1 - i)));
  let totalGeral = 0;
  let okGeral = 0;
  const pontos = dias.map((d, x) => {
    const ad = diaAderencia(d);
    const total = ad.atividades.filter((a) => a.registrada).length;
    const ok = ad.atividades.filter((a) => a.registrada && (a.status === 'noAlvo' || a.status === 'deriva')).length;
    totalGeral += total;
    okGeral += ok;
    const pct = total ? Math.round((ok / total) * 100) : 0;
    return { x, y: pct, situacao: situacaoDoPercentual(pct, total > 0) };
  });
  const pct = totalGeral ? Math.round((okGeral / totalGeral) * 100) : null;

  return cartao({
    titulo: 'Aderência',
    periodo: periodoEmDias('aderencia', ctx),
    metrica: pct != null ? `${pct}%` : '—',
    legenda: `No horário · ${okGeral} de ${totalGeral} registros`,
  },
    grafico({
      altura: 140, descricao: 'aderência por dia', yMin: 0, yMax: 100, yTicks: 4,
      xMin: 0, xMax: dias.length - 1,
      formatoY: (y) => `${Math.round(y)}%`,
      rotulosX: dias.map((d, x) => ({
        x, texto: `${DIAS[new Date(`${d}T12:00`).getDay()]} ${d.slice(8)}`,
      })),
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- creatina ---------------- */

function cartaoCreatina(dia, ctx) {
  const dias = semanaCreatina(dia);
  const { feitos, total, decorridos } = contagemCreatina(dia);
  const seguidos = sequenciaCreatina(dia);
  const faltam = decorridos - feitos;

  const legenda = faltam === 0
    ? (seguidos > 1 ? `${seguidos} dias seguidos` : 'Em dia')
    : `${faltam} ${faltam === 1 ? 'dia em aberto' : 'dias em aberto'}`;

  return cartao({
    titulo: 'Creatina',
    periodo: 'Esta semana',
    metrica: `${feitos}/${total}`,
    legenda,
    legendaSituacao: faltam === 0 ? 'noAlvo' : null,
  },
    h('div', { class: 'creatina-semana' }, dias.map((d) => h('div', { class: 'creatina-dia' },
      h('span', { class: 'creatina-inicial' }, d.inicial),
      h('button', {
        class: ['creatina-marca', d.tomou && 'feito', d.hoje && 'hoje', d.futuro && 'futuro']
          .filter(Boolean).join(' '),
        disabled: d.futuro || null,
        'aria-pressed': d.futuro ? null : String(d.tomou),
        'aria-label': `${dataCurta(d.data)}${d.tomou ? ', tomou' : ', não tomou'}`,
        onclick: d.futuro ? null : () => { alternarCreatina(d.data); ctx.recarregar(); },
      }, d.tomou ? icone('check') : null)))));
}

/* ---------------- deslocamento ---------------- */

function cartaoDeslocamento() {
  const rotas = comparacao().sort((a, b) => b.medianaDuracao - a.medianaDuracao);
  if (!rotas.length) {
    return cartao({ titulo: 'Deslocamento', periodo: 'Por trajeto' },
      vazio('Registre suas viagens para o app aprender o tempo de cada trajeto.'));
  }
  const maior = rotas[0].medianaDuracao;

  return cartao({
    titulo: 'Deslocamento',
    periodo: 'Por trajeto',
    metrica: duracao(rotas[0].medianaDuracao),
    legenda: `${rotas[0].trajeto.origem} até ${rotas[0].trajeto.destino}`,
  },
    h('div', { class: 'barras-h' }, rotas.slice(0, 4).map((c) => h('div', { class: 'barra-h' },
      h('div', { class: 'barra-h-topo' },
        h('span', { class: 'linha-sub' }, `${c.trajeto.origem} → ${c.trajeto.destino}`),
        h('span', { class: 'barra-h-valor' }, duracao(c.medianaDuracao))),
      h('div', { class: 'barra-h-trilho' },
        h('div', { class: 'barra-h-cheia', vars: { fracao: c.medianaDuracao / maior } }))))));
}

/* ---------------- volume de treino ---------------- */

function cartaoVolume(ctx) {
  const dia = diaLogico();
  const semanas = janela('volume');
  const pontos = [];
  const rotulos = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = somaDias(inicioSemana(dia), -i * 7);
    const fim = somaDias(ini, 6);
    const volume = historico()
      .filter((t) => t.data >= ini && t.data <= fim)
      .reduce((a, t) => a + (t.exercicios || []).reduce((b, e) => b + (e.carga || 0) * (e.reps || 0), 0), 0);
    const x = semanas - 1 - i;
    pontos.push({ x, y: volume });
    // um rótulo a cada N semanas, para 26 semanas não virarem 13 datas coladas
    if (i % Math.max(1, Math.round(semanas / 5)) === 0) rotulos.push({ x, texto: dataCurta(ini) });
  }
  const desde = somaDias(dia, -6);
  const ultimos7 = historico()
    .filter((t) => t.data >= desde && t.data <= dia)
    .reduce((a, t) => a + (t.exercicios || []).reduce((b, e) => b + (e.carga || 0) * (e.reps || 0), 0), 0);

  return cartao({
    titulo: 'Volume de treino',
    // agregado por semana, então o seletor é em semanas, não em dias
    periodo: periodoEmSemanas('volume', ctx),
    metrica: nUm(ultimos7 / 1000, 1),
    unidade: 't',
    legenda: ultimos7 ? 'Carga levantada nos últimos 7 dias' : 'Sem treino nos últimos 7 dias',
  },
    grafico({
      altura: 120, descricao: 'volume de treino por semana', base0: true, yTicks: 2,
      formatoY: (y) => `${nUm(y / 1000, 1)} t`, rotulosX: rotulos,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- corrida ---------------- */

function cartaoCorrida(ctx) {
  // pace só existe onde há distância e tempo; o resto não entra no gráfico
  const desde = somaDias(diaLogico(), -(janela('corrida') - 1));
  const lista = corridas()
    .filter((c) => c.distanciaKm > 0 && c.minutos > 0 && c.data >= desde)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (!lista.length) {
    return cartao({ titulo: 'Corrida', periodo: periodoEmDias('corrida', ctx) },
      vazio('Nenhuma corrida com distância e tempo neste período.'));
  }

  const pontos = lista.map((c, x) => ({ x, y: c.minutos / c.distanciaKm }));
  const ultimo = pontos[pontos.length - 1].y;
  const km = lista.reduce((a, c) => a + c.distanciaKm, 0);

  return cartao({
    titulo: 'Corrida',
    subtitulo: 'Pace por treino',
    periodo: periodoEmDias('corrida', ctx),
    metrica: paceTexto(ultimo),
    unidade: 'min/km',
    legenda: `Último treino · ${nUm(km, 1)} km em ${lista.length} ${lista.length === 1 ? 'corrida' : 'corridas'}`,
  },
    grafico({
      altura: 140, descricao: 'pace das últimas corridas',
      formatoY: (y) => paceTexto(y),
      rotulosX: lista.map((c, x) => ({ x, texto: dataCurta(c.data) })),
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

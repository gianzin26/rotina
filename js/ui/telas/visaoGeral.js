// ui/telas/visaoGeral.js — painel de entrada no computador.
// Reúne as tendências: hora de acordar, peso, aderência, sono, deslocamento,
// volume de treino e corrida.

import { semana as semanaAderencia } from '../../nucleo/aderencia.js';
import { horasDeSono } from '../../nucleo/agenda.js';
import { comparacao } from '../../nucleo/deslocamento.js';
import { resumo as resumoPeso, serie as seriePeso } from '../../nucleo/peso.js';
import { estado, registroDoDia } from '../../nucleo/store.js';
import { corridas, historico } from '../../nucleo/treino.js';
import {
  DIAS, dataCurta, diaLogico, diffDias, duracao, hhmm, inicioSemana, media, min, nUm, somaDias,
} from '../../nucleo/util.js';
import { cartao } from '../cartao.js';
import { anexar, h, vazio } from '../dom.js';
import { grafico } from '../grafico.js';

const JANELA = 30; // "últimos 30 dias", como na referência

export function render(tela, ctx) {
  const dia = diaLogico();

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {}, h('h1', {}, 'Visão geral'))),
    h('div', { class: 'grade' },
      cartaoHoraDeAcordar(dia),
      cartaoPeso(),
      cartaoAderencia(dia),
      cartaoSono(dia),
      cartaoDeslocamento(),
      cartaoVolume(),
      cartaoCorrida()));
}

/* ---------------- hora de acordar ---------------- */

function cartaoHoraDeAcordar(dia) {
  const pontos = [];
  const rotulosX = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    const s = registroDoDia('sono', d);
    const x = JANELA - 1 - i;
    if (s?.acordou) pontos.push({ x, y: min(s.acordou) });
    if (i === JANELA - 1 || i === Math.floor(JANELA / 2) || i === 0) rotulosX.push({ x, texto: dataCurta(d) });
  }
  const plano = estado.rotina.find((r) => r.tipo === 'acordar');
  const alvo = plano ? min(plano.inicio) : null;
  const m = media(pontos.map((p) => p.y));

  return cartao({
    titulo: 'Hora de acordar',
    periodo: 'Últimos 30 dias',
    metrica: m != null ? hhmm(Math.round(m)) : '—',
    legenda: 'Média',
  },
    grafico({
      altura: 140, descricao: 'hora de acordar nos últimos 30 dias',
      yInvertido: true, formatoY: (y) => hhmm(y), rotulosX, meta: alvo,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- peso ---------------- */

function cartaoPeso() {
  const s = seriePeso();
  const r = resumoPeso();
  if (!s.length) {
    return cartao({ titulo: 'Peso', periodo: 'Média de 7 dias' },
      vazio('Registre o peso por alguns dias para ver a curva.'));
  }
  const base = s[0].data;
  const linhaMedia = s.filter((p) => p.media7 != null).map((p) => ({ x: diffDias(base, p.data), y: p.media7 }));
  const rotulosX = [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]]
    .map((p) => ({ x: diffDias(base, p.data), texto: dataCurta(p.data) }));
  const v = r.variacaoSemana;
  const [gMin, gMax] = r.ganhoAlvo;

  return cartao({
    titulo: 'Peso',
    periodo: 'Média de 7 dias',
    metrica: r.media7 != null ? nUm(r.media7, 1) : '—',
    unidade: 'kg',
    legenda: v != null
      ? `${v >= 0 ? '+' : '−'}${nUm(Math.abs(v), 2)} kg esta semana`
      : 'aguardando 7 dias de pesagem',
    legendaSituacao: v == null ? null : v >= gMin && v <= gMax ? 'noAlvo' : v > 0 ? 'deriva' : 'fora',
  },
    grafico({
      altura: 140, descricao: 'média de 7 dias do peso',
      formatoY: (y) => `${nUm(y, 1)} kg`, rotulosX, meta: r.alvo,
      series: [{ tipo: 'area', serie: 'serie-principal', pontos: linhaMedia }],
    }));
}

/* ---------------- aderência ---------------- */

function cartaoAderencia(dia) {
  const inicio = inicioSemana(dia);
  const sem = semanaAderencia(inicio);
  const pontos = sem.dias.map((d, x) => {
    const total = d.atividades.filter((a) => a.registrada).length;
    const ok = d.atividades.filter((a) => a.registrada && (a.status === 'noAlvo' || a.status === 'deriva')).length;
    return { x, y: total ? Math.round((ok / total) * 100) : 0 };
  });

  return cartao({
    titulo: 'Aderência',
    periodo: 'Esta semana',
    metrica: sem.percentual != null ? `${sem.percentual}%` : '—',
    legenda: 'No horário',
  },
    grafico({
      altura: 140, descricao: 'aderência por dia da semana', yMin: 0, yMax: 100, yTicks: 4,
      formatoY: (y) => `${Math.round(y)}%`,
      rotulosX: pontos.map((p, i) => ({ x: i, texto: DIAS[(i + 1) % 7] })),
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- sono ---------------- */

function cartaoSono(dia) {
  const pontos = [];
  const rotulosX = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    const hS = horasDeSono(d);
    const x = JANELA - 1 - i;
    if (hS != null) pontos.push({ x, y: hS, situacao: hS < 6 ? 'fora' : null });
    if (i === JANELA - 1 || i === Math.floor(JANELA / 2) || i === 0) rotulosX.push({ x, texto: dataCurta(d) });
  }
  const m = media(pontos.map((p) => p.y));

  return cartao({
    titulo: 'Sono',
    periodo: 'Últimos 30 dias',
    metrica: m != null ? duracao(m * 60) : '—',
    legenda: 'Média por noite',
  },
    grafico({
      altura: 140, descricao: 'horas de sono por noite', base0: true, meta: 6,
      formatoY: (y) => `${Math.round(y)}h`, rotulosX,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
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

/* ---------------- volume de treino e corrida ---------------- */

function cartaoVolume() {
  const dia = diaLogico();
  const semanas = 8;
  const pontos = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = somaDias(inicioSemana(dia), -i * 7);
    const fim = somaDias(ini, 6);
    const volume = historico()
      .filter((t) => t.data >= ini && t.data <= fim)
      .reduce((a, t) => a + (t.exercicios || []).reduce((b, e) => b + (e.carga || 0) * (e.reps || 0), 0), 0);
    pontos.push({ x: semanas - 1 - i, y: volume });
  }
  const atual = pontos[pontos.length - 1]?.y ?? 0;

  return cartao({
    titulo: 'Volume de treino',
    pequeno: true,
    metrica: atual ? nUm(atual / 1000, 1) : '—',
    unidade: atual ? 't' : null,
    legenda: 'Semana atual',
  },
    grafico({
      altura: 64, descricao: 'volume de treino por semana', base0: true, yTicks: 0, semRotulos: true,
      series: [{ tipo: 'area', serie: 'serie-principal', pontos }],
    }));
}

function cartaoCorrida() {
  const lista = corridas().filter((c) => c.distanciaKm && c.minutos).slice(0, 7).reverse();
  const ritmos = lista.map((c, x) => ({ x, y: c.minutos / c.distanciaKm }));
  const m = media(ritmos.map((p) => p.y));

  return cartao({
    titulo: 'Corrida',
    pequeno: true,
    metrica: m != null ? `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}` : '—',
    unidade: m != null ? 'min/km' : null,
    legenda: 'Ritmo médio recente',
  },
    grafico({
      altura: 64, descricao: 'ritmo das últimas corridas', yTicks: 0, semRotulos: true,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos: ritmos }],
    }));
}

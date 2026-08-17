// ui/telas/corpo.js — peso, hora de acordar e sono.

import { horasDeSono } from '../../nucleo/agenda.js';
import { resumo as resumoPeso, serie as seriePeso } from '../../nucleo/peso.js';
import { estado, registroDoDia, upsertDia } from '../../nucleo/store.js';
import {
  dataCurta, diaLogico, duracao, diffDias, hhmm, media, min, nUm, somaDias,
} from '../../nucleo/util.js';
import { cartao, dado, fileiraDados } from '../cartao.js';
import { anexar, h, vazio } from '../dom.js';
import { aviso, escolherNumero } from '../folha.js';
import { grafico } from '../grafico.js';
import { icone } from '../icones.js';

const JANELA = 14; // duas semanas: barra larga o bastante para ler

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

export function render(tela, ctx) {
  const dia = diaLogico();

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Corpo'),
        h('p', { class: 'cabecalho-sub' }, 'Peso, sono e medidas'))),
    h('div', { class: 'grade' },
      cartaoPeso(dia, ctx),
      cartaoHoraDeAcordar(dia),
      cartaoSono(dia)));
}

/* ---------------- peso ---------------- */

function cartaoPeso(dia, ctx) {
  const s = seriePeso();
  const r = resumoPeso();
  const hojeReg = registroDoDia('peso', dia);

  const registrar = () => escolherNumero({
    titulo: 'Peso de hoje', rotulo: 'Quilos', valor: hojeReg?.kg ?? r.media7 ?? '', passo: 0.1, sufixo: 'kg',
    aoEscolher: (v) => { upsertDia('peso', dia, { kg: v }); aviso('Peso registrado.'); ctx.recarregar(); },
    aoApagar: hojeReg?.kg != null ? () => { upsertDia('peso', dia, { kg: null }); ctx.recarregar(); } : null,
  });

  const v = r.variacaoSemana;
  const [gMin, gMax] = r.ganhoAlvo;
  const situacao = v == null ? null : v >= gMin && v <= gMax ? 'noAlvo' : v > 0 ? 'deriva' : 'fora';

  const corpo = [];
  if (s.length) {
    const base = s[0].data;
    const pontos = s.map((p) => ({ x: diffDias(base, p.data), y: p.kg }));
    const linhaMedia = s.filter((p) => p.media7 != null).map((p) => ({ x: diffDias(base, p.data), y: p.media7 }));
    corpo.push(grafico({
      altura: 160, descricao: 'peso diário e média de 7 dias',
      formatoY: (y) => `${nUm(y, 1)} kg`, meta: r.alvo,
      rotulosX: s.filter((_, i) => i % Math.max(1, Math.round(s.length / 5)) === 0 || i === s.length - 1)
        .map((p) => ({ x: diffDias(base, p.data), texto: dataCurta(p.data) })),
      series: [
        { tipo: 'pontos', serie: 'serie-apagada', pontos },
        { tipo: 'linha', serie: 'serie-principal', pontos: linhaMedia },
      ],
    }));
  } else {
    corpo.push(vazio('Registre o peso por alguns dias para ver a curva.'));
  }

  corpo.push(
    fileiraDados(
      dado('Hoje', hojeReg?.kg != null ? nUm(hojeReg.kg, 1) : 'registrar', {
        sufixo: hojeReg?.kg != null ? 'kg' : null, aoTocar: registrar,
      }),
      dado('Alvo', r.alvo ? nUm(r.alvo, 0) : '—', { sufixo: r.alvo ? 'kg' : null }),
      dado('Falta', r.faltaParaAlvo != null ? nUm(Math.abs(r.faltaParaAlvo), 1) : '—', {
        sufixo: r.faltaParaAlvo != null ? 'kg' : null,
      })),
    ...r.alertas.map((a) => h('p', { class: `alerta ${a.nivel === 'fora' ? 'vermelho' : ''}` }, a.texto)),
    h('button', { class: 'botao primario largura-total', onclick: registrar },
      icone(hojeReg?.kg != null ? 'lapis' : 'mais'),
      hojeReg?.kg != null ? 'Corrigir peso de hoje' : 'Registrar peso de hoje'));

  return cartao({
    titulo: 'Peso',
    periodo: 'Média de 7 dias',
    metrica: r.media7 != null ? nUm(r.media7, 1) : '—',
    unidade: 'kg',
    legenda: v != null
      ? `${v >= 0 ? '+' : '−'}${nUm(Math.abs(v), 2)} kg esta semana`
      : 'aguardando 7 dias de pesagem',
    legendaSituacao: situacao,
  }, ...corpo);
}

/* ---------------- hora de acordar ---------------- */

function cartaoHoraDeAcordar(dia) {
  const pontos = [];
  const datas = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    datas.push(d);
    const s = registroDoDia('sono', d);
    if (s?.acordou) pontos.push({ x: JANELA - 1 - i, y: min(s.acordou) });
  }
  const rotulosX = rotulosDeDatas(datas, 5);
  const plano = estado.rotina.find((r) => r.tipo === 'acordar');
  const alvo = plano ? min(plano.inicio) : null;
  const m = media(pontos.map((p) => p.y));

  return cartao({
    titulo: 'Hora de acordar',
    periodo: 'Últimos 14 dias',
    metrica: m != null ? hhmm(Math.round(m)) : '—',
    legenda: alvo != null ? `Média · alvo ${hhmm(alvo)}` : 'Média',
  },
    grafico({
      altura: 160, descricao: 'hora de acordar nos últimos 14 dias',
      // barras crescendo do chão, como no modelo: mais alto = acordou mais tarde
      formatoY: (y) => hhmm(y), rotulosX, meta: alvo,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

/* ---------------- sono ---------------- */

function cartaoSono(dia) {
  const pontos = [];
  const datas = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    datas.push(d);
    const hS = horasDeSono(d);
    if (hS != null) pontos.push({ x: JANELA - 1 - i, y: hS, situacao: hS < 6 ? 'fora' : null });
  }
  const rotulosX = rotulosDeDatas(datas, 5);
  const m = media(pontos.map((p) => p.y));
  const curtas = pontos.filter((p) => p.y < 6).length;

  return cartao({
    titulo: 'Sono',
    periodo: 'Últimos 14 dias',
    metrica: m != null ? duracao(m * 60) : '—',
    legenda: curtas ? `${curtas} noites abaixo de 6 h` : 'Média por noite',
    legendaSituacao: curtas ? 'fora' : null,
  },
    grafico({
      // sem base0: no modelo o eixo vai de 4h a 9h, não do zero
      altura: 160, descricao: 'horas de sono por noite', meta: 6,
      formatoY: (y) => `${Math.round(y)}h`, rotulosX,
      series: [{ tipo: 'barras', serie: 'serie-principal', pontos }],
    }));
}

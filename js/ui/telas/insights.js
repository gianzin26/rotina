// ui/telas/insights.js — os gráficos de tendência num lugar só:
// hora de acordar, sono, peso e aderência.

import { diaAderencia, mes, sequenciaAcordar } from '../../nucleo/aderencia.js';
import { horasDeSono } from '../../nucleo/agenda.js';
import { resumo as resumoPeso, serie as seriePeso } from '../../nucleo/peso.js';
import { alternarSemanaAtipica, estado, registroDoDia, semanaAtipica } from '../../nucleo/store.js';
import {
  DIAS, dataCurta, dataLonga, diaLogico, diffDias, duracao, fmtDesvio,
  hhmm, inicioSemana, media, min, nUm, somaDias,
} from '../../nucleo/util.js';
import { cartao, dado, fileiraDados, linha } from '../cartao.js';
import { anexar, bolinha, classeSituacao, h, vazio } from '../dom.js';
import { folha } from '../folha.js';
import { grafico, legenda } from '../grafico.js';
import { icone } from '../icones.js';

const JANELA = 42; // seis semanas

export function render(tela, ctx) {
  const dia = diaLogico();

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Insights'),
        h('p', { class: 'cabecalho-sub' }, 'Tendência das últimas seis semanas'))),
    h('div', { class: 'grade' },
      cartaoHoraDeAcordar(dia),
      cartaoSono(dia),
      cartaoPeso(),
      cartaoAderencia(dia, ctx)));
}

/* ---------------- hora de acordar ---------------- */

function cartaoHoraDeAcordar(dia) {
  const pontos = [];
  const rotulosX = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    const s = registroDoDia('sono', d);
    const x = JANELA - 1 - i;
    if (s?.acordou) {
      const o = diaAderencia(d).atividades.find((a) => a.tipo === 'acordar');
      pontos.push({ x, y: min(s.acordou), situacao: o?.registrada ? o.status : null });
    }
    if (i % 14 === 0) rotulosX.push({ x, texto: dataCurta(d) });
  }

  const plano = estado.rotina.find((r) => r.tipo === 'acordar');
  const alvo = plano ? min(plano.inicio) : null;
  const mediaAcordar = media(pontos.map((p) => p.y));
  const desvioMedio = mediaAcordar != null && alvo != null ? mediaAcordar - alvo : null;

  return cartao({
    titulo: 'Hora de acordar',
    subtitulo: 'A métrica principal: distância entre planejado e real',
    periodo: '6 semanas',
    metrica: mediaAcordar != null ? hhmm(Math.round(mediaAcordar)) : '—',
    legenda: alvo != null ? `média · alvo ${hhmm(alvo)}` : 'média',
    delta: desvioMedio != null && {
      texto: fmtDesvio(desvioMedio),
      situacao: Math.abs(desvioMedio) <= 5 ? 'noAlvo' : desvioMedio > 20 ? 'fora' : 'deriva',
      sentido: desvioMedio > 0 ? 'desceu' : 'subiu',
    },
    largo: true,
  },
    grafico({
      altura: 180, descricao: 'hora de acordar nas últimas seis semanas',
      yInvertido: true, formatoY: (y) => hhmm(y), rotulosX, meta: alvo,
      series: [{ tipo: 'linha', serie: 'serie-principal', marcadores: true, pontos }],
    }),
    legenda([{ serie: 'serie-principal', rotulo: 'hora registrada' }, { serie: 'serie-meta', rotulo: 'alvo' }]));
}

/* ---------------- sono ---------------- */

function cartaoSono(dia) {
  const pontos = [];
  const rotulosX = [];
  for (let i = JANELA - 1; i >= 0; i--) {
    const d = somaDias(dia, -i);
    const hSono = horasDeSono(d);
    const x = JANELA - 1 - i;
    if (hSono != null) pontos.push({ x, y: hSono, situacao: hSono < 6 ? 'fora' : null });
    if (i % 14 === 0) rotulosX.push({ x, texto: dataCurta(d) });
  }
  const mediaHoras = media(pontos.map((p) => p.y));
  const curtas = pontos.filter((p) => p.y < 6).length;

  return cartao({
    titulo: 'Horas de sono',
    subtitulo: 'Noites abaixo de 6 h aparecem em vermelho',
    periodo: '6 semanas',
    metrica: mediaHoras != null ? duracao(mediaHoras * 60) : '—',
    legenda: `média de ${pontos.length} ${pontos.length === 1 ? 'noite' : 'noites'}`,
    delta: curtas > 0 && { texto: `${curtas} curtas`, situacao: 'fora' },
  },
    grafico({
      altura: 180, descricao: 'horas de sono por noite', base0: true,
      formatoY: (y) => `${y.toFixed(1).replace('.', ',')} h`, rotulosX, meta: 6,
      series: [{ tipo: 'barras', serie: 'serie-sono', pontos }],
    }));
}

/* ---------------- peso ---------------- */

function cartaoPeso() {
  const s = seriePeso();
  const r = resumoPeso();
  if (!s.length) {
    return cartao({ titulo: 'Peso', subtitulo: 'Pontos diários e média de 7 dias' },
      vazio('Registre o peso por alguns dias para ver a curva.'));
  }

  const base = s[0].data;
  const pontos = s.map((p) => ({ x: diffDias(base, p.data), y: p.kg }));
  const linhaMedia = s.filter((p) => p.media7 != null).map((p) => ({ x: diffDias(base, p.data), y: p.media7 }));
  const rotulosX = [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]]
    .map((p) => ({ x: diffDias(base, p.data), texto: dataCurta(p.data) }));

  const [gMin, gMax] = r.ganhoAlvo;
  const v = r.variacaoSemana;

  return cartao({
    titulo: 'Peso',
    subtitulo: 'Pontos diários e média móvel de 7 dias',
    periodo: `${s.length} pesagens`,
    metrica: r.media7 != null ? nUm(r.media7, 1) : '—',
    unidade: 'kg',
    legenda: r.alvo ? `média de 7 dias · alvo ${nUm(r.alvo, 0)} kg` : 'média de 7 dias',
    delta: v != null && {
      texto: `${v >= 0 ? '+' : '−'}${nUm(Math.abs(v), 2)} kg/sem`,
      situacao: v >= gMin && v <= gMax ? 'noAlvo' : v > 0 ? 'deriva' : 'fora',
      sentido: v >= 0 ? 'subiu' : 'desceu',
    },
    largo: true,
  },
    grafico({
      altura: 200, descricao: 'peso diário e média de 7 dias',
      formatoY: (y) => nUm(y, 1), rotulosX,
      series: [
        { tipo: 'pontos', serie: 'serie-apagada', pontos },
        { tipo: 'linha', serie: 'serie-principal', pontos: linhaMedia },
      ],
    }),
    legenda([
      { serie: 'serie-apagada', rotulo: 'pesagem do dia' },
      { serie: 'serie-principal', rotulo: 'média de 7 dias' },
    ]));
}

/* ---------------- aderência ---------------- */

function cartaoAderencia(dia, ctx) {
  const hojeAd = diaAderencia(dia);
  const seq = sequenciaAcordar();
  const semana = inicioSemana(dia);
  const atipica = semanaAtipica(semana);
  const agora = new Date();
  const cal = mes(agora.getFullYear(), agora.getMonth());

  const grade = h('div', { class: 'calendario' });
  for (const dn of DIAS) grade.append(h('span', { class: 'cal-dow' }, dn[0]));
  for (let i = 0; i < cal.primeiroDiaSemana; i++) grade.append(h('span', {}));
  for (const d of cal.dias) {
    grade.append(h('button', {
      class: `cal-dia ${classeSituacao(d.status)} ${d.dataISO === dia ? 'hoje' : ''}`,
      title: `${d.dataISO} — ${d.registradas}/${d.previstas} registrados`,
      onclick: () => detalheDia(d.dataISO),
    }, d.dia));
  }

  const noAlvo = cal.dias.filter((d) => d.status === 'noAlvo' || d.status === 'deriva').length;

  return cartao({
    titulo: 'Aderência',
    subtitulo: 'Amarelo conta como cumprido — revela deriva, não falha',
    periodo: 'Este mês',
    metrica: String(seq),
    unidade: seq === 1 ? 'dia' : 'dias',
    legenda: 'sequência no alvo de acordar',
    delta: { texto: `${noAlvo} dias no alvo`, situacao: 'noAlvo', sentido: 'subiu' },
    largo: true,
  },
    grade,
    fileiraDados(
      dado('Hoje', `${hojeAd.registradas}/${hojeAd.previstas}`, { situacao: hojeAd.status }),
      dado('Semana', atipica ? 'atípica' : 'normal', { situacao: atipica ? 'atipico' : null })),
    h('button', {
      class: `botao largura-total ${atipica ? 'ativo' : ''}`,
      onclick: () => { alternarSemanaAtipica(semana, 'marcada no app'); ctx.recarregar(); },
    }, atipica && icone('check'),
      atipica ? 'Semana atípica — desmarcar' : 'Marcar semana como atípica'));
}

function detalheDia(dataISO) {
  const d = diaAderencia(dataISO);
  folha(dataLonga(dataISO), () => h('div', { class: 'pilha' },
    d.atipica && h('p', { class: 'alerta' }, 'Semana marcada como atípica — fora do cálculo.'),
    d.atividades.length
      ? h('div', { class: 'lista' }, d.atividades.map((a) => linha(
        h('span', { class: 'linha-titulo' }, bolinha(a.registrada ? a.status : 'semRegistro'), ' ', a.titulo),
        h('span', { class: `dado-valor ${classeSituacao(a.status)}` },
          a.registrada ? fmtDesvio(a.desvio) : 'sem registro'),
      )))
      : vazio('Nada previsto nesse dia.')));
}

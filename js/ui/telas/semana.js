// ui/telas/semana.js — grade de calendário: dias em colunas, horas em linhas.
// Previsto em contorno tracejado, realizado preenchido, cor por tipo.

import { ocorrencias } from '../../nucleo/agenda.js';
import { agoraNoDia } from '../../nucleo/acoes.js';
import { semana as semanaAderencia } from '../../nucleo/aderencia.js';
import {
  DIAS, dataCurta, dataLonga, diaLogico, fmtDesvio, hhmm, inicioSemana, somaDias,
} from '../../nucleo/util.js';
import { cartao, linha } from '../cartao.js';
import { anexar, classeSituacao, h, vazio } from '../dom.js';
import { folha } from '../folha.js';
import { icone } from '../icones.js';

const INICIO = 300;  // 5:00
const FIM = 1440;    // 00:00

let deslocamentoSemanas = 0; // 0 = semana atual

export function render(tela, ctx) {
  const hoje = diaLogico();
  const inicio = somaDias(inicioSemana(hoje), deslocamentoSemanas * 7);
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
  const sem = semanaAderencia(inicio);

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Semana'),
        h('p', { class: 'cabecalho-sub' }, `${dataCurta(inicio)} a ${dataCurta(dias[6])}`)),
      h('div', { class: 'cabecalho-acoes' },
        h('button', {
          class: 'icone-botao', 'aria-label': 'Semana anterior',
          onclick: () => { deslocamentoSemanas--; ctx.recarregar(); },
        }, icone('chevronDireita', { classe: 'girar-180' })),
        h('button', {
          class: 'icone-botao', 'aria-label': 'Semana seguinte',
          onclick: () => { deslocamentoSemanas++; ctx.recarregar(); },
        }, icone('chevronDireita')))),
    // o cronograma precisa da largura inteira: sete colunas não cabem numa só
    h('div', { class: 'faixa-larga' },
      cartao({
        titulo: 'Cronograma',
        periodo: deslocamentoSemanas === 0 ? 'Esta semana' : `${dataCurta(inicio)}`,
        metrica: sem.percentual != null ? `${sem.percentual}%` : '—',
        legenda: 'No horário',
      }, gradeSemana(dias, hoje, ctx))),
    h('div', { class: 'grade' }, cartaoResumo(sem, dias)));
}

/* ---------------- a grade ---------------- */

function gradeSemana(dias, hoje, ctx) {
  const grade = h('div', { class: 'semana' });

  // cabeçalho: canto vazio + sete dias
  grade.append(h('span', { class: 'semana-cabecalho' }));
  for (const d of dias) {
    grade.append(h('span', {
      class: `semana-cabecalho ${d === hoje ? 'hoje' : ''}`,
    }, `${DIAS[new Date(`${d}T12:00`).getDay()]} ${Number(d.slice(8))}`));
  }

  // coluna das horas
  const horas = h('div', { class: 'semana-horas' });
  for (let m = INICIO; m <= FIM; m += 180) {
    horas.append(h('span', { class: 'semana-hora', vars: { inicio: m } }, hhmm(m)));
  }
  grade.append(horas);

  // uma coluna por dia
  for (const d of dias) {
    const col = h('div', { class: 'semana-coluna' });
    for (let m = INICIO; m <= FIM; m += 180) {
      col.append(h('div', { class: 'semana-linha', vars: { inicio: m } }));
    }
    for (const o of ocorrencias(d)) {
      if (o.inicio == null) continue;
      const fim = o.fim ?? o.inicio + 30;
      const feito = o.real?.inicio != null;
      col.append(h('button', {
        class: `sem-bloco tipo-${o.tipo} ${feito ? 'feito' : ''}`,
        vars: {
          inicio: Math.max(INICIO, Math.min(o.inicio, FIM)),
          fim: Math.max(INICIO, Math.min(fim, FIM)),
        },
        title: `${o.titulo} · ${hhmm(o.inicio)}`,
        onclick: () => detalhe(o, d),
      }, h('span', { class: 'sem-bloco-titulo' }, o.titulo)));
    }
    if (d === hoje) {
      col.append(h('div', {
        class: 'semana-agora',
        vars: { inicio: Math.max(INICIO, Math.min(agoraNoDia(d), FIM)) },
      }));
    }
    grade.append(col);
  }
  return h('div', { class: 'semana-rolagem' }, grade);
}

function detalhe(o, dataISO) {
  folha(`${o.titulo} · ${dataLonga(dataISO)}`, () => h('div', { class: 'pilha' },
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-titulo' }, 'Previsto'),
        h('span', { class: 'dado-valor' }, o.fim ? `${hhmm(o.inicio)}–${hhmm(o.fim)}` : hhmm(o.inicio))),
      o.real?.inicio != null && linha(
        h('span', { class: 'linha-titulo' }, 'Real'),
        h('span', { class: `dado-valor ${classeSituacao(o.status)}` },
          `${hhmm(o.real.inicio)}${o.real.fim != null ? `–${hhmm(o.real.fim)}` : ''}`)),
      o.desvio != null && linha(
        h('span', { class: 'linha-titulo' }, 'Desvio'),
        h('span', { class: `dado-valor ${classeSituacao(o.status)}` }, fmtDesvio(o.desvio))),
      o.local && linha(h('span', { class: 'linha-titulo' }, 'Local'),
        h('span', { class: 'linha-sub' }, o.local))),
    !o.real && h('p', { class: 'texto-suave' }, 'Sem registro nesta atividade.')));
}

/* ---------------- resumo da semana ---------------- */

function cartaoResumo(sem, dias) {
  const porDia = sem.dias.map((d, i) => ({ d, dia: dias[i] }));
  return cartao({ titulo: 'Dia a dia', periodo: `${sem.total} registros` },
    porDia.some((x) => x.d.registradas)
      ? h('div', { class: 'lista' }, porDia.map(({ d, dia }) => linha(
        [
          h('span', { class: 'linha-titulo' }, DIAS[new Date(`${dia}T12:00`).getDay()]),
          h('span', { class: 'linha-sub' }, dataCurta(dia)),
        ],
        h('span', { class: `dado-valor ${classeSituacao(d.status)}` },
          d.previstas ? `${d.registradas}/${d.previstas}` : '—'),
      )))
      : vazio('Nenhum registro nesta semana.'));
}

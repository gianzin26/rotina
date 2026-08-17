// ui/telas/peso.js — registro do dia. O número que manda é a média de 7 dias.
// A curva de evolução mora na aba Insights.

import { cinturas, resumo } from '../../nucleo/peso.js';
import { estado, registroDoDia, upsertDia } from '../../nucleo/store.js';
import { dataCurta, diaLogico, diffDias, nUm, somaDias } from '../../nucleo/util.js';
import { cartao, dado, fileiraDados, linha } from '../cartao.js';
import { anexar, h } from '../dom.js';
import { aviso, escolherNumero } from '../folha.js';
import { icone } from '../icones.js';

export function render(tela, ctx) {
  const dia = diaLogico();
  const r = resumo();
  const hojeReg = registroDoDia('peso', dia);

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Peso'),
        h('p', { class: 'cabecalho-sub' }, 'Média móvel de 7 dias'))),
    h('div', { class: 'grade' },
      cartaoDestaque(r, hojeReg, dia, ctx),
      cartaoCintura(dia, ctx),
      cartaoMetas(r)));
}

function cartaoDestaque(r, hojeReg, dia, ctx) {
  const registrar = () => escolherNumero({
    titulo: 'Peso de hoje', rotulo: 'Quilos', valor: hojeReg?.kg ?? r.media7 ?? '', passo: 0.1, sufixo: 'kg',
    aoEscolher: (v) => { upsertDia('peso', dia, { kg: v }); aviso('Peso registrado.'); ctx.recarregar(); },
    aoApagar: hojeReg?.kg != null ? () => { upsertDia('peso', dia, { kg: null }); ctx.recarregar(); } : null,
  });

  const v = r.variacaoSemana;
  const [gMin, gMax] = r.ganhoAlvo;
  const situacao = v == null ? null : v >= gMin && v <= gMax ? 'noAlvo' : v > 0 ? 'deriva' : 'fora';

  return cartao({
    titulo: 'Média de 7 dias',
    subtitulo: 'É ela que conta, não a pesagem do dia',
    metrica: r.media7 != null ? nUm(r.media7, 1) : '—',
    unidade: 'kg',
    legenda: v != null ? 'variação na semana ao lado' : 'aguardando 7 dias de pesagem',
    delta: v != null && {
      texto: `${v >= 0 ? '+' : '−'}${nUm(Math.abs(v), 2)} kg`,
      situacao, sentido: v >= 0 ? 'subiu' : 'desceu',
    },
  },
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
}

function cartaoCintura(dia, ctx) {
  const lista = cinturas();
  const ultima = lista[0] || null;
  const registrar = () => escolherNumero({
    titulo: 'Cintura', rotulo: 'Centímetros', valor: ultima?.cinturaCm ?? '', passo: 0.5, sufixo: 'cm',
    aoEscolher: (v) => { upsertDia('peso', dia, { cinturaCm: v }); aviso('Cintura registrada.'); ctx.recarregar(); },
  });

  const atrasada = ultima ? diffDias(ultima.data, dia) >= 7 : true;
  return cartao({
    titulo: 'Cintura',
    subtitulo: 'Entrada semanal, mesma hora do dia',
    metrica: ultima ? nUm(ultima.cinturaCm, 1) : '—',
    unidade: 'cm',
    legenda: ultima ? `medida em ${dataCurta(ultima.data)}` : 'nenhuma medida ainda',
  },
    atrasada && h('p', { class: 'texto-suave' }, 'Faz uma semana ou mais desde a última medida.'),
    h('button', { class: 'botao largura-total', onclick: registrar }, icone('mais'), 'Registrar cintura'),
    lista.length > 1 && h('div', { class: 'lista' }, lista.slice(0, 6).map((c) => linha(
      h('span', { class: 'linha-titulo' }, dataCurta(c.data)),
      [
        h('span', { class: 'dado-valor' }, nUm(c.cinturaCm, 1), h('span', { class: 'dado-sufixo' }, 'cm')),
        c.kg != null && h('span', { class: 'linha-sub' }, `${nUm(c.kg, 1)} kg`),
      ],
    ))));
}

function cartaoMetas(r) {
  const [gMin, gMax] = r.ganhoAlvo;
  const semanas = r.media7 != null && r.alvo != null && gMin > 0
    ? Math.ceil((r.alvo - r.media7) / ((gMin + gMax) / 2)) : null;

  return cartao({
    titulo: 'Metas',
    subtitulo: 'Ritmo necessário para chegar ao alvo',
    metrica: semanas != null && semanas > 0 ? String(semanas) : '—',
    unidade: semanas === 1 ? 'semana' : 'semanas',
    legenda: semanas != null && semanas > 0
      ? `no ritmo atual, alvo por volta de ${dataCurta(somaDias(diaLogico(), semanas * 7))}`
      : 'defina peso alvo e ganho semanal em Ajustes',
  },
    fileiraDados(
      dado('Calorias', String(estado.perfil.kcalAlvo ?? '—'), { sufixo: 'kcal' }),
      dado('Ganho alvo', `${nUm(gMin, 2)}–${nUm(gMax, 2)}`, { sufixo: 'kg/sem' })));
}

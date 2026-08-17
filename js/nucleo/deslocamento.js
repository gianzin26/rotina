// deslocamento.js — agrega os trajetos registrados por rota e dia da semana.
// Com 5 amostras já dá para trocar a estimativa pelo tempo real.

import { ocorrencias } from './agenda.js';
import { estado, reg, trajeto } from './store.js';
import { DIAS, desvio, diaSemana, mediana, min } from './util.js';

export const AMOSTRAS_MINIMAS = 5;
const FOLGA = 5; // minutos de margem na sugestão de saída

/** Viagens completas de um trajeto, opcionalmente só as de um dia da semana. */
export function amostras(trajetoId, dow = null) {
  return reg('deslocamento')
    .filter((d) => d.trajetoId === trajetoId && d.saiu && d.chegou)
    .filter((d) => dow == null || diaSemana(d.data) === dow)
    .map((d) => {
      let dur = min(d.chegou) - min(d.saiu);
      if (dur < 0) dur += 1440;
      return { data: d.data, saiu: min(d.saiu), chegou: min(d.chegou), duracao: dur };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Uma linha por trajeto × dia da semana que já tenha alguma viagem registrada. */
export function estatisticas() {
  const fora = [];
  for (const t of estado.trajetos) {
    const todas = amostras(t.id);
    if (!todas.length) continue;
    const porDia = new Map();
    for (const a of todas) {
      const dow = diaSemana(a.data);
      if (!porDia.has(dow)) porDia.set(dow, []);
      porDia.get(dow).push(a);
    }
    for (const [dow, lista] of [...porDia].sort((a, b) => a[0] - b[0])) {
      const med = mediana(lista.map((a) => a.duracao));
      fora.push({
        trajetoId: t.id, trajeto: t, dow, dia: DIAS[dow], n: lista.length,
        medianaDuracao: med,
        estimado: t.minutosEstimados,
        diferenca: med != null ? med - t.minutosEstimados : null,
        confiavel: lista.length >= AMOSTRAS_MINIMAS,
        sugestao: sugestaoSaida(t.id, dow, med),
      });
    }
  }
  return fora;
}

/** Resumo por trajeto, para a comparação entre rotas. */
export function comparacao() {
  return estado.trajetos.map((t) => {
    const a = amostras(t.id);
    return {
      trajeto: t, n: a.length,
      medianaDuracao: mediana(a.map((x) => x.duracao)),
      pior: a.length ? Math.max(...a.map((x) => x.duracao)) : null,
      melhor: a.length ? Math.min(...a.map((x) => x.duracao)) : null,
    };
  }).filter((x) => x.n > 0);
}

/**
 * Horário de saída sugerido: chegar no compromisso seguinte com a mediana real
 * mais uma folga de 5 minutos.
 */
export function sugestaoSaida(trajetoId, dow, medianaDur = null) {
  const med = medianaDur ?? mediana(amostras(trajetoId, dow).map((a) => a.duracao));
  if (med == null) return null;

  const dataRef = referenciaDaSemana(dow);
  const oc = ocorrencias(dataRef);
  const viagem = oc.find((o) => o.tipo === 'transito' && o.trajetoId === trajetoId);
  if (!viagem) return null;

  // chegar antes do que começa logo depois da viagem; senão, o fim planejado dela
  const seguinte = oc.find((o) => o.inicio >= (viagem.fim ?? viagem.inicio) && o.tipo !== 'transito' && o.tipo !== 'dormir');
  const chegarAte = seguinte?.inicio ?? viagem.fim;
  if (chegarAte == null) return null;

  const saida = Math.round(chegarAte - med - FOLGA);
  return { saida, chegarAte, mediana: med, planejado: viagem.inicio, ajuste: desvio(viagem.inicio, saida) };
}

/** Uma data qualquer com o dia da semana pedido — só para ler a rotina recorrente. */
function referenciaDaSemana(dow) {
  const hoje = new Date();
  const d = new Date(hoje);
  d.setDate(d.getDate() + ((dow - hoje.getDay() + 7) % 7));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const nomeDoTrajeto = (id) => {
  const t = trajeto(id);
  return t ? `${t.origem} → ${t.destino}` : 'Trajeto';
};

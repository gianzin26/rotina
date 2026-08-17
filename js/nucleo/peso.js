// peso.js — média móvel de 7 dias. É ela que manda, não o peso cru do dia.

import { estado, reg } from './store.js';
import { diaLogico, diffDias, media, somaDias } from './util.js';

const JANELA = 7;

/** Série diária com a média móvel calculada por data (aguenta dias sem pesagem). */
export function serie() {
  const pesos = reg('peso').filter((p) => typeof p.kg === 'number').sort((a, b) => a.data.localeCompare(b.data));
  return pesos.map((p) => {
    const de = somaDias(p.data, -(JANELA - 1));
    const janela = pesos.filter((x) => x.data >= de && x.data <= p.data);
    return {
      data: p.data, kg: p.kg, cinturaCm: p.cinturaCm ?? null,
      media7: janela.length >= 2 ? media(janela.map((x) => x.kg)) : null,
      amostras: janela.length,
    };
  });
}

/** Média móvel na data pedida (ou a última anterior a ela). */
export function mediaEm(dataISO, s = serie()) {
  const ate = s.filter((x) => x.data <= dataISO && x.media7 != null);
  return ate.length ? ate[ate.length - 1].media7 : null;
}

export function resumo() {
  const s = serie();
  const ultimo = s[s.length - 1] || null;
  const hoje = diaLogico();
  const m = ultimo?.media7 ?? null;
  const mSemanaPassada = mediaEm(somaDias(ultimo?.data || hoje, -7), s);
  const m2Semanas = mediaEm(somaDias(ultimo?.data || hoje, -14), s);

  const variacaoSemana = m != null && mSemanaPassada != null ? m - mSemanaPassada : null;
  const [ganhoMin, ganhoMax] = estado.perfil.ganhoSemanaAlvo || [0.2, 0.35];

  const alertas = [];
  if (m != null && m2Semanas != null && s.length >= 6 && Math.abs(m - m2Semanas) < 0.1) {
    alertas.push({ nivel: 'deriva', texto: 'Média parada há 2 semanas — revise as calorias.' });
  }
  if (variacaoSemana != null) {
    if (variacaoSemana > ganhoMax + 0.15) alertas.push({ nivel: 'deriva', texto: `Ganho de ${variacaoSemana.toFixed(2)} kg/semana, acima do alvo.` });
    if (variacaoSemana < 0 && (estado.perfil.pesoAlvo ?? 0) > (m ?? 0)) alertas.push({ nivel: 'fora', texto: 'Média caindo, e o alvo é ganhar peso.' });
  }

  return {
    ultimo, media7: m, variacaoSemana, alertas,
    alvo: estado.perfil.pesoAlvo ?? null,
    faltaParaAlvo: m != null && estado.perfil.pesoAlvo != null ? estado.perfil.pesoAlvo - m : null,
    ganhoAlvo: [ganhoMin, ganhoMax],
    diasDesdeUltima: ultimo ? diffDias(ultimo.data, hoje) : null,
  };
}

/** Cintura é entrada semanal; a lista sai da mais recente para a mais antiga. */
export function cinturas() {
  return reg('peso').filter((p) => typeof p.cinturaCm === 'number')
    .sort((a, b) => b.data.localeCompare(a.data));
}

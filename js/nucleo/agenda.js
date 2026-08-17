// agenda.js — expande a rotina recorrente em ocorrências de um dia
// e cruza cada uma com o que foi de fato registrado.

import { estado, reg, registroDoDia, tolerancia } from './store.js';
import { desvio, diaSemana, min, situacao, somaDias } from './util.js';

/** Tipos que o usuário registra (os demais são só pano de fundo). */
export const REGISTRAVEIS = new Set(['acordar', 'dormir', 'transito', 'treino', 'corrida']);

/**
 * Ocorrências planejadas do dia, já com o real e o semáforo quando houver registro.
 * @returns {Array<{id,tipo,titulo,inicio,fim,local,trajetoId,sessaoId,real,desvio,status}>}
 */
export function ocorrencias(dataISO) {
  const dow = diaSemana(dataISO);
  const usados = new Set();

  const lista = estado.rotina
    .filter((i) => (i.diasSemana || []).includes(dow))
    .map((i) => {
      const inicio = min(i.inicio);
      const fim = i.fim ? min(i.fim) : null;
      const o = {
        id: i.id, tipo: i.tipo, titulo: i.titulo, inicio, fim,
        local: i.local || '', trajetoId: i.trajetoId || null, sessaoId: i.sessaoId || null,
        registravel: REGISTRAVEIS.has(i.tipo),
        real: null, desvio: null, status: 'semRegistro',
      };
      aplicarReal(o, dataISO, usados);
      return o;
    })
    .sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0));

  return lista;
}

function aplicarReal(o, dataISO, usados) {
  if (o.tipo === 'acordar' || o.tipo === 'dormir') {
    const s = registroDoDia('sono', dataISO);
    const carimbo = o.tipo === 'acordar' ? s?.acordou : s?.dormiu;
    if (carimbo) o.real = { inicio: min(carimbo), fim: null };
  } else if (o.tipo === 'transito') {
    const d = reg('deslocamento').find((x) => x.data === dataISO && !usados.has(x)
      && (x.rotinaId === o.id || (!x.rotinaId && x.trajetoId === o.trajetoId)));
    if (d) {
      usados.add(d);
      o.real = { inicio: min(d.saiu), fim: min(d.chegou) };
      o.registro = d;
    }
  } else if (o.tipo === 'treino') {
    const t = reg('treino').find((x) => x.data === dataISO && !usados.has(x)
      && (x.rotinaId === o.id || x.sessaoId === o.sessaoId));
    if (t) {
      usados.add(t);
      o.real = { inicio: min(t.inicio), fim: min(t.fim) };
      o.registro = t;
    }
  } else if (o.tipo === 'corrida') {
    const c = reg('corrida').find((x) => x.data === dataISO && !usados.has(x));
    if (c) {
      usados.add(c);
      o.real = { inicio: min(c.inicio), fim: null };
      o.registro = c;
    }
  }

  if (o.real && o.real.inicio != null && o.inicio != null) {
    o.desvio = desvio(o.inicio, o.real.inicio);
    o.status = situacao(o.desvio, tolerancia(o.tipo));
  } else if (o.registravel && o.real) {
    o.status = 'noAlvo'; // registrado sem horário comparável
  }
}

/** Próxima ocorrência ainda por vir no dia (ignora o que já passou). */
export function proxima(dataISO, agora) {
  return ocorrencias(dataISO)
    .filter((o) => o.inicio != null && o.inicio > agora && o.tipo !== 'dormir')
    .sort((a, b) => a.inicio - b.inicio)[0]
    || ocorrencias(dataISO).find((o) => o.tipo === 'dormir' && o.inicio > agora)
    || null;
}

/**
 * Blocos de sono que aparecem na linha do tempo do dia:
 * o rabo da noite anterior (até acordar) e a entrada da noite (a partir de dormir).
 */
export function blocosSono(dataISO) {
  const ontem = somaDias(dataISO, -1);
  const oHoje = ocorrencias(dataISO);
  const oOntem = ocorrencias(ontem);
  const sonoHoje = registroDoDia('sono', dataISO);
  const sonoOntem = registroDoDia('sono', ontem);

  const acordarPlan = oHoje.find((o) => o.tipo === 'acordar')?.inicio ?? null;
  const dormirPlan = oHoje.find((o) => o.tipo === 'dormir')?.inicio ?? null;
  const acordarReal = sonoHoje?.acordou ? min(sonoHoje.acordou) : null;
  const dormirReal = sonoHoje?.dormiu ? min(sonoHoje.dormiu) : null;
  const dormiuOntem = sonoOntem?.dormiu ? min(sonoOntem.dormiu) : (oOntem.find((o) => o.tipo === 'dormir')?.inicio ?? null);

  const blocos = [];
  const fimManha = acordarReal ?? acordarPlan;
  if (fimManha != null) blocos.push({ tipo: 'sono', titulo: 'Sono', inicio: 0, fim: fimManha, planejado: acordarPlan });
  const inicioNoite = dormirReal ?? dormirPlan;
  if (inicioNoite != null && inicioNoite > 300) blocos.push({ tipo: 'sono', titulo: 'Sono', inicio: inicioNoite, fim: 1440 });
  return { blocos, dormiuOntem, acordarReal, acordarPlan, dormirPlan, dormirReal };
}

/** Horas de sono da noite que terminou em `dataISO`. */
export function horasDeSono(dataISO) {
  const acordou = registroDoDia('sono', dataISO)?.acordou;
  const dormiu = registroDoDia('sono', somaDias(dataISO, -1))?.dormiu;
  if (!acordou || !dormiu) return null;
  let h = min(acordou) - min(dormiu);
  if (h < 0) h += 1440;
  return h / 60;
}

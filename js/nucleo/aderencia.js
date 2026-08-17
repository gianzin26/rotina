// aderencia.js — semáforo do dia, calendário e sequência.
// Amarelo conta como cumprido: a ideia é revelar deriva, não punir.

import { ocorrencias } from './agenda.js';
import { semanaAtipica } from './store.js';
import { cumprida, diaLogico, inicioSemana, iso, pior, somaDias } from './util.js';

/** @returns {{status:string, atividades:Array, registradas:number, previstas:number, atipica:boolean}} */
export function diaAderencia(dataISO) {
  const atipica = !!semanaAtipica(inicioSemana(dataISO));
  const previstas = ocorrencias(dataISO).filter((o) => o.registravel);
  const atividades = previstas.map((o) => ({
    tipo: o.tipo, titulo: o.titulo, status: o.status, desvio: o.desvio, registrada: !!o.real,
  }));
  const registradas = atividades.filter((a) => a.registrada);
  const status = registradas.reduce((acc, a) => pior(acc, a.status), 'semRegistro');
  return {
    status: atipica ? 'atipico' : status,
    atividades, registradas: registradas.length, previstas: previstas.length, atipica,
  };
}

/** Dias consecutivos com o acordar dentro do alvo (verde ou amarelo). */
export function sequenciaAcordar() {
  let dia = diaLogico();
  let n = 0;
  // se o dia de hoje ainda não foi registrado, a conta começa ontem
  if (!statusAcordar(dia)) dia = somaDias(dia, -1);
  for (let i = 0; i < 400; i++) {
    if (semanaAtipica(inicioSemana(dia))) { dia = somaDias(dia, -1); continue; }
    const s = statusAcordar(dia);
    if (cumprida(s)) n++;
    else break;
    dia = somaDias(dia, -1);
  }
  return n;
}

function statusAcordar(dataISO) {
  const o = ocorrencias(dataISO).find((x) => x.tipo === 'acordar');
  return o?.real ? o.status : null;
}

/** Matriz do mês para o calendário de quadradinhos. */
export function mes(ano, mesIndex) {
  const primeiro = new Date(ano, mesIndex, 1);
  const ultimo = new Date(ano, mesIndex + 1, 0);
  const hoje = diaLogico();
  const dias = [];
  for (let d = 1; d <= ultimo.getDate(); d++) {
    const dataISO = iso(new Date(ano, mesIndex, d));
    const futuro = dataISO > hoje;
    dias.push({
      dataISO, dia: d, futuro,
      ...(futuro ? { status: 'futuro', atividades: [], registradas: 0, previstas: 0 } : diaAderencia(dataISO)),
    });
  }
  return { primeiroDiaSemana: primeiro.getDay(), dias };
}

/** Resumo de uma semana (segunda a domingo) para o texto de exportação. */
export function semana(inicioISO) {
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicioISO, i)).map((d) => ({ dataISO: d, ...diaAderencia(d) }));
  const comRegistro = dias.filter((d) => d.registradas > 0);
  const total = comRegistro.reduce((a, d) => a + d.registradas, 0);
  const noAlvo = comRegistro.reduce((a, d) => a + d.atividades.filter((x) => x.registrada && cumprida(x.status)).length, 0);
  return { dias, total, noAlvo, percentual: total ? Math.round((noAlvo / total) * 100) : null, atipica: !!semanaAtipica(inicioISO) };
}

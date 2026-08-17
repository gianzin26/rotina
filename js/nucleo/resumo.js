// nucleo/resumo.js — resumo da semana em texto puro, pronto para copiar.
// Só monta o texto; quem baixa, copia ou lê arquivo é ui/arquivos.js.

import { semana as semanaAderencia, sequenciaAcordar } from './aderencia.js';
import { horasDeSono } from './agenda.js';
import { mediaEm, serie } from './peso.js';
import { estado, reg, registroDoDia, sessao } from './store.js';
import { dataCurta, diaLogico, duracao, hhmm, inicioSemana, media, min, nUm, somaDias } from './util.js';

/** Resumo pronto para copiar e colar. */
export function resumoSemana(inicioISO = inicioSemana(diaLogico())) {
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicioISO, i));
  const fimISO = dias[6];
  const noIntervalo = (r) => r.data >= inicioISO && r.data <= fimISO;
  const L = [];

  L.push(`SEMANA DE ${dataCurta(inicioISO)} A ${dataCurta(fimISO)}`);
  const ad = semanaAderencia(inicioISO);
  if (ad.atipica) L.push('(semana marcada como atípica — fora do cálculo)');

  // peso
  const s = serie();
  const m = mediaEm(fimISO, s);
  const mAnterior = mediaEm(somaDias(inicioISO, -1), s);
  const pesos = reg('peso').filter(noIntervalo).filter((p) => typeof p.kg === 'number');
  L.push('', 'PESO');
  L.push(`Média de 7 dias: ${m != null ? `${nUm(m, 1)} kg` : '—'}`);
  if (m != null && mAnterior != null) {
    const d = m - mAnterior;
    L.push(`Variação na semana: ${d >= 0 ? '+' : '−'}${nUm(Math.abs(d), 2)} kg (alvo ${nUm(estado.perfil.ganhoSemanaAlvo?.[0] ?? 0.2, 2)}–${nUm(estado.perfil.ganhoSemanaAlvo?.[1] ?? 0.35, 2)})`);
  }
  L.push(`Pesagens: ${pesos.length}/7`);
  const cintura = reg('peso').filter(noIntervalo).find((p) => typeof p.cinturaCm === 'number');
  if (cintura) L.push(`Cintura: ${nUm(cintura.cinturaCm, 1)} cm`);

  // sono
  const horas = dias.map((d) => horasDeSono(d)).filter((x) => x != null);
  const acordares = dias.map((d) => registroDoDia('sono', d)?.acordou).filter(Boolean).map(min);
  L.push('', 'SONO');
  L.push(`Média: ${horas.length ? duracao(media(horas) * 60) : '—'} em ${horas.length} noites`);
  L.push(`Hora média de acordar: ${acordares.length ? hhmm(Math.round(media(acordares))) : '—'}`);
  const curtas = horas.filter((x) => x < 6).length;
  if (curtas) L.push(`Noites abaixo de 6 h: ${curtas}`);

  // treino
  const treinos = reg('treino').filter(noIntervalo);
  L.push('', 'TREINO');
  if (!treinos.length) L.push('Nenhuma sessão.');
  for (const t of treinos.sort((a, b) => a.data.localeCompare(b.data))) {
    L.push(`${dataCurta(t.data)} · ${sessao(t.sessaoId)?.nome || 'Sessão'}${t.rpe ? ` (RPE ${t.rpe})` : ''}`);
    for (const e of t.exercicios || []) {
      if (e.carga == null && e.reps == null) continue;
      L.push(`  ${e.nome}: ${e.carga != null
        ? `${nUm(e.carga, e.carga % 1 ? 1 : 0)} kg × ${e.reps ?? '—'}`
        : `${e.reps ?? '—'} reps`}`);
    }
  }

  // corrida
  const corridas = reg('corrida').filter(noIntervalo);
  const km = corridas.reduce((a, c) => a + (c.distanciaKm || 0), 0);
  L.push('', 'CORRIDA');
  L.push(`${nUm(km, 1)} km em ${corridas.length} ${corridas.length === 1 ? 'sessão' : 'sessões'}`);
  const teste = corridas.find((c) => c.teste5k && c.minutos);
  if (teste) L.push(`Teste de 5 km: ${duracao(teste.minutos)}`);

  // aderência
  L.push('', 'ADERÊNCIA');
  L.push(`${ad.percentual != null ? `${ad.percentual}%` : '—'} das ${ad.total} atividades registradas no alvo`);
  L.push(`Sequência atual de acordar: ${sequenciaAcordar()} dias`);
  const atrasos = ad.dias.flatMap((d) => d.atividades.filter((a) => a.registrada && a.status === 'fora').map((a) => `${dataCurta(d.dataISO)} ${a.titulo} ${a.desvio > 0 ? `+${Math.round(a.desvio)}` : Math.round(a.desvio)} min`));
  if (atrasos.length) L.push(`Fora da tolerância: ${atrasos.join('; ')}`);

  // creatina e notas
  const creatina = reg('creatina').filter(noIntervalo).length;
  L.push('', 'EXTRAS');
  L.push(`Creatina: ${creatina}/7 dias`);
  const prot = reg('proteina').filter(noIntervalo).filter((p) => p.nota);
  if (prot.length) L.push(`Proteína do almoço: ${prot.map((p) => p.nota).join(' ')}`);
  const notas = reg('notas').filter(noIntervalo).filter((n) => n.texto);
  if (notas.length) {
    L.push('', 'DORES E NOTAS');
    for (const n of notas) L.push(`${dataCurta(n.data)}: ${n.texto}`);
  }

  return L.join('\n');
}

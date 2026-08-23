// treino.js — o que você levantou da última vez e a contagem até o deload.

import { estado, mudar, reg, sessao } from './store.js';
import { diaLogico, diffDias, inicioSemana } from './util.js';

const CICLO_DELOAD = [6, 8]; // deload a cada 6–8 semanas

/** Sessões já concluídas, da mais recente para a mais antiga. */
export function historico(sessaoId = null) {
  return reg('treino')
    .filter((t) => !sessaoId || t.sessaoId === sessaoId)
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Última carga e reps registradas para um exercício, em qualquer sessão. */
export function ultimaVez(nomeExercicio, antesDe = null) {
  for (const t of historico()) {
    if (antesDe && t.data >= antesDe) continue;
    const e = (t.exercicios || []).find((x) => x.nome === nomeExercicio && (x.carga != null || x.reps != null));
    if (e) return { data: t.data, carga: e.carga ?? null, reps: e.reps ?? null };
  }
  return null;
}

/**
 * Ponto de partida: a última vez, ou a carga inicial cadastrada na sessão.
 * `antesDe` exclui a sessão em andamento — a referência tem que ser a anterior.
 */
export function sugestaoCarga(sessaoId, nomeExercicio, antesDe = null) {
  const ultima = ultimaVez(nomeExercicio, antesDe);
  if (ultima) return { ...ultima, origem: 'histórico' };
  const ex = sessao(sessaoId)?.exercicios.find((e) => e.nome === nomeExercicio);
  return { data: null, carga: ex?.cargaInicial ?? null, reps: ex?.repsAlvo ?? null, origem: 'inicial' };
}

export function progressao(nomeExercicio) {
  return historico()
    .map((t) => {
      const e = (t.exercicios || []).find((x) => x.nome === nomeExercicio && x.carga != null);
      return e ? { data: t.data, carga: e.carga, reps: e.reps ?? null } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Todos os exercícios que já apareceram — no cadastro ou no histórico. */
export function exerciciosConhecidos() {
  const nomes = new Set();
  for (const s of estado.sessoesTreino) for (const e of s.exercicios) nomes.add(e.nome);
  for (const t of reg('treino')) for (const e of t.exercicios || []) if (e.nome) nomes.add(e.nome);
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Semanas do bloco atual. Sem marcação de início, conta do primeiro treino registrado.
 */
export function deload() {
  const inicio = estado.perfil.deloadInicio
    || historico().slice(-1)[0]?.data
    || null;
  if (!inicio) return { inicio: null, semana: 0, faltam: CICLO_DELOAD[0], janela: CICLO_DELOAD, devido: false };
  const semanas = Math.floor(diffDias(inicioSemana(inicio), inicioSemana(diaLogico())) / 7) + 1;
  return {
    inicio, semana: semanas, janela: CICLO_DELOAD,
    faltam: Math.max(0, CICLO_DELOAD[0] - semanas),
    devido: semanas >= CICLO_DELOAD[0],
    atrasado: semanas > CICLO_DELOAD[1],
  };
}

export function marcarDeloadFeito() {
  mudar(() => { estado.perfil.deloadInicio = diaLogico(); });
}

/* ---------- corrida ---------- */

/** Quilometragem acumulada por par de tênis, com o alerta de troca. */
export function kmPorTenis() {
  return (estado.tenis || []).map((t) => {
    const corridas = reg('corrida').filter((c) => c.tenisId === t.id && typeof c.distanciaKm === 'number');
    const km = (t.kmInicial || 0) + corridas.reduce((a, c) => a + c.distanciaKm, 0);
    const alerta = t.alertaKm || 700;
    return {
      ...t, km, corridas: corridas.length,
      status: km >= alerta ? 'fora' : km >= alerta - 100 ? 'deriva' : 'noAlvo',
      restante: alerta - km,
    };
  });
}

export function corridas() {
  return reg('corrida').sort((a, b) => b.data.localeCompare(a.data));
}

export function testes5k() {
  return corridas().filter((c) => c.teste5k && typeof c.minutos === 'number');
}

/**
 * Estimativa de calorias da corrida.
 *
 * Não vem do GPX: é conta. Correr custa perto de 1 kcal por quilo por
 * quilômetro, quase independente do ritmo — o corpo paga pelo peso que
 * carregou pela distância que percorreu. É estimativa, e a tela diz isso.
 *
 * @returns {number|null} null quando não há peso registrado
 */
export function caloriasEstimadas(distanciaKm, pesoKg) {
  if (!(distanciaKm > 0) || !(pesoKg > 0)) return null;
  return Math.round(distanciaKm * pesoKg * 1.036);
}

/**
 * Em que posição esta corrida entra entre as suas melhores da mesma distância.
 *
 * Compara com corridas de distância parecida (5% de folga), porque 5,10 km e
 * 5,03 km são a mesma volta. Devolve a posição e quanto separa da anterior.
 *
 * @returns {{posicao:number, total:number, diferencaMin:number|null}|null}
 */
export function posicaoNaDistancia(corrida, todas = corridas()) {
  if (!(corrida?.distanciaKm > 0) || !(corrida?.minutos > 0)) return null;

  const parecidas = todas.filter((c) => c.distanciaKm > 0 && c.minutos > 0
    && Math.abs(c.distanciaKm - corrida.distanciaKm) / corrida.distanciaKm <= 0.05);
  if (parecidas.length < 2) return null;

  const ordenadas = [...parecidas].sort((a, b) => a.minutos - b.minutos);
  const posicao = ordenadas.findIndex((c) => c.id === corrida.id) + 1;
  if (posicao < 1) return null;

  const acima = ordenadas[posicao - 2];
  return {
    posicao,
    total: ordenadas.length,
    diferencaMin: acima ? Math.round((corrida.minutos - acima.minutos) * 100) / 100 : null,
  };
}

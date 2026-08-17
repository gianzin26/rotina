// nucleo/creatina.js — check diário de creatina.
//
// A presença do registro no dia é o "tomou". Guardar um sinalizador seria
// ambíguo, porque `resumo.js` conta o tamanho da lista no intervalo: um
// registro com `tomou: false` entraria na conta como se tivesse tomado.
// Por isso desmarcar apaga o registro em vez de gravar falso.

import { apagarRegistro } from './acoes.js';
import { reg, registroDoDia, upsertDia } from './store.js';
import { DIAS, diaLogico, diaSemana, inicioSemana, somaDias } from './util.js';

export const tomou = (dataISO) => registroDoDia('creatina', dataISO) != null;

/** Marca ou desmarca o dia. Devolve o estado depois da troca. */
export function alternar(dataISO) {
  const atual = registroDoDia('creatina', dataISO);
  if (atual) apagarRegistro('creatina', atual);
  else upsertDia('creatina', dataISO, {});
  return tomou(dataISO);
}

/**
 * Os sete dias da semana de `dataISO`, de segunda a domingo — a semana começa
 * na segunda, como em `inicioSemana`. A inicial vem do dia da semana da própria
 * data, porque `DIAS` é indexado a partir de domingo.
 *
 * Dias no futuro vêm marcados para a tela poder apagá-los, em vez de
 * mostrá-los como falha de quem ainda nem chegou lá.
 */
export function semana(dataISO = diaLogico()) {
  const segunda = inicioSemana(dataISO);
  const hoje = diaLogico();
  return Array.from({ length: 7 }, (_, i) => {
    const d = somaDias(segunda, i);
    return {
      data: d,
      inicial: DIAS[diaSemana(d)][0],
      tomou: tomou(d),
      hoje: d === hoje,
      futuro: d > hoje,
    };
  });
}

/** Quantos dias da semana já têm registro, e de quantos possíveis até hoje. */
export function contagemSemana(dataISO = diaLogico()) {
  const dias = semana(dataISO);
  return {
    feitos: dias.filter((d) => d.tomou).length,
    total: dias.length,
    decorridos: dias.filter((d) => !d.futuro).length,
  };
}

/** Dias seguidos com registro terminando em `dataISO` (conta o próprio dia). */
export function sequencia(dataISO = diaLogico()) {
  let n = 0;
  let d = dataISO;
  while (tomou(d)) { n++; d = somaDias(d, -1); }
  return n;
}

/** Total de registros, para a tela decidir se já há histórico. */
export const total = () => reg('creatina').length;

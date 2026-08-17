// nucleo/demo.js — modo demonstração.
//
// Guarda os dados reais numa chave à parte antes de escrever qualquer coisa, e
// devolve tudo ao desligar. O que for registrado durante a demonstração é
// descartado na volta: é isso que torna o modo seguro para mostrar o app.
//
// A chave `rotina.v1` continua sendo a única que o app lê. O modo demo troca o
// conteúdo dela, não a chave — assim nenhuma outra parte do sistema precisa
// saber que a demonstração existe.

import { estado, estadoPadrao, substituirEstado } from './store.js';
import { diaLogico, hhmm, somaDias } from './util.js';

const LIGADO = 'rotina.demo';
const GUARDA = 'rotina.demo.real';

export const ligado = () => localStorage.getItem(LIGADO) === '1';

/**
 * Liga a demonstração. Só escreve por cima depois de confirmar que a cópia de
 * segurança foi gravada e relê íntegra — sem isso, um localStorage cheio
 * apagaria os dados reais em silêncio.
 * @throws {Error} se a cópia não puder ser confirmada
 */
export function ligar() {
  if (ligado()) return;

  const real = JSON.stringify(estado);
  try {
    localStorage.setItem(GUARDA, real);
  } catch {
    throw new Error('Não foi possível guardar seus dados. O modo demonstração não foi ligado.');
  }
  const conferido = localStorage.getItem(GUARDA);
  if (conferido !== real) {
    localStorage.removeItem(GUARDA);
    throw new Error('A cópia dos seus dados saiu incompleta. O modo demonstração não foi ligado.');
  }

  localStorage.setItem(LIGADO, '1');
  substituirEstado(dadosDemo());
}

/**
 * Desliga e devolve os dados reais. Se a cópia sumiu, não apaga nada: é melhor
 * continuar na demonstração do que zerar o aparelho.
 * @throws {Error} se a cópia estiver ausente ou ilegível
 */
export function desligar() {
  if (!ligado()) return;

  const bruto = localStorage.getItem(GUARDA);
  if (!bruto) throw new Error('A cópia dos seus dados não foi encontrada. Nada foi apagado; exporte um backup antes de tentar de novo.');

  let real;
  try {
    real = JSON.parse(bruto);
  } catch {
    throw new Error('A cópia dos seus dados está ilegível. Nada foi apagado.');
  }

  substituirEstado(real);
  localStorage.removeItem(LIGADO);
  localStorage.removeItem(GUARDA);
}

/* ---------------- os dados de exemplo ---------------- */

const DIAS = 41;

/** Gerador determinístico: a demonstração é sempre a mesma. */
function sorteio(semente = 42) {
  let s = semente;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Viagens de cada dia da semana: [trajeto, minuto de saída, duração]. */
const VIAGENS = {
  1: [['tj-casa-trab', 420, 45], ['tj-trab-fa', 1020, 25], ['tj-fa-casa', 1350, 25]],
  2: [['tj-casa-trab', 420, 45], ['tj-trab-fb', 1050, 40], ['tj-fb-casa', 1350, 20]],
  3: [['tj-casa-trab', 420, 45], ['tj-trab-fb', 1050, 40], ['tj-fb-casa', 1230, 20]],
  4: [['tj-casa-trab', 420, 45], ['tj-trab-fa', 1020, 25], ['tj-fa-casa', 1350, 25]],
  5: [['tj-casa-trab', 420, 45], ['tj-trab-fa', 1020, 25], ['tj-fa-casa', 1230, 25]],
};

const TREINOS = { 3: ['ss-sup-a', 1260], 5: ['ss-inf-a', 1260], 6: ['ss-sup-b', 900], 0: ['ss-inf-b', 900] };
const CORRIDAS = { 6: 450, 0: 480 };

const INFERIOR = [
  ['Cadeira extensora de quadril', 45], ['Leg press', 90], ['Leg press unilateral', 50],
  ['Leg curl', 35], ['Panturrilha', 35], ['Ab wheel', null],
];
const SUPERIOR = [
  ['Empurrar horizontal', 30], ['Empurrar vertical', 20], ['Puxada vertical', 40],
  ['Puxada horizontal', 40], ['Deltoide lateral', 8], ['Deltoide posterior', 8],
  ['Bíceps', 12], ['Tríceps', 15], ['Core anti-rotação', 10],
];

/** Perfil de exemplo com seis semanas de histórico plausível. */
export function dadosDemo() {
  const rnd = sorteio();
  const ruido = (a) => Math.round((rnd() - 0.45) * 2 * a);
  const base = estadoPadrao();
  const R = base.registros;
  const hoje = diaLogico();

  for (let i = DIAS; i >= 0; i--) {
    const data = somaDias(hoje, -i);
    const dow = new Date(`${data}T12:00`).getDay();
    const semana = Math.floor((DIAS - i) / 7);

    // o dia corrente fica pela metade: acordou sim, dormiu ainda não
    R.sono.push(i > 0
      ? { data, acordou: hhmm(390 + ruido(16)), dormiu: hhmm(1380 + ruido(28)), fcRepouso: 54 + ruido(3) }
      : { data, acordou: hhmm(394), fcRepouso: 53 });

    for (const [trajetoId, saida, duracaoMin] of VIAGENS[dow] || []) {
      const saiu = saida + ruido(9);
      R.deslocamento.push({
        id: `ds-${data}-${trajetoId}`, data, trajetoId,
        saiu: hhmm(saiu), chegou: hhmm(saiu + duracaoMin + ruido(7)),
      });
    }

    if (TREINOS[dow] && i > 0) {
      const [sessaoId, hora] = TREINOS[dow];
      const lista = sessaoId.startsWith('ss-inf') ? INFERIOR : SUPERIOR;
      R.treino.push({
        id: `tr-${data}`, data, sessaoId,
        inicio: hhmm(hora + ruido(12)), fim: hhmm(hora + 60),
        rpe: 7 + (rnd() > 0.6 ? 1 : 0),
        exercicios: lista.map(([nome, carga]) => ({
          nome, carga: carga == null ? null : carga + semana * 2.5, reps: 10 + ruido(2),
        })),
      });
    }

    if (CORRIDAS[dow] && i > 0) {
      R.corrida.push({
        id: `co-${data}`, data, rotinaId: null, inicio: hhmm(CORRIDAS[dow] + ruido(10)),
        distanciaKm: Math.round((4 + semana * 0.4 + rnd()) * 10) / 10,
        minutos: 30 + ruido(4), rpe: 6, tenisId: 'tn-1', teste5k: false,
      });
    }

    if (rnd() > 0.12) {
      R.peso.push({ data, kg: Math.round((61.9 + (DIAS - i) * 0.035 + (rnd() - 0.5) * 0.6) * 10) / 10 });
    }
    if (rnd() > 0.2) R.creatina.push({ data });
    if (rnd() > 0.92) R.notas.push({ data, texto: 'Ombro direito incomodando no supino.' });
    if (rnd() > 0.5) R.proteina.push({ data, nota: rnd() > 0.5 ? 'A' : 'B' });
  }

  base.perfil.nome = 'Demonstração';
  return base;
}

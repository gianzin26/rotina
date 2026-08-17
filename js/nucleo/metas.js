// nucleo/metas.js — o julgamento de cada dia contra o que estava planejado.
//
// Nada aqui inventa alvo: a hora de acordar e a duração de sono saem da sua
// própria rotina, e a margem sai das tolerâncias do perfil, que você edita em
// Ajustes. Assim apertar o rigor é mudar um número, não mexer no código.

import { horasDeSono } from './agenda.js';
import { estado, registroDoDia, tolerancia } from './store.js';
import { min, situacao } from './util.js';

const daRotina = (tipo) => estado.rotina.find((r) => r.tipo === tipo) || null;

/** Minuto do dia em que a rotina manda acordar, ou null se não houver plano. */
export function alvoAcordar() {
  const r = daRotina('acordar');
  return r ? min(r.inicio) : null;
}

/**
 * Horas de sono que a rotina prevê: da hora de dormir até a de acordar,
 * atravessando a meia-noite.
 */
export function alvoSono() {
  const dormir = daRotina('dormir');
  const acordar = daRotina('acordar');
  if (!dormir || !acordar) return null;
  let m = min(acordar.inicio) - min(dormir.inicio);
  if (m < 0) m += 1440;
  return m / 60;
}

/**
 * Como foi o acordar do dia. Acordar antes do alvo conta como no alvo —
 * `situacao` só pune atraso.
 * @returns {'noAlvo'|'deriva'|'fora'|'semRegistro'}
 */
export function situacaoAcordar(dataISO) {
  const real = registroDoDia('sono', dataISO)?.acordou;
  const alvo = alvoAcordar();
  if (!real || alvo == null) return 'semRegistro';
  return situacao(min(real) - alvo, tolerancia('acordar'));
}

/**
 * Como foi a noite. O desvio é o que faltou para a duração planejada, em
 * minutos; dormir mais que o previsto não é falha.
 */
export function situacaoSono(dataISO) {
  const real = horasDeSono(dataISO);
  const alvo = alvoSono();
  if (real == null || alvo == null) return 'semRegistro';
  return situacao((alvo - real) * 60, tolerancia('dormir'));
}

/**
 * Julga o dia inteiro pela fração de atividades cumpridas no horário.
 * Exigente de propósito: só o dia inteiro no horário fica verde.
 */
export function situacaoDoPercentual(pct, houveRegistro = true) {
  if (!houveRegistro || pct == null) return 'semRegistro';
  if (pct >= 100) return 'noAlvo';
  if (pct >= 80) return 'deriva';
  return 'fora';
}

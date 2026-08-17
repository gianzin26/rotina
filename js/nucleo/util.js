// nucleo/util.js — datas, horários, números e a regra de tolerância.
// Módulo puro: não conhece DOM, classe CSS nem cor.

export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ---------- datas (ISO YYYY-MM-DD, sempre em horário local) ---------- */

export function iso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function data(isoStr) {
  const [a, m, d] = String(isoStr).split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somaDias(isoStr, n) {
  const d = data(isoStr);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function diaSemana(isoStr) {
  return data(isoStr).getDay();
}

/** Segunda-feira da semana de `isoStr`. */
export function inicioSemana(isoStr) {
  const dow = diaSemana(isoStr);
  return somaDias(isoStr, dow === 0 ? -6 : 1 - dow);
}

export function diffDias(a, b) {
  return Math.round((data(b) - data(a)) / 86400000);
}

export function dataCurta(isoStr) {
  const d = data(isoStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dataLonga(isoStr) {
  const d = data(isoStr);
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}

/* ---------- horários (minutos desde 00:00) ---------- */

/** '07:10' → 430. Aceita '7:10'. Devolve null se inválido. */
export function min(hhmmStr) {
  if (typeof hhmmStr !== 'string') return null;
  const m = hhmmStr.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 430 → '07:10'. Normaliza acima de 24h. */
export function hhmm(minutos) {
  if (minutos == null || Number.isNaN(minutos)) return '--:--';
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function agoraMin(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * O dia do app começa às 5:00 — dormir 00:20 pertence à noite anterior.
 * Usado em todo registro para o carimbo cair no dia certo.
 */
export function diaLogico(d = new Date()) {
  const x = new Date(d.getTime() - 5 * 3600000);
  return iso(x);
}

/** Duração legível: 95 → '1h35'. */
export function duracao(minutos) {
  if (minutos == null || Number.isNaN(minutos)) return '—';
  const neg = minutos < 0;
  const m = Math.abs(Math.round(minutos));
  const t = m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
  return neg ? `−${t}` : t;
}

/**
 * Desvio em minutos entre planejado e real, tolerante a virada de meia-noite:
 * dormir 23:00 registrado 00:20 é +80 min, não −1360.
 */
export function desvio(planejadoMin, realMin) {
  if (planejadoMin == null || realMin == null) return null;
  let d = realMin - planejadoMin;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d;
}

/** '+3 min', 'no horário', '−4 min'. */
export function fmtDesvio(d) {
  if (d == null) return '';
  const r = Math.round(d);
  if (r === 0) return 'no horário';
  return `${r > 0 ? '+' : '−'}${duracao(Math.abs(r))}`;
}

/* ---------- tolerância ---------- */

/**
 * Situação de um registro perante o horário planejado. São nomes de domínio,
 * não de cor: quem pinta é a camada de apresentação.
 *
 * noAlvo      dentro da tolerância principal
 * deriva      atrasado, mas ainda conta como cumprido — revela o horário errado
 * fora        além da tolerância
 * semRegistro nada carimbado
 */
export const SITUACOES = ['semRegistro', 'noAlvo', 'deriva', 'fora'];

/** Atraso dentro da tolerância fica no alvo. Adiantar-se nunca é falha. */
export function situacao(desvioMin, tol) {
  if (desvioMin == null || !tol) return 'semRegistro';
  const atraso = Math.max(0, Math.round(desvioMin));
  if (atraso <= tol.verde) return 'noAlvo';
  if (atraso <= tol.amarelo) return 'deriva';
  return 'fora';
}

/** A pior de duas situações — o dia vale pela atividade mais atrasada. */
export function pior(a, b) {
  return SITUACOES.indexOf(b) > SITUACOES.indexOf(a) ? b : a;
}

export const cumprida = (s) => s === 'noAlvo' || s === 'deriva';

/* ---------- números ---------- */

export function nUm(v, casas = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toFixed(casas).replace('.', ',');
}

export function mediana(valores) {
  const v = valores.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

export function media(valores) {
  const v = valores.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function uid(prefixo = 'id') {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

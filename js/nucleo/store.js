// store.js — modelo de dados, perfil de exemplo e persistência em localStorage.

import { uid } from './util.js';

const CHAVE = 'rotina.v1';

/* ---------------- perfil de exemplo ----------------
   Exemplo neutro, só para o app abrir com algo dentro. Locais e horários são
   genéricos de propósito: o repositório é público e rotina de pessoa real é
   agenda de quando ela não está em casa. A rotina de verdade se configura em
   Ajustes e fica no localStorage do aparelho, que nunca sai dali. */

const TRAJETOS = [
  { id: 'tj-casa-trab', origem: 'Casa', destino: 'Trabalho', minutosEstimados: 45 },
  { id: 'tj-trab-fa', origem: 'Trabalho', destino: 'Faculdade A', minutosEstimados: 25 },
  { id: 'tj-trab-fb', origem: 'Trabalho', destino: 'Faculdade B', minutosEstimados: 40 },
  { id: 'tj-fa-casa', origem: 'Faculdade A', destino: 'Casa', minutosEstimados: 25 },
  { id: 'tj-fb-casa', origem: 'Faculdade B', destino: 'Casa', minutosEstimados: 20 },
].map((t) => ({ ...t, wazeUrl: `https://waze.com/ul?q=${encodeURIComponent(t.destino)}&navigate=yes` }));

const SUPERIOR = ['Empurrar horizontal', 'Empurrar vertical', 'Puxada vertical', 'Puxada horizontal',
  'Deltoide lateral', 'Deltoide posterior', 'Bíceps', 'Tríceps', 'Core anti-rotação'];

const INFERIOR = [
  { nome: 'Cadeira extensora de quadril', carga: 45, repsAlvo: 12 },
  { nome: 'Leg press', carga: 90, repsAlvo: 12 },
  { nome: 'Leg press unilateral', carga: 50, repsAlvo: 12 },
  { nome: 'Leg curl', carga: 35, repsAlvo: 10 },
  { nome: 'Panturrilha', carga: 35, repsAlvo: 15 },
  { nome: 'Ab wheel', carga: null, repsAlvo: 9 },
];

const SESSOES = [
  { id: 'ss-sup-a', nome: 'Superior A', exercicios: SUPERIOR.map((nome) => ({ nome, series: 3, repsAlvo: 10, cargaInicial: null })) },
  { id: 'ss-sup-b', nome: 'Superior B', exercicios: SUPERIOR.map((nome) => ({ nome, series: 3, repsAlvo: 10, cargaInicial: null })) },
  { id: 'ss-inf-a', nome: 'Inferior A', exercicios: INFERIOR.map((e) => ({ nome: e.nome, series: 3, repsAlvo: e.repsAlvo, cargaInicial: e.carga })) },
  { id: 'ss-inf-b', nome: 'Inferior B', exercicios: INFERIOR.map((e) => ({ nome: e.nome, series: 3, repsAlvo: e.repsAlvo, cargaInicial: e.carga })) },
];

/** Atalho: cada linha vira um item de rotina. dias 0=Dom … 6=Sáb. */
function r(tipo, titulo, dias, inicio, fim, extra = {}) {
  return { id: uid('rt'), tipo, titulo, diasSemana: dias, inicio, fim, local: extra.local || '', ...extra };
}

const SEG_QUI = [1, 4];
const ROTINA = [
  r('acordar', 'Acordar', [0, 1, 2, 3, 4, 5, 6], '06:30', null),
  r('dormir', 'Dormir', [0, 1, 2, 3, 4, 5, 6], '23:00', null),

  // Segunda e quinta
  r('transito', 'Casa → Trabalho', SEG_QUI, '07:00', '07:45', { trajetoId: 'tj-casa-trab' }),
  r('trabalho', 'Trabalho', SEG_QUI, '08:00', '17:00', {}),
  r('transito', 'Trabalho → Faculdade A', SEG_QUI, '17:00', '17:25', { trajetoId: 'tj-trab-fa' }),
  r('aula', 'Faculdade A', SEG_QUI, '19:00', '22:30', {}),
  r('transito', 'Faculdade A → Casa', SEG_QUI, '22:30', '22:55', { trajetoId: 'tj-fa-casa' }),

  // Terça
  r('transito', 'Casa → Trabalho', [2], '07:00', '07:45', { trajetoId: 'tj-casa-trab' }),
  r('trabalho', 'Trabalho', [2], '08:00', '17:30', {}),
  r('transito', 'Trabalho → Faculdade B', [2], '17:30', '18:10', { trajetoId: 'tj-trab-fb' }),
  r('aula', 'Faculdade B', [2], '19:00', '22:30', {}),
  r('transito', 'Faculdade B → Casa', [2], '22:30', '22:50', { trajetoId: 'tj-fb-casa' }),

  // Quarta
  r('transito', 'Casa → Trabalho', [3], '07:00', '07:45', { trajetoId: 'tj-casa-trab' }),
  r('trabalho', 'Trabalho', [3], '08:00', '17:30', {}),
  r('transito', 'Trabalho → Faculdade B', [3], '17:30', '18:10', { trajetoId: 'tj-trab-fb' }),
  r('aula', 'Faculdade B', [3], '19:00', '20:30', {}),
  r('transito', 'Faculdade B → Casa', [3], '20:30', '20:50', { trajetoId: 'tj-fb-casa' }),
  r('treino', 'Superior A', [3], '21:00', '22:00', { sessaoId: 'ss-sup-a' }),

  // Sexta
  r('transito', 'Casa → Trabalho', [5], '07:00', '07:45', { trajetoId: 'tj-casa-trab' }),
  r('trabalho', 'Trabalho', [5], '08:00', '17:00', {}),
  r('transito', 'Trabalho → Faculdade A', [5], '17:00', '17:25', { trajetoId: 'tj-trab-fa' }),
  r('aula', 'Faculdade A', [5], '19:00', '20:30', {}),
  r('transito', 'Faculdade A → Casa', [5], '20:30', '20:55', { trajetoId: 'tj-fa-casa' }),
  r('treino', 'Inferior A', [5], '21:00', '22:00', { sessaoId: 'ss-inf-a' }),

  // Fim de semana
  r('corrida', 'Corrida', [6], '07:30', '08:15'),
  r('treino', 'Superior B', [6], '15:00', '16:00', { sessaoId: 'ss-sup-b' }),
  r('corrida', 'Corrida', [0], '08:00', '08:45'),
  r('treino', 'Inferior B', [0], '15:00', '16:00', { sessaoId: 'ss-inf-b' }),
];

/** Verde em 5 min para tudo; o vermelho é proporcional à consequência (seção 5). */
export const TOLERANCIAS_PADRAO = {
  transito: { verde: 5, amarelo: 10 },
  acordar: { verde: 5, amarelo: 20 },
  treino: { verde: 5, amarelo: 30 },
  dormir: { verde: 5, amarelo: 30 },
};

export function estadoPadrao() {
  return {
    versao: 1,
    perfil: {
      nome: 'Minha rotina',
      pesoAlvo: 70,
      kcalAlvo: 2500,
      ganhoSemanaAlvo: [0.2, 0.35],
      tolerancias: structuredClone(TOLERANCIAS_PADRAO),
      deloadInicio: null,
      corrida: { ciclos: 6, corridaMin: 3, caminhadaMin: 2 },
    },
    rotina: structuredClone(ROTINA),
    trajetos: structuredClone(TRAJETOS),
    sessoesTreino: structuredClone(SESSOES),
    tenis: [{
      id: 'tn-1', nome: 'Adidas preto', modelo: 'Racer TR23',
      foto: 'adidas-racer.png', kmInicial: 0, alertaKm: 700,
    }],
    registros: {
      sono: [], deslocamento: [], treino: [], corrida: [],
      peso: [], creatina: [], notas: [], proteina: [],
    },
    semanasAtipicas: [],
  };
}

/* ---------------- persistência ---------------- */

/** Leitura tolerante: campo ausente vira o padrão, campo presente manda. */
function mesclar(padrao, salvo) {
  if (salvo == null) return padrao;
  if (Array.isArray(padrao)) return Array.isArray(salvo) ? salvo : padrao;
  if (typeof padrao !== 'object' || typeof salvo !== 'object') return salvo;
  const fora = { ...padrao };
  for (const [k, v] of Object.entries(salvo)) fora[k] = mesclar(padrao[k], v);
  return fora;
}

export let estado = estadoPadrao();

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    estado = bruto ? mesclar(estadoPadrao(), JSON.parse(bruto)) : estadoPadrao();
    if (!bruto) salvar();
  } catch (e) {
    console.warn('Falha ao ler dados salvos; usando perfil de exemplo.', e);
    estado = estadoPadrao();
  }
  return estado;
}

/**
 * Quem avisa o usuário que a gravação falhou é a apresentação; o store só
 * relata. Sem relator registrado, o erro fica no console.
 */
let relatarFalha = () => {};
export function definirRelatorDeFalha(fn) { relatarFalha = fn; }

/* Avisado depois de cada gravação. É por aqui que a sincronização descobre o
   que mudou, sem que os 32 pontos de escrita precisem saber que ela existe. */
let aoSalvar = () => {};
export function definirAoSalvar(fn) { aoSalvar = fn; }

export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    console.error('Não foi possível salvar.', e);
    relatarFalha('Não foi possível salvar os dados neste dispositivo. Verifique o espaço disponível.');
  }
  aoSalvar();
}

/** Toda escrita passa por aqui: muta, grava e notifica as telas. */
export function mudar(fn) {
  fn(estado);
  salvar();
}

export function substituirEstado(novo) {
  estado = mesclar(estadoPadrao(), novo);
  salvar();
}

export function zerar() {
  estado = estadoPadrao();
  salvar();
}

/* ---------------- acessos ---------------- */

export const reg = (nome) => (estado.registros[nome] ||= []);

export function registroDoDia(nome, dataISO) {
  return reg(nome).find((x) => x.data === dataISO) || null;
}

/** Cria o registro do dia se não existir e aplica os campos. */
export function upsertDia(nome, dataISO, campos) {
  mudar(() => {
    const lista = reg(nome);
    let r0 = lista.find((x) => x.data === dataISO);
    if (!r0) { r0 = { data: dataISO }; lista.push(r0); lista.sort((a, b) => a.data.localeCompare(b.data)); }
    Object.assign(r0, campos);
  });
  return registroDoDia(nome, dataISO);
}

export const trajeto = (id) => estado.trajetos.find((t) => t.id === id) || null;
export const sessao = (id) => estado.sessoesTreino.find((s) => s.id === id) || null;

export function tolerancia(tipo) {
  const t = estado.perfil.tolerancias || {};
  return t[tipo] || t[tipo === 'corrida' ? 'treino' : 'transito'] || TOLERANCIAS_PADRAO.transito;
}

/** Semana atípica: sai do cálculo de aderência sem contar como falha. */
export function semanaAtipica(inicioISO) {
  return (estado.semanasAtipicas || []).find((s) => s.inicioISO === inicioISO) || null;
}

export function alternarSemanaAtipica(inicioISO, motivo = '') {
  mudar(() => {
    const lista = (estado.semanasAtipicas ||= []);
    const i = lista.findIndex((s) => s.inicioISO === inicioISO);
    if (i >= 0) lista.splice(i, 1);
    else lista.push({ inicioISO, motivo });
  });
}

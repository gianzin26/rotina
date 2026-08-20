// nucleo/nuvem.js — sincronização entre iPhone, iPad e computador.
//
// O aparelho nunca manda "o meu estado é a verdade". Ele baixa o do servidor,
// mescla chave a chave pelo carimbo de tempo e devolve o resultado. Por isso
// registrar no iPhone e no iPad no mesmo dia não perde nenhum dos dois.
//
// Offline não é erro: a escrita fica pendente e sobe na próxima oportunidade.

import { carimbar, fotografar, mesclar } from './sincronizacao.js';
import { definirAoSalvar, estado, substituirEstado } from './store.js';

const CHAVE = 'rotina.sync';

const vazio = () => ({ carimbos: {}, removidos: {}, foto: {}, url: '', codigo: '', ultimo: 0, pendente: false });

function ler() {
  try { return { ...vazio(), ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; }
  catch { return vazio(); }
}

function gravar(d) {
  try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* sem espaço */ }
}

export const configurada = () => { const d = ler(); return !!(d.url && d.codigo); };
export const configuracao = () => { const { url, codigo, ultimo, pendente } = ler(); return { url, codigo, ultimo, pendente }; };

export function configurar({ url, codigo }) {
  const d = ler();
  gravar({ ...d, url: (url || '').trim().replace(/\/$/, ''), codigo: (codigo || '').trim() });
}

export function desconfigurar() {
  const d = ler();
  gravar({ ...d, url: '', codigo: '', pendente: false });
}

/**
 * Carimba o que mudou desde a última gravação. Ligado ao gancho do store, roda
 * sozinho a cada escrita — nenhum ponto de escrita precisa saber disso.
 */
export function observarEscritas() {
  definirAoSalvar(() => {
    const d = ler();
    const atual = fotografar(estado);
    const { carimbos, removidos } = carimbar({
      anterior: d.foto, atual, carimbos: d.carimbos, removidos: d.removidos,
    });
    gravar({ ...d, foto: atual, carimbos, removidos, pendente: !!(d.url && d.codigo) });
  });
  // primeira fotografia, para a próxima escrita ter com o que comparar
  const d = ler();
  if (!Object.keys(d.foto).length) gravar({ ...d, foto: fotografar(estado) });
}

/**
 * Uma rodada completa: baixa, mescla, aplica no aparelho e devolve ao servidor.
 * @returns {Promise<{estado:'sincronizado'|'desligado'|'offline'|'erro', conflitos?:number, mensagem?:string}>}
 */
export async function sincronizar() {
  const d = ler();
  if (!d.url || !d.codigo) return { estado: 'desligado' };

  let remoto = null;
  try {
    const r = await fetch(`${d.url}/${encodeURIComponent(d.codigo)}`, { cache: 'no-store' });
    if (r.status === 404) remoto = null;              // primeira vez: servidor vazio
    else if (!r.ok) return { estado: 'erro', mensagem: `servidor respondeu ${r.status}` };
    else remoto = await r.json();
  } catch {
    gravar({ ...ler(), pendente: true });
    return { estado: 'offline' };
  }

  const local = { estado, carimbos: d.carimbos, removidos: d.removidos };
  const juntos = remoto?.estado
    ? mesclar(local, { estado: remoto.estado, carimbos: remoto.carimbos || {}, removidos: remoto.removidos || {} })
    : { ...local, conflitos: [] };

  // aplica no aparelho antes de enviar: se a rede cair no meio, o que ficou
  // aqui já é o resultado da mesclagem, não um estado pela metade
  substituirEstado(juntos.estado);
  const depois = ler();
  gravar({
    ...depois,
    carimbos: juntos.carimbos,
    removidos: juntos.removidos,
    foto: fotografar(juntos.estado),
  });

  try {
    const r = await fetch(`${d.url}/${encodeURIComponent(d.codigo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: juntos.estado, carimbos: juntos.carimbos, removidos: juntos.removidos,
      }),
    });
    if (!r.ok) return { estado: 'erro', mensagem: `servidor respondeu ${r.status}` };
  } catch {
    gravar({ ...ler(), pendente: true });
    return { estado: 'offline' };
  }

  gravar({ ...ler(), ultimo: Date.now(), pendente: false });
  return { estado: 'sincronizado', conflitos: (juntos.conflitos || []).length };
}

/** Código novo, aleatório, para o primeiro aparelho gerar. */
export function codigoNovo() {
  const b = new Uint8Array(9);
  (globalThis.crypto || {}).getRandomValues?.(b);
  return [...b].map((n) => 'abcdefghjkmnpqrstuvwxyz23456789'[n % 31]).join('')
    .replace(/(.{3})(?=.)/g, '$1-');
}

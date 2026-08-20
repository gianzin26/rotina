// nucleo/tema.js — claro, escuro ou o que o sistema mandar.
//
// Chave própria, fora de `rotina.v1`: é preferência de aparência, não dado da
// rotina. O padrão é 'auto', que deixa o iPhone decidir junto com o resto do
// sistema; escolher à mão passa a vencer nos dois sentidos.

const CHAVE = 'rotina.tema';

export const TEMAS = ['auto', 'claro', 'escuro'];

export function tema() {
  const v = localStorage.getItem(CHAVE);
  return TEMAS.includes(v) ? v : 'auto';
}

export function definirTema(v) {
  if (!TEMAS.includes(v)) return;
  try {
    if (v === 'auto') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, v);
  } catch {
    /* sem espaço: vale só nesta sessão */
  }
}

/** O tema em vigor agora, já resolvido contra o sistema. */
export function temaEfetivo() {
  const t = tema();
  if (t !== 'auto') return t;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

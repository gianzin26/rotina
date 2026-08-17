// nucleo/janelas.js — de quantos dias cada gráfico mostra.
//
// Fica em chave própria, fora de `rotina.v1`: é preferência de leitura, não
// dado da rotina. Assim o backup e o modelo continuam intactos, e perder esta
// chave não custa nada além de voltar ao padrão.

const CHAVE = 'rotina.janelas';

/** As opções do seletor, em dias. */
export const OPCOES = [5, 7, 14, 30];

/** Semanas, para os gráficos que agregam por semana em vez de por dia. */
export const OPCOES_SEMANAS = [4, 8, 12, 26];

const PADRAO = {
  horaAcordar: 14,
  sono: 14,
  peso: 30,
  aderencia: 7,
  corrida: 30,
  volume: 8, // semanas
};

let escolhas = null;

function carregar() {
  if (escolhas) return escolhas;
  try {
    escolhas = { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
  } catch {
    escolhas = { ...PADRAO };
  }
  return escolhas;
}

/** @param {string} id chave do gráfico em PADRAO */
export function janela(id) {
  const v = carregar()[id];
  return Number.isFinite(v) ? v : (PADRAO[id] ?? 14);
}

export function definirJanela(id, valor) {
  carregar()[id] = valor;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(escolhas));
  } catch {
    /* sem espaço: a escolha vale só nesta sessão, e isso não é motivo de erro */
  }
}

export const rotuloDias = (dias) => `Últimos ${dias} dias`;
export const rotuloSemanas = (semanas) => `${semanas} semanas`;

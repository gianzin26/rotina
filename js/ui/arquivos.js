// ui/arquivos.js — download, leitura e cópia. Conversa com o navegador,
// não com as regras: recebe e devolve dados prontos.

import { estado } from '../nucleo/store.js';
import { diaLogico } from '../nucleo/util.js';

/** Copia texto para a área de transferência, com plano B para navegador antigo. */
export function copiar(texto) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(texto);
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.className = 'fora-da-tela';
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}

/** Baixa o banco inteiro em JSON. Devolve o nome do arquivo gerado. */
export function baixarJSON() {
  const nome = `rotina-${diaLogico()}.json`;
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nome;
}

export function lerArquivo(arquivo) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try { resolve(JSON.parse(String(fr.result))); }
      catch { reject(new Error('Arquivo não é um JSON válido.')); }
    };
    fr.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    fr.readAsText(arquivo);
  });
}

/** Lê o arquivo como texto puro, sem interpretar. */
export function lerTexto(arquivo) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    fr.readAsText(arquivo);
  });
}

/**
 * Abre o seletor de arquivos do sistema.
 *
 * O input precisa estar no documento para o clique valer, e sai de cena
 * assim que termina.
 *
 * @param {string} tipos valor do accept
 * @param {(arquivo:File)=>void} aoEscolher
 */
export function escolherArquivo(tipos, aoEscolher) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = tipos;
  entrada.className = 'oculto';
  entrada.onchange = async (e) => {
    const arquivo = e.target.files?.[0];
    entrada.remove();
    if (arquivo) await aoEscolher(arquivo);
  };
  document.body.append(entrada);
  entrada.click();
}

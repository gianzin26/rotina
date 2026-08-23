// nucleo/importar.js — traz uma corrida de fora para dentro do app.
//
// Regra central: importar PREENCHE o registro do dia, não cria outro. Se você
// já tinha marcado a corrida à mão, o arquivo completa o que faltava e o que
// só existe no seu registro — esforço e tênis — permanece.

import { corridaDoGPX } from './gpx.js';
import { mudar, reg } from './store.js';
import { uid } from './util.js';

/** Campos que vêm do arquivo e sempre vencem o que estava lá. */
const DO_ARQUIVO = [
  'distanciaKm', 'minutos', 'inicio', 'elevacaoM', 'elevacaoMaxM',
  'movimentoMin', 'fcMedia', 'fcMaxima', 'cadencia', 'traco', 'parciais',
  'nome', 'origem',
];

/**
 * @param {string} texto conteúdo do .gpx
 * @returns {{corrida:object, substituiu:boolean}}
 * @throws {Error} quando o arquivo não é um GPX com trajeto
 */
export function importarGPX(texto) {
  const lida = corridaDoGPX(texto);
  const lista = reg('corrida');
  const existente = lista.find((c) => c.data === lida.data);

  let corrida;
  mudar(() => {
    if (existente) {
      for (const campo of DO_ARQUIVO) {
        if (lida[campo] != null) existente[campo] = lida[campo];
      }
      corrida = existente;
    } else {
      corrida = {
        id: uid('co'), rotinaId: null, rpe: null, tenisId: null, teste5k: false, ...lida,
      };
      lista.push(corrida);
      lista.sort((a, b) => a.data.localeCompare(b.data));
    }
  });

  return { corrida, substituiu: !!existente };
}

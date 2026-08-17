// ui/periodo.js — o seletor de período do canto do cartão.
//
// Devolve o objeto que `cartao()` já entende em `periodo`: rótulo + ação. O
// toque abre uma folha com o controle segmentado, em vez de ciclar às cegas,
// para o conjunto de opções ficar visível.

import {
  OPCOES, OPCOES_SEMANAS, definirJanela, janela, rotuloDias, rotuloSemanas,
} from '../nucleo/janelas.js';
import { h } from './dom.js';
import { fecharFolha, folha, segmentos } from './folha.js';

function seletor(id, ctx, { opcoes, rotulo, sufixo }) {
  const atual = janela(id);
  return {
    rotulo: rotulo(atual),
    aoTrocar: () => folha('Período', () => h('div', { class: 'pilha' },
      segmentos(
        opcoes.map((v) => ({ id: String(v), rotulo: `${v} ${sufixo}` })),
        String(atual),
        (v) => { definirJanela(id, Number(v)); fecharFolha(); ctx.recarregar(); },
      ))),
  };
}

/** Seletor em dias: 5, 7, 14 ou 30. */
export const periodoEmDias = (id, ctx) =>
  seletor(id, ctx, { opcoes: OPCOES, rotulo: rotuloDias, sufixo: 'dias' });

/** Seletor em semanas, para o que é agregado por semana. */
export const periodoEmSemanas = (id, ctx) =>
  seletor(id, ctx, { opcoes: OPCOES_SEMANAS, rotulo: rotuloSemanas, sufixo: 'semanas' });

export { janela };

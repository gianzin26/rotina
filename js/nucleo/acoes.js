// acoes.js — o que o botão principal oferece agora e o que cada toque registra.
// Um toque = carimbo automático. O app já sabe a rotina e a hora.

import { ocorrencias } from './agenda.js';
import { estado, mudar, reg, registroDoDia, upsertDia } from './store.js';
import { agoraMin, diaLogico, hhmm, uid } from './util.js';

/* ---------------- carimbos ---------------- */

export const registrarAcordar = (dia, m) => upsertDia('sono', dia, { acordou: hhmm(m) });
export const registrarDormir = (dia, m) => upsertDia('sono', dia, { dormiu: hhmm(m) });

export function registrarSaida(dia, o, m) {
  mudar(() => {
    reg('deslocamento').push({
      id: uid('ds'), data: dia, trajetoId: o.trajetoId, rotinaId: o.id, saiu: hhmm(m), chegou: null,
    });
  });
}

export function registrarChegada(registro, m) {
  mudar(() => { registro.chegou = hhmm(m); });
}

export function iniciarTreino(dia, o, m) {
  let novo;
  mudar(() => {
    novo = {
      id: uid('tr'), data: dia, sessaoId: o.sessaoId, rotinaId: o.id,
      inicio: hhmm(m), fim: null, exercicios: [], rpe: null,
    };
    reg('treino').push(novo);
  });
  return novo;
}

export function iniciarCorrida(dia, o, m) {
  let novo;
  mudar(() => {
    novo = {
      id: uid('co'), data: dia, rotinaId: o?.id || null, inicio: hhmm(m),
      distanciaKm: null, minutos: null, rpe: null, tenisId: estado.tenis?.[0]?.id || null, teste5k: false,
    };
    reg('corrida').push(novo);
  });
  return novo;
}

export function apagarRegistro(lista, registro) {
  mudar(() => {
    estado.registros[lista] = reg(lista).filter((x) => x !== registro);
  });
}

/* ---------------- janelas ---------------- */

const JANELAS = {
  acordar: { antes: 15, depois: 90 },
  transito: { antes: 15, depois: 90 },
  treino: { antes: 15, depois: 120 },
  corrida: { antes: 15, depois: 120 },
  dormir: { antes: 120, depois: 300 },
};

/** Hora atual na régua do dia lógico (00:30 do dia seguinte vale 24:30). */
export function agoraNoDia(dataISO) {
  const m = agoraMin();
  return dataISO === diaLogico() && m < 300 ? m + 1440 : m;
}

/**
 * Ações oferecidas pelo botão principal, em ordem de prioridade.
 * Quando duas competem pelo mesmo momento, a tela mostra as duas lado a lado.
 */
export function acoes(dataISO, agora = agoraNoDia(dataISO)) {
  const lista = [];
  const oc = ocorrencias(dataISO);
  const sono = registroDoDia('sono', dataISO);

  // Em trânsito: saiu e ainda não chegou. Vem antes de tudo.
  const emTransito = reg('deslocamento').find((d) => d.data === dataISO && d.saiu && !d.chegou);
  if (emTransito) {
    const alvo = oc.find((o) => o.id === emTransito.rotinaId);
    lista.push({
      chave: `chegar-${emTransito.id}`, rotulo: 'Cheguei', tipo: 'transito', prioridade: 0,
      planejado: alvo?.fim ?? null,
      executar: (m) => registrarChegada(emTransito, m),
    });
  }

  for (const o of oc) {
    if (!o.registravel) continue;
    const j = JANELAS[o.tipo];
    const dentro = o.inicio != null && agora >= o.inicio - j.antes && agora <= (o.fim ?? o.inicio) + j.depois;

    if (o.tipo === 'acordar' && !sono?.acordou && dentro) {
      lista.push({ chave: 'acordar', rotulo: 'Acordei', tipo: 'acordar', prioridade: 1, planejado: o.inicio, ocorrencia: o, executar: (m) => registrarAcordar(dataISO, m) });
    }
    if (o.tipo === 'dormir' && !sono?.dormiu && dentro) {
      lista.push({ chave: 'dormir', rotulo: 'Dormindo', tipo: 'dormir', prioridade: 5, planejado: o.inicio, ocorrencia: o, executar: (m) => registrarDormir(dataISO, m) });
    }
    if (o.tipo === 'transito' && !o.real && dentro) {
      lista.push({ chave: `sair-${o.id}`, rotulo: 'Saí', tipo: 'transito', prioridade: 2, planejado: o.inicio, ocorrencia: o, executar: (m) => registrarSaida(dataISO, o, m) });
    }
    if (o.tipo === 'treino' && !o.real && dentro) {
      lista.push({ chave: `treino-${o.id}`, rotulo: 'Iniciar treino', tipo: 'treino', prioridade: 3, planejado: o.inicio, ocorrencia: o, executar: (m) => iniciarTreino(dataISO, o, m), irPara: 'treino' });
    }
    if (o.tipo === 'corrida' && !o.real && dentro) {
      lista.push({ chave: `corrida-${o.id}`, rotulo: 'Iniciar corrida', tipo: 'corrida', prioridade: 3, planejado: o.inicio, ocorrencia: o, executar: (m) => iniciarCorrida(dataISO, o, m), irPara: 'treino' });
    }
  }

  return lista
    .sort((a, b) => a.prioridade - b.prioridade
      || Math.abs((a.planejado ?? 0) - agora) - Math.abs((b.planejado ?? 0) - agora))
    .slice(0, 2);
}

/** Tudo que é registrável no dia — alimenta a folha de correção manual. */
export function registraveisDoDia(dataISO) {
  const sono = registroDoDia('sono', dataISO);
  return ocorrencias(dataISO).filter((o) => o.registravel).map((o) => {
    if (o.tipo === 'acordar') {
      return { ...o, atual: sono?.acordou || null, definir: (m) => registrarAcordar(dataISO, m), apagar: sono?.acordou ? () => upsertDia('sono', dataISO, { acordou: null }) : null };
    }
    if (o.tipo === 'dormir') {
      return { ...o, atual: sono?.dormiu || null, definir: (m) => registrarDormir(dataISO, m), apagar: sono?.dormiu ? () => upsertDia('sono', dataISO, { dormiu: null }) : null };
    }
    if (o.tipo === 'transito') {
      const d = o.registro;
      return {
        ...o, atual: d?.saiu || null, segundo: d?.chegou || null,
        definir: (m) => (d ? mudar(() => { d.saiu = hhmm(m); }) : registrarSaida(dataISO, o, m)),
        definirSegundo: d ? (m) => registrarChegada(d, m) : null,
        apagar: d ? () => apagarRegistro('deslocamento', d) : null,
      };
    }
    if (o.tipo === 'treino') {
      const t = o.registro;
      return {
        ...o, atual: t?.inicio || null,
        definir: (m) => (t ? mudar(() => { t.inicio = hhmm(m); }) : iniciarTreino(dataISO, o, m)),
        apagar: t ? () => apagarRegistro('treino', t) : null,
      };
    }
    const c = o.registro;
    return {
      ...o, atual: c?.inicio || null,
      definir: (m) => (c ? mudar(() => { c.inicio = hhmm(m); }) : iniciarCorrida(dataISO, o, m)),
      apagar: c ? () => apagarRegistro('corrida', c) : null,
    };
  });
}

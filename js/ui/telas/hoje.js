// ui/telas/hoje.js — operacional. O que vem agora, o que já passou e o placar
// do dia. Nenhuma tendência: isso é assunto de Visão geral e Corpo.

import { acoes, agoraNoDia, registraveisDoDia } from '../../nucleo/acoes.js';
import { ocorrencias, proxima } from '../../nucleo/agenda.js';
import { diaAderencia } from '../../nucleo/aderencia.js';
import { dataLonga, diaLogico, duracao, fmtDesvio, hhmm, min } from '../../nucleo/util.js';
import { cartao, linha } from '../cartao.js';
import { anexar, classeSituacao, h, toqueLongo, vazio } from '../dom.js';
import { aviso, escolherHorario, folha } from '../folha.js';
import { icone, iconeDoTipo } from '../icones.js';

export function render(tela, ctx) {
  const dia = diaLogico();
  const agora = agoraNoDia(dia);

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Hoje'),
        h('p', { class: 'cabecalho-sub' }, dataLonga(dia)))),
    h('div', { class: 'grade' },
      cartaoProximo(dia, agora, ctx),
      cartaoListaDoDia(dia, ctx),
      cartaoPlacar(dia)));

  barraAcao(dia, agora, ctx);
}

/* ---------------- próxima atividade, com o registro dentro ---------------- */

function cartaoProximo(dia, agora, ctx) {
  const p = proxima(dia, agora);
  const disponiveis = acoes(dia, agora);
  const acao = disponiveis[0] || null;

  if (!p && !acao) {
    return cartao({ titulo: 'Agenda', metrica: '—', legenda: 'Nada mais previsto para hoje' });
  }

  const faltam = p ? p.inicio - agora : null;

  return cartao({
    titulo: p ? p.titulo : 'Registrar',
    periodo: p ? hhmm(p.inicio) : null,
    metrica: faltam == null ? 'agora' : faltam <= 0 ? 'agora' : duracao(faltam),
    legenda: p?.local ? `${p.local} · previsto ${hhmm(p.inicio)}` : p ? `previsto ${hhmm(p.inicio)}` : null,
    classe: p ? `tipo-${p.tipo}` : null,
  },
    acao && botaoRegistrar(acao, agora, ctx),
    !acao && h('p', { class: 'texto-suave' }, 'Fora da janela de registro desta atividade.'));
}

function botaoRegistrar(acao, agora, ctx) {
  const b = h('button', {
    class: 'botao primario largura-total',
    onclick: () => aplicar(acao, agora % 1440, ctx),
  }, icone(iconeDoTipo(acao.tipo)), acao.rotulo,
    acao.planejado != null && h('span', { class: 'botao-nota' }, `previsto ${hhmm(acao.planejado)}`));
  toqueLongo(b, () => escolherHorario({
    titulo: acao.rotulo, minutos: agora % 1440,
    aoEscolher: (m) => aplicar(acao, m, ctx),
  }));
  return b;
}

/* ---------------- lista do dia ---------------- */

function cartaoListaDoDia(dia, ctx) {
  const lista = ocorrencias(dia).filter((o) => o.inicio != null);
  if (!lista.length) {
    return cartao({ titulo: 'O dia' }, vazio('Nada previsto para hoje.'));
  }

  return cartao({ titulo: 'O dia', periodo: `${lista.length} atividades` },
    h('div', { class: 'lista' }, lista.map((o) => {
      const feito = o.real?.inicio != null;
      return linha(
        [
          h('span', { class: 'linha-titulo' }, o.titulo),
          o.local && h('span', { class: 'linha-sub' }, o.local),
        ],
        [
          feito && h('span', { class: `dia-real ${classeSituacao(o.status)}` },
            `${hhmm(o.real.inicio)} · ${fmtDesvio(o.desvio)}`),
          h('span', { class: 'dia-hora' }, hhmm(o.inicio)),
        ],
        { aoTocar: o.registravel ? () => corrigir(o, dia, ctx) : null },
      );
    })));
}

/* ---------------- placar do dia ---------------- */

function cartaoPlacar(dia) {
  const ad = diaAderencia(dia);
  const noAlvo = ad.atividades.filter((a) => a.registrada && (a.status === 'noAlvo' || a.status === 'deriva')).length;
  return cartao({
    titulo: 'No horário',
    pequeno: true,
    metrica: `${noAlvo} de ${ad.previstas}`,
    legenda: 'atividades do dia dentro da tolerância',
  });
}

/* ---------------- botão fixo e correção ---------------- */

function barraAcao(dia, agora, ctx) {
  const lista = acoes(dia, agora);
  const barra = h('div', { class: 'barra-acao' });

  if (!lista.length) {
    barra.append(h('button', {
      class: 'botao-acao secundario',
      onclick: () => folhaRegistros(dia, ctx),
    }, icone('lapis'), h('span', { class: 'acao-rotulo' }, 'Registrar…')));
  } else {
    for (const a of lista) {
      const b = h('button', {
        class: 'botao-acao',
        onclick: () => aplicar(a, agora % 1440, ctx),
      },
        icone(iconeDoTipo(a.tipo)),
        h('span', { class: 'acao-texto' },
          h('span', { class: 'acao-rotulo' }, a.rotulo),
          a.planejado != null && h('span', { class: 'acao-plano' }, `previsto ${hhmm(a.planejado)}`)));
      toqueLongo(b, () => escolherHorario({
        titulo: a.rotulo, minutos: agora % 1440,
        aoEscolher: (m) => aplicar(a, m, ctx),
      }));
      barra.append(b);
    }
    barra.append(h('button', {
      class: 'icone-acao', 'aria-label': 'Outros registros do dia',
      onclick: () => folhaRegistros(dia, ctx),
    }, icone('reticencias')));
  }
  ctx.rodape.append(barra);
}

function aplicar(acao, minuto, ctx) {
  acao.executar(minuto);
  const d = acao.planejado != null ? fmtDesvio(minuto - acao.planejado) : '';
  aviso(`${acao.rotulo} às ${hhmm(minuto)}${d ? ` · ${d}` : ''}`);
  if (acao.irPara) ctx.ir(acao.irPara);
  else ctx.recarregar();
}

function corrigir(o, dia, ctx) {
  const item = registraveisDoDia(dia).find((r) => r.id === o.id) || null;
  if (!item) return;
  escolherHorario({
    titulo: `${item.titulo} — ${item.tipo === 'transito' ? 'saída' : 'horário'}`,
    minutos: item.atual ? min(item.atual) : item.inicio,
    aoEscolher: (m) => { item.definir(m); ctx.recarregar(); },
    aoApagar: item.apagar ? () => { item.apagar(); ctx.recarregar(); } : null,
  });
}

function folhaRegistros(dia, ctx) {
  folha('Registros de hoje', (fechar) => {
    const lista = registraveisDoDia(dia);
    return h('div', { class: 'lista' },
      lista.length ? lista.map((r) => linha(
        [
          h('span', { class: 'linha-titulo' }, r.titulo),
          h('span', { class: 'linha-sub' }, `previsto ${hhmm(r.inicio)}`),
        ],
        [
          h('button', {
            class: `etiqueta ${r.atual ? classeSituacao(r.status) : ''}`.trim(),
            onclick: () => escolherHorario({
              titulo: r.titulo, minutos: r.atual ? min(r.atual) : r.inicio,
              aoEscolher: (m) => { r.definir(m); fechar(); ctx.recarregar(); },
              aoApagar: r.apagar ? () => { r.apagar(); fechar(); ctx.recarregar(); } : null,
            }),
          }, r.atual || 'registrar'),
          r.definirSegundo && h('button', {
            class: 'etiqueta',
            onclick: () => escolherHorario({
              titulo: `${r.titulo} — chegada`, minutos: r.segundo ? min(r.segundo) : r.fim,
              aoEscolher: (m) => { r.definirSegundo(m); fechar(); ctx.recarregar(); },
            }),
          }, r.segundo || 'chegada'),
        ],
      )) : vazio('Nada previsto para hoje.'));
  });
}

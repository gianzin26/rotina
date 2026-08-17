// ui/telas/hoje.js — linha do tempo do dia, botão de um toque e o dia corrente.

import { acoes, agoraNoDia, registraveisDoDia } from '../../nucleo/acoes.js';
import { horasDeSono, proxima } from '../../nucleo/agenda.js';
import { AMOSTRAS_MINIMAS, comparacao, estatisticas, nomeDoTrajeto } from '../../nucleo/deslocamento.js';
import { mudar, reg, registroDoDia, upsertDia } from '../../nucleo/store.js';
import {
  DIAS, dataLonga, diaLogico, duracao, fmtDesvio, hhmm, min, somaDias,
} from '../../nucleo/util.js';
import { cartao, dado, etiqueta, fileiraDados, linha } from '../cartao.js';
import { anexar, classeSituacao, h, toqueLongo, vazio } from '../dom.js';
import { aviso, escolherHorario, escolherNumero, folha } from '../folha.js';
import { icone, iconeDoTipo } from '../icones.js';
import { centralizarAgora, linhaDoTempo } from '../linhaDoTempo.js';

export function render(tela, ctx) {
  const dia = diaLogico();
  const agora = agoraNoDia(dia);

  const rolagem = h('div', { class: 'lt-rolagem' });
  const lt = linhaDoTempo(dia, (o) => corrigir(o, dia, ctx));
  rolagem.append(lt);

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Hoje'),
        h('p', { class: 'cabecalho-sub' }, dataLonga(dia)))),
    cartaoProximo(dia, agora),
    h('div', { class: 'grade' },
      cartao({ titulo: 'Linha do tempo', subtitulo: 'Real desenhado sobre o previsto', largo: true, classe: 'total' },
        rolagem),
      cartaoSono(dia, ctx),
      cartaoExtras(dia, ctx),
      cartaoDeslocamento()));

  barraAcao(dia, agora, ctx);
  requestAnimationFrame(() => centralizarAgora(lt, rolagem));
}

/* ---------------- topo ---------------- */

function cartaoProximo(dia, agora) {
  const p = proxima(dia, agora);
  if (!p) {
    return h('div', { class: 'proximo' },
      h('span', { class: 'proximo-icone' }, icone('check')),
      h('div', { class: 'proximo-info' },
        h('span', { class: 'proximo-rotulo' }, 'Agenda'),
        h('span', { class: 'proximo-titulo' }, 'Nada mais previsto para hoje')));
  }
  const faltam = p.inicio - agora;
  return h('div', { class: `proximo tipo-${p.tipo}` },
    h('span', { class: 'proximo-icone' }, icone(iconeDoTipo(p.tipo))),
    h('div', { class: 'proximo-info' },
      h('span', { class: 'proximo-rotulo' }, `Próximo · ${hhmm(p.inicio)}`),
      h('span', { class: 'proximo-titulo' }, p.titulo)),
    h('span', { class: 'proximo-tempo' }, faltam <= 0 ? 'agora' : duracao(faltam)));
}

/* ---------------- botão principal ---------------- */

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
        titulo: a.rotulo,
        minutos: agora % 1440,
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

/** Correção manual: toque num bloco da linha do tempo ou no botão “⋯”. */
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

/* ---------------- sono ---------------- */

function cartaoSono(dia, ctx) {
  const s = registroDoDia('sono', dia) || {};
  const horas = horasDeSono(dia);
  const alerta = noitesCurtas(dia);

  return cartao({
    titulo: 'Sono',
    subtitulo: 'Noite que terminou hoje',
    metrica: horas != null ? duracao(horas * 60) : '—',
    legenda: horas != null ? 'entre dormir e acordar' : 'aguardando os dois carimbos',
  },
    alerta && h('p', { class: 'alerta vermelho' }, icone('sono'), alerta),
    fileiraDados(
      dado('Acordou', s.acordou || '—'),
      dado('Dormiu', s.dormiu || '—'),
      dado('FC repouso', s.fcRepouso ? String(s.fcRepouso) : '—', {
        sufixo: s.fcRepouso ? 'bpm' : null,
        aoTocar: () => escolherNumero({
          titulo: 'FC de repouso', rotulo: 'Batimentos por minuto ao acordar',
          valor: s.fcRepouso ?? '', passo: 1, sufixo: 'bpm',
          aoEscolher: (v) => { upsertDia('sono', dia, { fcRepouso: v }); ctx.recarregar(); },
        }),
      })));
}

function noitesCurtas(dia) {
  let seguidas = 0;
  for (let i = 0; i < 3; i++) {
    const hSono = horasDeSono(somaDias(dia, -i));
    if (hSono != null && hSono < 6) seguidas++;
    else break;
  }
  return seguidas >= 3 ? 'Menos de 6 h de sono há 3 noites seguidas.' : null;
}

/* ---------------- deslocamento ---------------- */

function cartaoDeslocamento() {
  const stats = estatisticas().sort((a, b) => b.n - a.n);
  if (!stats.length) {
    return cartao({ titulo: 'Deslocamento', subtitulo: 'Tempo real por trajeto' },
      vazio('Registre suas viagens para o app aprender o tempo real de cada trajeto.'));
  }
  const confiaveis = stats.filter((s) => s.confiavel);
  const mostrar = (confiaveis.length ? confiaveis : stats).slice(0, 4);

  return cartao({ titulo: 'Deslocamento', subtitulo: 'Mediana medida por trajeto e dia' },
    h('div', { class: 'lista' },
      mostrar.map((s) => linha(
        [
          h('span', { class: 'linha-titulo' }, nomeDoTrajeto(s.trajetoId)),
          h('span', { class: 'linha-sub' },
            `${DIAS[s.dow]} · mediana ${duracao(s.medianaDuracao)} · estimado ${s.estimado} min`),
        ],
        s.confiavel && s.sugestao
          ? etiqueta(`sair ${hhmm(s.sugestao.saida)}`, Math.abs(s.sugestao.ajuste) > 5 ? 'deriva' : 'noAlvo')
          : etiqueta(`${AMOSTRAS_MINIMAS - s.n} p/ sugestão`),
      ))),
    !confiaveis.length && h('p', { class: 'texto-suave' },
      `A sugestão de horário aparece com ${AMOSTRAS_MINIMAS} viagens do mesmo trajeto no mesmo dia da semana.`),
    h('button', { class: 'botao largura-total', onclick: folhaComparacao },
      icone('insights'), 'Comparar trajetos'));
}

/** Comparação entre trajetos: mediana, melhor e pior tempo de cada rota. */
function folhaComparacao() {
  const linhas = comparacao().sort((a, b) => b.medianaDuracao - a.medianaDuracao);
  folha('Trajetos', () => h('div', { class: 'pilha' },
    linhas.length ? h('div', { class: 'lista' }, linhas.map((c) => linha(
      [
        h('span', { class: 'linha-titulo' }, `${c.trajeto.origem} → ${c.trajeto.destino}`),
        h('span', { class: 'linha-sub' },
          `${c.n} viagens · melhor ${duracao(c.melhor)} · pior ${duracao(c.pior)} · estimado ${c.trajeto.minutosEstimados} min`),
      ],
      etiqueta(duracao(c.medianaDuracao),
        c.medianaDuracao > c.trajeto.minutosEstimados + 5 ? 'deriva' : 'noAlvo'),
    ))) : vazio('Nenhuma viagem registrada ainda.'),
    h('p', { class: 'texto-suave' },
      'A etiqueta mostra a mediana real. Amarelo quando ela passa da estimativa cadastrada.')));
}

/* ---------------- extras ---------------- */

function cartaoExtras(dia, ctx) {
  const temCreatina = !!registroDoDia('creatina', dia);
  const prot = registroDoDia('proteina', dia)?.nota || null;
  const nota = registroDoDia('notas', dia)?.texto || '';

  const creatina = h('button', {
    class: `botao largura-total ${temCreatina ? 'ativo' : ''}`,
    onclick: () => {
      mudar(() => {
        const lista = reg('creatina');
        const i = lista.findIndex((x) => x.data === dia);
        if (i >= 0) lista.splice(i, 1); else lista.push({ data: dia });
      });
      ctx.recarregar();
    },
  }, temCreatina && icone('check'), temCreatina ? 'Creatina tomada' : 'Creatina');

  const proteina = h('div', { class: 'grupo-abc' },
    ['A', 'B', 'C'].map((n) => h('button', {
      class: `chip-abc ${prot === n ? 'ativo' : ''}`,
      onclick: () => {
        upsertDia('proteina', dia, { nota: prot === n ? null : n });
        ctx.recarregar();
      },
    }, n)));

  return cartao({ titulo: 'Extras', subtitulo: 'Marcações rápidas do dia' },
    creatina,
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-titulo' }, 'Proteína do almoço'), proteina),
      linha(
        [
          h('span', { class: 'linha-titulo' }, 'Dor ou incômodo'),
          nota && h('span', { class: 'linha-sub' }, nota),
        ],
        icone('chevronDireita'),
        {
          aoTocar: () => folha('Nota do dia', (fechar) => {
            const area = h('textarea', { rows: 4, placeholder: 'Dor, incômodo, algo fora do normal…' });
            area.value = nota;
            return h('div', { class: 'pilha' }, area,
              h('button', {
                class: 'botao primario',
                onclick: () => { upsertDia('notas', dia, { texto: area.value.trim() }); fechar(); ctx.recarregar(); },
              }, 'Salvar'));
          }),
        },
      )));
}

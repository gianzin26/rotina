// ui/telas/treino.js — sessão de força do dia e a parte de corrida.

import { iniciarCorrida, iniciarTreino } from '../../nucleo/acoes.js';
import { ocorrencias } from '../../nucleo/agenda.js';
import { criarCronometro, mmss } from '../../nucleo/cronometro.js';
import { estado, mudar, reg, sessao } from '../../nucleo/store.js';
import {
  corridas, deload, exerciciosConhecidos, historico, kmPorTenis,
  marcarDeloadFeito, progressao, sugestaoCarga, testes5k,
} from '../../nucleo/treino.js';
import { agoraMin, dataCurta, diaLogico, duracao, hhmm, nUm, uid } from '../../nucleo/util.js';
import { avisarFase, avisarInicio, prepararAudio, segurarTela, soltarTela } from '../alarme.js';
import { cartao, dado, etiqueta, fileiraDados, linha, titulo } from '../cartao.js';
import { anexar, h, vazio } from '../dom.js';
import { aviso, campo, confirmar, entradaNumero, escolherNumero, fileiraRPE, folha, segmentos } from '../folha.js';
import { grafico } from '../grafico.js';
import { icone } from '../icones.js';

let aba = 'forca';
let exercicioGrafico = null;
let sessaoEscolhida = null;

let cron = null;
let cronConfig = null;
let pintarCron = () => {};

export function render(tela, ctx) {
  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Treino'),
        h('p', { class: 'cabecalho-sub' }, aba === 'forca' ? 'Força' : 'Corrida')),
      h('div', { class: 'cabecalho-acoes' },
        segmentos([{ id: 'forca', rotulo: 'Força' }, { id: 'corrida', rotulo: 'Corrida' }], aba,
          (id) => { aba = id; ctx.recarregar(); }))));

  const grade = h('div', { class: 'grade' });
  tela.append(grade);
  if (aba === 'forca') telaForca(grade, ctx);
  else telaCorrida(grade, ctx);
}

/* ================= força ================= */

function telaForca(grade, ctx) {
  const dia = diaLogico();
  const doDia = ocorrencias(dia).filter((o) => o.tipo === 'treino');
  const alvo = doDia.find((o) => o.sessaoId === sessaoEscolhida) || doDia[0] || null;
  const s = sessao(alvo?.sessaoId || sessaoEscolhida);
  const registro = alvo?.registro
    || reg('treino').find((t) => t.data === dia && t.sessaoId === s?.id)
    || null;

  anexar(grade,
    doDia.length > 1 && h('div', { class: 'cartao total' },
      segmentos(doDia.map((o) => ({ id: o.sessaoId, rotulo: o.titulo })),
        alvo?.sessaoId, (id) => { sessaoEscolhida = id; ctx.recarregar(); })),
    s ? cartaoSessao(s, registro, alvo, dia, ctx)
      : cartao({ titulo: 'Sem sessão hoje', subtitulo: 'A rotina não prevê treino de força' },
        vazio('Você pode registrar uma sessão avulsa mesmo assim.'),
        h('button', { class: 'botao largura-total', onclick: () => escolherSessaoAvulsa(dia, ctx) },
          icone('mais'), 'Registrar sessão avulsa')),
    cartaoDeload(ctx),
    cartaoProgressao(),
    cartaoHistorico());
}

function cartaoDeload(ctx) {
  const d = deload();
  const situacao = d.atrasado ? 'fora' : d.devido ? 'deriva' : 'noAlvo';
  return cartao({
    titulo: 'Bloco de treino',
    subtitulo: `Deload a cada ${d.janela[0]}–${d.janela[1]} semanas`,
    metrica: String(d.semana || '—'),
    unidade: d.semana === 1 ? 'semana' : 'semanas',
    legenda: d.devido ? 'hora de aliviar a carga' : `faltam ${d.faltam} para o deload`,
    delta: { texto: d.devido ? 'devido' : 'em dia', situacao },
  },
    h('button', {
      class: 'botao largura-total',
      onclick: async () => {
        if (await confirmar('Deload', 'Zera a contagem e começa um bloco novo a partir de hoje.', 'Marcar deload')) {
          marcarDeloadFeito(); aviso('Bloco reiniciado.'); ctx.recarregar();
        }
      },
    }, icone('zerar'), 'Marcar deload feito'));
}

function cartaoSessao(s, registro, ocorrencia, dia, ctx) {
  const corpo = [];
  const feitos = registro ? (registro.exercicios || []).length : 0;

  if (!registro) {
    corpo.push(h('button', {
      class: 'botao primario largura-total',
      onclick: () => {
        iniciarTreino(dia, ocorrencia || { id: null, sessaoId: s.id }, agoraMin());
        aviso('Sessão iniciada.');
        ctx.recarregar();
      },
    }, icone('iniciar'), 'Iniciar sessão'));
  }

  for (const ex of s.exercicios) corpo.push(linhaExercicio(ex, registro, s.id, ctx));

  if (registro) {
    corpo.push(
      titulo('RPE da sessão'),
      fileiraRPE(registro.rpe, (v) => { mudar(() => { registro.rpe = v; }); ctx.recarregar(); }),
      h('button', {
        class: `botao largura-total ${registro.fim ? 'ativo' : 'primario'}`,
        onclick: () => {
          mudar(() => { registro.fim = registro.fim ? null : hhmm(agoraMin()); });
          if (registro.fim) aviso('Sessão encerrada.');
          ctx.recarregar();
        },
      }, registro.fim && icone('check'),
        registro.fim ? `Encerrada às ${registro.fim} — reabrir` : 'Encerrar sessão'));
  }

  return cartao({
    titulo: s.nome,
    subtitulo: registro?.inicio ? `Iniciada às ${registro.inicio}` : 'Sessão do dia',
    periodo: `${s.exercicios.length} exercícios`,
    metrica: String(feitos),
    unidade: `/ ${s.exercicios.length}`,
    legenda: 'exercícios registrados',
  }, ...corpo);
}

function linhaExercicio(ex, registro, sessaoId, ctx) {
  const feito = registro ? (registro.exercicios || []).find((x) => x.nome === ex.nome) : null;
  const ref = sugestaoCarga(sessaoId, ex.nome, registro?.data || null);
  const carga = feito?.carga ?? ref.carga;
  const reps = feito?.reps ?? ref.reps ?? ex.repsAlvo;

  const gravar = (campos) => {
    if (!registro) { aviso('Inicie a sessão primeiro.'); return; }
    mudar(() => {
      const lista = (registro.exercicios ||= []);
      let e = lista.find((x) => x.nome === ex.nome);
      if (!e) { e = { nome: ex.nome, carga: carga ?? null, reps: reps ?? null }; lista.push(e); }
      Object.assign(e, campos);
    });
    ctx.recarregar();
  };

  const passo = (valorAtual, delta) => Math.max(0, Math.round(((valorAtual ?? 0) + delta) * 100) / 100);

  return h('div', { class: `exercicio ${feito ? 'registrado' : ''}` },
    h('div', { class: 'exercicio-topo' },
      h('span', { class: 'exercicio-nome' }, ex.nome),
      h('span', { class: 'linha-sub' },
        ref.data
          ? `última: ${ref.carga != null ? `${nUm(ref.carga, ref.carga % 1 ? 1 : 0)} kg × ${ref.reps ?? '—'}` : `${ref.reps ?? '—'} reps`} em ${dataCurta(ref.data)}`
          : `alvo: ${ref.carga != null ? `${nUm(ref.carga, 0)} kg × ${ex.repsAlvo}` : `${ex.repsAlvo} reps`}`)),
    h('div', { class: 'exercicio-controles' },
      contador(carga, 'kg', 2.5, (v) => gravar({ carga: v }), passo,
        () => escolherNumero({
          titulo: ex.nome, rotulo: 'Carga', valor: carga, passo: 0.5, sufixo: 'kg',
          aoEscolher: (v) => gravar({ carga: v }),
        })),
      contador(reps, 'reps', 1, (v) => gravar({ reps: v }), passo,
        () => escolherNumero({
          titulo: ex.nome, rotulo: 'Repetições', valor: reps, passo: 1, sufixo: 'reps',
          aoEscolher: (v) => gravar({ reps: v }),
        }))));
}

function contador(valor, sufixo, delta, aoMudar, passo, aoTocarValor) {
  return h('div', { class: 'contador' },
    h('button', {
      class: 'contador-btn', 'aria-label': `menos ${delta} ${sufixo}`,
      onclick: () => aoMudar(passo(valor, -delta)),
    }, icone('menos')),
    h('button', { class: 'contador-valor', onclick: aoTocarValor },
      valor != null ? nUm(valor, valor % 1 ? 1 : 0) : '—',
      h('span', { class: 'contador-sufixo' }, sufixo)),
    h('button', {
      class: 'contador-btn', 'aria-label': `mais ${delta} ${sufixo}`,
      onclick: () => aoMudar(passo(valor, delta)),
    }, icone('mais')));
}

function escolherSessaoAvulsa(dia, ctx) {
  folha('Qual sessão?', (fechar) => h('div', { class: 'pilha' },
    estado.sessoesTreino.map((s) => h('button', {
      class: 'botao largura-total',
      onclick: () => {
        iniciarTreino(dia, { id: null, sessaoId: s.id }, agoraMin());
        sessaoEscolhida = s.id;
        fechar(); ctx.recarregar();
      },
    }, s.nome))));
}

function cartaoProgressao() {
  const nomes = exerciciosConhecidos();
  if (!nomes.length) {
    return cartao({ titulo: 'Progressão', subtitulo: 'Carga por sessão' }, vazio('Nenhum exercício cadastrado.'));
  }
  // começa por algum que já tenha carga registrada, senão o gráfico abre vazio
  exercicioGrafico = nomes.includes(exercicioGrafico)
    ? exercicioGrafico
    : nomes.find((n) => progressao(n).length) || nomes[0];
  const dados = progressao(exercicioGrafico);

  const seletor = h('select', {
    'aria-label': 'Exercício',
    onchange: (e) => {
      exercicioGrafico = e.target.value;
      const pai = e.target.closest('.cartao');
      pai.replaceWith(cartaoProgressao());
    },
  }, nomes.map((n) => h('option', { value: n, selected: n === exercicioGrafico }, n)));

  const passo = Math.max(1, Math.ceil(dados.length / 4));
  const primeiro = dados[0]?.carga;
  const ultimo = dados[dados.length - 1]?.carga;
  const ganho = primeiro != null && ultimo != null ? ultimo - primeiro : null;

  return cartao({
    titulo: 'Progressão',
    subtitulo: exercicioGrafico,
    periodo: `${dados.length} ${dados.length === 1 ? 'sessão' : 'sessões'}`,
    metrica: ultimo != null ? nUm(ultimo, ultimo % 1 ? 1 : 0) : '—',
    unidade: 'kg',
    legenda: 'carga da última sessão',
    delta: ganho != null && ganho !== 0 && {
      texto: `${ganho > 0 ? '+' : '−'}${nUm(Math.abs(ganho), Math.abs(ganho) % 1 ? 1 : 0)} kg`,
      situacao: ganho > 0 ? 'noAlvo' : 'fora',
      sentido: ganho > 0 ? 'subiu' : 'desceu',
    },
  },
    seletor,
    grafico({
      altura: 180, descricao: `carga de ${exercicioGrafico}`,
      formatoY: (y) => `${Math.round(y)}`,
      rotulosX: dados.map((d, i) => ({ i, d })).filter(({ i }) => i % passo === 0)
        .map(({ i, d }) => ({ x: i, texto: dataCurta(d.data) })),
      series: [{ tipo: 'linha', serie: 'serie-treino', marcadores: true, pontos: dados.map((d, x) => ({ x, y: d.carga })) }],
    }));
}

function cartaoHistorico() {
  const lista = historico().slice(0, 12);
  if (!lista.length) {
    return cartao({ titulo: 'Histórico', subtitulo: 'Sessões concluídas' }, vazio('Nenhuma sessão registrada.'));
  }
  return cartao({ titulo: 'Histórico', subtitulo: 'Sessões concluídas', periodo: `${lista.length} recentes` },
    h('div', { class: 'lista' }, lista.map((t) => linha(
      [
        h('span', { class: 'linha-titulo' }, sessao(t.sessaoId)?.nome || 'Sessão'),
        h('span', { class: 'linha-sub' },
          `${dataCurta(t.data)} · ${(t.exercicios || []).length} exercícios${t.rpe ? ` · RPE ${t.rpe}` : ''}`),
      ],
      icone('chevronDireita'),
      { aoTocar: () => detalheSessao(t) },
    ))));
}

function detalheSessao(t) {
  folha(`${sessao(t.sessaoId)?.nome || 'Sessão'} · ${dataCurta(t.data)}`, () => h('div', { class: 'pilha' },
    (t.exercicios || []).length
      ? h('div', { class: 'lista' }, t.exercicios.map((e) => linha(
        h('span', { class: 'linha-titulo' }, e.nome),
        h('span', { class: 'dado-valor' },
          e.carga != null ? nUm(e.carga, e.carga % 1 ? 1 : 0) : '—',
          h('span', { class: 'dado-sufixo' }, `kg × ${e.reps ?? '—'}`)),
      )))
      : vazio('Sem cargas registradas.'),
    t.rpe && h('p', { class: 'texto-suave' }, `RPE ${t.rpe}`)));
}

/* ================= corrida ================= */

function telaCorrida(grade, ctx) {
  anexar(grade, cartaoCronometro(ctx), cartaoRegistroCorrida(ctx), cartaoTenis(ctx), cartaoCorridas());
}

function cartaoCronometro(ctx) {
  const cfg = estado.perfil.corrida || { ciclos: 6, corridaMin: 3, caminhadaMin: 2 };
  const painel = h('div', { class: 'cron' });
  const botoes = h('div', { class: 'cron-botoes' });

  pintarCron = (e) => {
    const tipo = e.fase?.tipo || 'corrida';
    painel.replaceChildren(
      h('span', { class: `cron-fase tipo-${tipo}` },
        h('span', { class: 'cron-fase-ponto' }),
        e.terminado ? 'Fim da sessão' : e.fase?.rotulo || 'Pronto'),
      h('span', { class: 'cron-tempo' }, mmss(e.terminado ? 0 : e.restante)),
      h('div', { class: 'cron-barra' },
        h('div', { class: 'cron-barra-cheia', vars: { progresso: Math.min(1, e.decorridoTotal / e.totalSeg) } })),
      h('span', { class: 'texto-suave' },
        `${Math.min(e.indice + 1, e.totalFases)} de ${e.totalFases} · faltam ${mmss(Math.max(0, e.totalSeg - e.decorridoTotal))}`));
  };

  const criar = () => {
    cronConfig = { ...cfg };
    cron = criarCronometro(cfg, {
      aoAtualizar: (e) => pintarCron(e),
      aoTrocarFase: (fase) => { avisarFase(fase); if (!fase) soltarTela(); },
      aoTerminar: (minutos) => {
        aviso('Sessão de intervalos concluída.');
        registrarCorridaConcluida(minutos, ctx);
      },
    });
  };

  if (!cron || JSON.stringify(cronConfig) !== JSON.stringify(cfg)) criar();
  pintarCron(cron.estado());

  const atualizarBotoes = () => {
    const e = cron.estado();
    botoes.replaceChildren(
      h('button', {
        class: 'botao primario',
        onclick: () => {
          prepararAudio();
          if (e.rodando) { cron.pausar(); soltarTela(); }
          else { cron.iniciar(); avisarInicio(); segurarTela(); }
          atualizarBotoes();
        },
      }, icone(e.rodando ? 'pausar' : 'iniciar'),
        e.rodando ? 'Pausar' : e.decorridoTotal > 0 ? 'Retomar' : 'Iniciar'),
      h('button', {
        class: 'botao', onclick: () => { cron.pular(); atualizarBotoes(); },
      }, icone('pular'), 'Pular'),
      h('button', {
        class: 'botao perigo-texto',
        onclick: () => {
          const m = cron.parar();
          soltarTela();
          atualizarBotoes();
          if (m > 1) registrarCorridaConcluida(m, ctx);
        },
      }, icone('zerar'), 'Zerar'));
  };
  atualizarBotoes();

  function salvarCfg(campos) {
    mudar(() => { estado.perfil.corrida = { ...cfg, ...campos }; });
    cron = null;
    ctx.recarregar();
  }

  const config = h('div', { class: 'cron-config' },
    campo('Ciclos', entradaNumero(cfg.ciclos, (v) => salvarCfg({ ciclos: Math.max(1, v || 1) }), { min: 1, step: 1 })),
    campo('Corrida (min)', entradaNumero(cfg.corridaMin, (v) => salvarCfg({ corridaMin: v ?? 0 }), { min: 0, step: 0.5 })),
    campo('Caminhada (min)', entradaNumero(cfg.caminhadaMin, (v) => salvarCfg({ caminhadaMin: v ?? 0 }), { min: 0, step: 0.5 })));

  return cartao({
    titulo: 'Cronômetro de intervalo',
    subtitulo: `${cfg.ciclos}× ${cfg.corridaMin} min corrida / ${cfg.caminhadaMin} min caminhada`,
  }, painel, botoes, config);
}

function registrarCorridaConcluida(minutos, ctx) {
  const dia = diaLogico();
  let c = corridas().find((x) => x.data === dia);
  if (!c) c = iniciarCorrida(dia, null, agoraMin());
  mudar(() => { c.minutos = Math.round(minutos); });
  ctx.recarregar();
}

function cartaoRegistroCorrida(ctx) {
  const dia = diaLogico();
  const c = corridas().find((x) => x.data === dia) || null;

  const garantir = () => c || iniciarCorrida(dia, null, agoraMin());
  const grava = (campos) => {
    const alvo = garantir();
    mudar(() => Object.assign(alvo, campos));
    ctx.recarregar();
  };

  const ritmo = c?.minutos && c?.distanciaKm ? c.minutos / c.distanciaKm : null;

  return cartao({
    titulo: 'Corrida de hoje',
    subtitulo: 'Distância, tempo e esforço',
    metrica: c?.distanciaKm != null ? nUm(c.distanciaKm, 1) : '—',
    unidade: 'km',
    legenda: ritmo != null ? `ritmo de ${nUm(ritmo, 1)} min/km` : 'sem distância registrada',
  },
    fileiraDados(
      dado('Distância', c?.distanciaKm != null ? nUm(c.distanciaKm, 1) : '—', {
        sufixo: 'km',
        aoTocar: () => escolherNumero({
          titulo: 'Distância', rotulo: 'Quilômetros', valor: c?.distanciaKm ?? '', passo: 0.1, sufixo: 'km',
          aoEscolher: (v) => grava({ distanciaKm: v }),
        }),
      }),
      dado('Tempo', c?.minutos != null ? duracao(c.minutos) : '—', {
        aoTocar: () => escolherNumero({
          titulo: 'Tempo', rotulo: 'Minutos', valor: c?.minutos ?? '', passo: 1, sufixo: 'min',
          aoEscolher: (v) => grava({ minutos: v }),
        }),
      }),
      dado('Ritmo', ritmo != null ? nUm(ritmo, 1) : '—', { sufixo: ritmo != null ? 'min/km' : null })),
    titulo('RPE'),
    fileiraRPE(c?.rpe ?? null, (v) => grava({ rpe: v })),
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-titulo' }, 'Tênis'),
        h('select', {
          'aria-label': 'Tênis',
          onchange: (e) => grava({ tenisId: e.target.value }),
        }, (estado.tenis || []).map((t) => h('option', { value: t.id, selected: c?.tenisId === t.id }, t.nome))))),
    h('button', {
      class: `botao largura-total ${c?.teste5k ? 'ativo' : ''}`,
      onclick: () => grava({ teste5k: !c?.teste5k, distanciaKm: c?.teste5k ? c?.distanciaKm : 5 }),
    }, c?.teste5k && icone('check'),
      c?.teste5k ? 'Marcada como teste de 5 km' : 'Marcar como teste de 5 km'));
}

function cartaoTenis(ctx) {
  const lista = kmPorTenis();
  const alerta = lista.some((t) => t.status !== 'noAlvo');

  return cartao({ titulo: 'Tênis', subtitulo: 'Quilometragem acumulada por par' },
    h('div', { class: 'lista' }, lista.map((t) => linha(
      [
        h('span', { class: 'linha-titulo' }, t.nome),
        h('span', { class: 'linha-sub' }, `${t.corridas} corridas · alerta em ${t.alertaKm} km`),
      ],
      etiqueta(`${nUm(t.km, 0)} km`, t.status),
    ))),
    alerta && h('p', { class: 'alerta' }, 'Um par está perto do limite de quilometragem.'),
    h('button', {
      class: 'botao largura-total',
      onclick: () => folha('Novo tênis', (fechar) => {
        let nome = ''; let kmInicial = 0;
        return h('div', { class: 'pilha' },
          campo('Nome', h('input', { type: 'text', oninput: (e) => { nome = e.target.value; } })),
          campo('Km já rodados', entradaNumero(0, (v) => { kmInicial = v || 0; }, { step: 1 })),
          h('button', {
            class: 'botao primario',
            onclick: () => {
              if (!nome.trim()) return;
              mudar(() => { (estado.tenis ||= []).push({ id: uid('tn'), nome: nome.trim(), kmInicial, alertaKm: 700 }); });
              fechar(); ctx.recarregar();
            },
          }, 'Adicionar'));
      }),
    }, icone('mais'), 'Adicionar tênis'));
}

function cartaoCorridas() {
  const lista = corridas().slice(0, 10);
  const testes = testes5k();
  if (!lista.length) {
    return cartao({ titulo: 'Corridas', subtitulo: 'Registros recentes' }, vazio('Nenhuma corrida registrada.'));
  }
  const totalKm = corridas().reduce((a, c) => a + (c.distanciaKm || 0), 0);

  return cartao({
    titulo: 'Corridas',
    subtitulo: 'Registros recentes',
    metrica: nUm(totalKm, 1),
    unidade: 'km',
    legenda: testes.length
      ? `melhor teste de 5 km: ${duracao(Math.min(...testes.map((t) => t.minutos)))}`
      : 'acumulado de todas as corridas',
  },
    h('div', { class: 'lista' }, lista.map((c) => linha(
      [
        h('span', { class: 'linha-titulo' }, c.distanciaKm != null ? `${nUm(c.distanciaKm, 1)} km` : '—'),
        h('span', { class: 'linha-sub' },
          `${dataCurta(c.data)}${c.minutos != null ? ` · ${duracao(c.minutos)}` : ''}${c.rpe ? ` · RPE ${c.rpe}` : ''}`),
      ],
      c.teste5k && etiqueta('teste', 'noAlvo'),
    ))));
}

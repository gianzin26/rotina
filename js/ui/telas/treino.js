// ui/telas/treino.js — a corrida do dia, o cronômetro de intervalos e o histórico.
//
// Musculação saiu daqui a pedido: a tela é só corrida. Os treinos de força já
// registrados continuam guardados em `registros.treino` e no backup — o que
// mudou foi a tela, não os dados.

import { iniciarCorrida } from '../../nucleo/acoes.js';
import { ocorrencias } from '../../nucleo/agenda.js';
import { criarCronometro, mmss } from '../../nucleo/cronometro.js';
import { estado, mudar } from '../../nucleo/store.js';
import { corridas, kmPorTenis, testes5k } from '../../nucleo/treino.js';
import { agoraMin, dataCurta, diaLogico, duracao, hhmm, nUm } from '../../nucleo/util.js';
import { avisarFase, avisarInicio, prepararAudio, segurarTela, soltarTela } from '../alarme.js';
import { cartao, dado, etiqueta, fileiraDados, linha, titulo } from '../cartao.js';
import { anexar, h } from '../dom.js';
import { aviso, campo, entradaNumero, escolherNumero, fileiraRPE, folha } from '../folha.js';
import { icone } from '../icones.js';
import { paceTexto } from './visaoGeral.js';

let cron = null;
let cronConfig = null;
let pintarCron = () => {};

export function render(tela, ctx) {
  const grade = h('div', { class: 'grade' });
  anexar(grade, cartaoDoDia(ctx), cartaoCronometro(ctx), cartaoTenis(ctx), cartaoCorridas());

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Treino'),
        h('p', { class: 'cabecalho-sub' }, 'Corrida'))),
    grade);
}

/** A corrida prevista para hoje na rotina, se houver. */
function previstaHoje(dia) {
  return ocorrencias(dia).filter((o) => o.tipo === 'corrida').sort((a, b) => a.inicio - b.inicio)[0] || null;
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
        // sessão sem fases daria 0/0: a variável CSS receberia NaN
        h('div', { class: 'cron-barra-cheia', vars: { progresso: e.totalSeg ? Math.min(1, e.decorridoTotal / e.totalSeg) : 0 } })),
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

function cartaoDoDia(ctx) {
  const dia = diaLogico();
  const c = corridas().find((x) => x.data === dia) || null;
  const prevista = previstaHoje(dia);

  const garantir = () => c || iniciarCorrida(dia, null, agoraMin());
  const grava = (campos) => {
    const alvo = garantir();
    mudar(() => Object.assign(alvo, campos));
    ctx.recarregar();
  };

  const ritmo = c?.minutos > 0 && c?.distanciaKm > 0 ? c.minutos / c.distanciaKm : null;

  /* O modelo guarda distância e minutos; o pace é derivado. Editar o pace
     recalcula os minutos a partir da distância, para os dois baterem sempre. */
  const definirPace = (paceMin) => {
    const km = c?.distanciaKm;
    if (!(km > 0)) { aviso('Registre a distância primeiro.'); return; }
    grava({ minutos: Math.round(paceMin * km) });
  };

  // o que a rotina previu, o que já foi feito, e o que falta preencher
  const registrado = c?.distanciaKm > 0 || c?.minutos > 0;
  const legenda = ritmo != null
    ? `pace de ${paceTexto(ritmo)} min/km · ${duracao(c.minutos)}`
    : registrado
      ? 'falta a outra metade: distância e tempo'
      : prevista
        ? `previsto para ${hhmm(prevista.inicio)} · ainda não registrada`
        : 'sem corrida na rotina de hoje';

  return cartao({
    titulo: 'Corrida de hoje',
    periodo: prevista ? hhmm(prevista.inicio) : 'avulsa',
    metrica: c?.distanciaKm > 0 ? nUm(c.distanciaKm, 1) : '—',
    unidade: 'km',
    legenda,
    legendaSituacao: ritmo != null ? 'noAlvo' : null,
  },
    fileiraDados(
      dado('Distância', c?.distanciaKm > 0 ? nUm(c.distanciaKm, 1) : '—', {
        sufixo: 'km',
        aoTocar: () => escolherNumero({
          titulo: 'Distância', rotulo: 'Quilômetros', valor: c?.distanciaKm ?? '', passo: 0.1, sufixo: 'km',
          aoEscolher: (v) => grava({ distanciaKm: v }),
        }),
      }),
      dado('Pace', ritmo != null ? paceTexto(ritmo) : '—', {
        sufixo: 'min/km',
        aoTocar: () => escolherNumero({
          titulo: 'Pace', rotulo: 'Minutos por quilômetro (5,5 = 5:30)',
          valor: ritmo != null ? Math.round(ritmo * 100) / 100 : '', passo: 0.05, sufixo: 'min/km',
          aoEscolher: definirPace,
        }),
      }),
      dado('Tempo', c?.minutos > 0 ? duracao(c.minutos) : '—', {
        aoTocar: () => escolherNumero({
          titulo: 'Tempo', rotulo: 'Minutos', valor: c?.minutos ?? '', passo: 1, sufixo: 'min',
          aoEscolher: (v) => grava({ minutos: v }),
        }),
      })),
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
        h('span', { class: 'linha-titulo' }, c.distanciaKm > 0 ? `${nUm(c.distanciaKm, 1)} km` : '—'),
        h('span', { class: 'linha-sub' },
          `${dataCurta(c.data)}${c.minutos > 0 && c.distanciaKm > 0 ? ` · ${paceTexto(c.minutos / c.distanciaKm)} min/km` : ''}${c.rpe ? ` · RPE ${c.rpe}` : ''}`),
      ],
      c.teste5k && etiqueta('teste', 'noAlvo'),
    ))));
}

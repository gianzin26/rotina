// ui/telas/treino.js — a corrida do dia, o cronômetro de intervalos e o histórico.
//
// Musculação saiu daqui a pedido: a tela é só corrida. Os treinos de força já
// registrados continuam guardados em `registros.treino` e no backup — o que
// mudou foi a tela, não os dados.

import { iniciarCorrida } from '../../nucleo/acoes.js';
import { ocorrencias } from '../../nucleo/agenda.js';
import { criarCronometro, mmss } from '../../nucleo/cronometro.js';
import { estado, mudar } from '../../nucleo/store.js';
import {
  caloriasEstimadas, corridas, kmPorTenis, posicaoNaDistancia, testes5k,
} from '../../nucleo/treino.js';
import { resumo as resumoPeso } from '../../nucleo/peso.js';
import { agoraMin, dataCurta, diaLogico, hhmm, nUm, uid } from '../../nucleo/util.js';
import { avisarFase, avisarInicio, prepararAudio, segurarTela, soltarTela } from '../alarme.js';
import {
  cartao, dado, destaque, etiqueta, fileiraDados, linha, metricas, titulo,
} from '../cartao.js';
import { anexar, classeSituacao, h, variaveis } from '../dom.js';
import {
  aviso, campo, confirmar, entradaNumero, entradaTexto, escolherNumero, fileiraRPE, folha,
} from '../folha.js';
import { icone } from '../icones.js';
import { percurso } from '../percurso.js';
import { paceTexto } from './visaoGeral.js';

let cron = null;
let cronConfig = null;
let pintarCron = () => {};

export function render(tela, ctx) {
  const grade = h('div', { class: 'grade' });
  anexar(grade, cartaoDoDia(ctx), cartaoTenis(ctx), cartaoCronometro(ctx), cartaoCorridas());

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Treino'),
        h('p', { class: 'cabecalho-sub' }, 'Corrida'))),
    grade);
}

/* Corrida se mede em minutos e segundos: 27:39, não "28 min". O `duracao` do
   núcleo arredonda para o minuto, que serve para sono e trabalho mas apaga
   justamente a diferença que o corredor persegue. */
function tempoDeCorrida(minutos) {
  if (!(minutos > 0)) return '—';
  const total = Math.round(minutos * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  const dd = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(seg)}` : `${m}:${dd(seg)}`;
}

/** Diferença curta em linguagem de corrida: "1min 39s", "12s". */
function diferencaDeTempo(minutos) {
  const total = Math.round(Math.abs(minutos) * 60);
  const m = Math.floor(total / 60);
  const seg = total % 60;
  return m ? `${m}min ${String(seg).padStart(2, '0')}s` : `${seg}s`;
}

/** Milhar com ponto, como 1.111 m. */
const inteiro = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);

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

  if (!c || (!(c.distanciaKm > 0) && !(c.minutos > 0))) {
    return cartao({
      titulo: 'Corrida de hoje',
      periodo: prevista ? hhmm(prevista.inicio) : 'avulsa',
      metrica: '—',
      legenda: prevista
        ? `previsto para ${hhmm(prevista.inicio)} · ainda não registrada`
        : 'sem corrida na rotina de hoje',
    }, entradaRapida(c, grava, definirPace, ritmo));
  }

  const cheias = (c.parciais || []).filter((p) => p.completa && p.pace > 0);
  const melhorKm = cheias.length ? cheias.reduce((m, p) => (p.pace < m.pace ? p : m)) : null;
  const kcal = caloriasEstimadas(c.distanciaKm, resumoPeso().media7);
  const posicao = posicaoNaDistancia(c);
  const variacao = compararMetades(cheias);

  return cartao({
    titulo: c.nome || 'Corrida de hoje',
    periodo: c.inicio || (prevista ? hhmm(prevista.inicio) : 'avulsa'),
    // o pace é o número que o corredor procura primeiro
    metrica: ritmo != null ? paceTexto(ritmo) : '—',
    unidade: 'min/km',
    legenda: [
      c.distanciaKm > 0 ? `${nUm(c.distanciaKm, 2)} km` : null,
      c.minutos > 0 ? tempoDeCorrida(c.minutos) : null,
      c.elevacaoM ? `+${c.elevacaoM} m` : null,
    ].filter(Boolean).join(' · ') || 'falta distância e tempo',
    legendaSituacao: ritmo != null ? 'noAlvo' : null,
  },
    posicao && destaque(
      posicao.posicao === 1
        ? `Seu melhor tempo em ${nUm(c.distanciaKm, 1)} km`
        : `Seu ${posicao.posicao}º melhor tempo em ${nUm(c.distanciaKm, 1)} km`,
      posicao.diferencaMin != null
        ? `${diferencaDeTempo(posicao.diferencaMin)} do ${posicao.posicao === 2 ? 'melhor' : 'anterior'} · ${posicao.total} corridas nessa distância`
        : `entre ${posicao.total} corridas nessa distância`,
      posicao.posicao === 1 ? 'noAlvo' : null,
    ),
    metricas(
      { rotulo: 'Distância', valor: nUm(c.distanciaKm, 2), sufixo: 'km' },
      { rotulo: 'Ritmo médio', valor: ritmo != null ? paceTexto(ritmo) : '—', sufixo: '/km' },
      { rotulo: 'Tempo em movimento', valor: tempoDeCorrida(c.movimentoMin ?? c.minutos) },
      c.movimentoMin && c.minutos > c.movimentoMin + 0.5
        ? { rotulo: 'Tempo total', valor: tempoDeCorrida(c.minutos), nota: `${diferencaDeTempo(c.minutos - c.movimentoMin)} parado` }
        : { rotulo: 'Melhor km', valor: melhorKm ? paceTexto(melhorKm.pace) : '—', sufixo: melhorKm ? '/km' : null },
      c.elevacaoM != null && { rotulo: 'Ganho de elevação', valor: String(c.elevacaoM), sufixo: 'm' },
      c.elevacaoMaxM != null && { rotulo: 'Elevação máxima', valor: inteiro(c.elevacaoMaxM), sufixo: 'm' },
      kcal && { rotulo: 'Calorias', valor: inteiro(kcal), sufixo: 'kcal', nota: 'estimativa pelo seu peso' },
      c.fcMedia && { rotulo: 'Freq. cardíaca', valor: String(c.fcMedia), sufixo: 'bpm', nota: c.fcMaxima ? `máx ${c.fcMaxima}` : null },
      c.cadencia && { rotulo: 'Cadência', valor: String(c.cadencia * 2), sufixo: 'ppm' },
      variacao && { rotulo: 'Segunda metade', valor: variacao.texto, nota: variacao.nota },
    ),
    parciaisDaCorrida(c),
    c.traco ? percurso(c.traco, { altura: 150 }) : null,
    titulo('Esforço'),
    fileiraRPE(c.rpe ?? null, (v) => grava({ rpe: v })),
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-titulo' }, 'Tênis'),
        h('select', {
          'aria-label': 'Tênis',
          onchange: (e) => grava({ tenisId: e.target.value }),
        }, (estado.tenis || []).map((t) => h('option', { value: t.id, selected: c.tenisId === t.id }, t.nome))))));
}

/** Cartão ainda vazio: só o mínimo para registrar. */
function entradaRapida(c, grava, definirPace, ritmo) {
  return fileiraDados(
    dado('Distância', c?.distanciaKm > 0 ? nUm(c.distanciaKm, 2) : 'registrar', {
      sufixo: c?.distanciaKm > 0 ? 'km' : null,
      aoTocar: () => escolherNumero({
        titulo: 'Distância', rotulo: 'Quilômetros', valor: c?.distanciaKm ?? '', passo: 0.1, sufixo: 'km',
        aoEscolher: (v) => grava({ distanciaKm: v }),
      }),
    }),
    dado('Tempo', c?.minutos > 0 ? tempoDeCorrida(c.minutos) : 'registrar', {
      aoTocar: () => escolherNumero({
        titulo: 'Tempo', rotulo: 'Minutos', valor: c?.minutos ?? '', passo: 1, sufixo: 'min',
        aoEscolher: (v) => grava({ minutos: v }),
      }),
    }),
    dado('Pace', ritmo != null ? paceTexto(ritmo) : '—', {
      sufixo: ritmo != null ? 'min/km' : null,
      aoTocar: () => definirPace && escolherNumero({
        titulo: 'Pace', rotulo: 'Minutos por quilômetro (5,5 = 5:30)',
        valor: '', passo: 0.05, sufixo: 'min/km', aoEscolher: definirPace,
      }),
    }));
}

/**
 * Você acelerou ou caiu no fim?
 *
 * Compara o pace médio da primeira metade dos quilômetros com o da segunda.
 * Terminar mais rápido é o que os treinadores chamam de negative split, e é
 * sinal de corrida bem dosada.
 */
function compararMetades(cheias) {
  if (cheias.length < 4) return null;
  const meio = Math.floor(cheias.length / 2);
  const media = (lista) => lista.reduce((a, p) => a + p.pace, 0) / lista.length;
  const primeira = media(cheias.slice(0, meio));
  const segunda = media(cheias.slice(-meio));
  const dif = segunda - primeira;                 // positivo = ficou mais lento
  const segundos = Math.round(Math.abs(dif) * 60);
  if (segundos < 5) return { texto: 'constante', nota: 'mesmo ritmo do início ao fim' };
  return {
    texto: `${dif < 0 ? '−' : '+'}${segundos}s`,
    nota: dif < 0 ? 'acelerou no fim' : 'caiu no fim',
  };
}

/**
 * Pace de cada quilômetro, em barras horizontais.
 *
 * A barra é proporcional ao pace, então mais longa é mais lenta — o olho pega
 * a irregularidade sem ler número nenhum. O km mais rápido e o mais lento vêm
 * marcados; o trecho final, que não fecha um quilômetro, fica apagado para não
 * ser comparado de igual com os outros.
 */
function parciaisDaCorrida(c) {
  const lista = (c.parciais || []).filter((p) => p.pace > 0);
  if (lista.length < 2) return null;

  const cheias = lista.filter((p) => p.completa);
  const paces = cheias.map((p) => p.pace);
  const melhor = Math.min(...paces);
  const pior = Math.max(...paces);
  const teto = pior * 1.02;

  return h('div', { class: 'parciais' },
    titulo('Pace por km'),
    h('div', { class: 'parciais-lista' }, lista.map((p) => {
      const situacao = !p.completa ? null
        : p.pace === melhor ? 'noAlvo'
          : p.pace === pior && cheias.length > 2 ? 'fora' : null;
      return h('div', { class: `parcial ${p.completa ? '' : 'incompleta'}`.trim() },
        h('span', { class: 'parcial-km' }, p.completa ? p.km : '·'),
        variaveis(h('div', { class: 'parcial-trilho' },
          h('div', { class: `parcial-barra ${situacao ? classeSituacao(situacao) : ''}`.trim() })),
        { fracao: Math.min(1, p.pace / teto) }),
        h('span', { class: 'parcial-pace' }, paceTexto(p.pace)));
    })));
}

function cartaoTenis(ctx) {
  const lista = kmPorTenis();

  return cartao({ titulo: 'Tênis de corrida', subtitulo: `${lista.length} ${lista.length === 1 ? 'par' : 'pares'}` },
    lista.length
      ? h('div', { class: 'tenis-lista' }, lista.map((t) => blocoTenis(t, ctx)))
      : h('p', { class: 'texto-suave' }, 'Nenhum par cadastrado ainda.'),
    h('button', {
      class: 'botao largura-total',
      onclick: () => folhaTenis(null, ctx),
    }, icone('mais'), 'Adicionar tênis'));
}

/** Um par: foto, identidade, quilometragem e o quanto falta para trocar. */
function blocoTenis(t, ctx) {
  const alerta = t.alertaKm || 700;
  const fracao = Math.max(0, Math.min(1, t.km / alerta));

  const semFoto = () => h('div', { class: 'tenis-foto tenis-sem-foto' }, icone('corrida'));
  // nome errado ou arquivo que ainda não existe não pode virar ícone quebrado
  const foto = t.foto
    ? h('img', {
      class: 'tenis-foto', src: `./fotos/${t.foto}`, alt: t.nome, loading: 'lazy',
      onerror: (e) => e.target.replaceWith(semFoto()),
    })
    : semFoto();

  return h('button', { class: 'tenis', onclick: () => folhaTenis(t, ctx) },
    h('div', { class: 'tenis-palco' }, foto),
    h('div', { class: 'tenis-dados' },
      h('span', { class: 'tenis-nome' }, t.nome),
      t.modelo && h('span', { class: 'tenis-modelo' }, t.modelo),
      h('div', { class: 'tenis-numeros' },
        h('span', { class: 'tenis-km' }, nUm(t.km, 0), h('span', { class: 'tenis-km-unidade' }, 'km')),
        etiqueta(t.restante > 0 ? `faltam ${nUm(t.restante, 0)} km` : 'hora de trocar', t.status)),
      variaveis(h('div', { class: 'tenis-barra' },
        h('div', { class: `tenis-barra-cheia ${classeSituacao(t.status)}` })), { fracao }),
      h('span', { class: 'tenis-rodape' },
        `${t.corridas} ${t.corridas === 1 ? 'corrida' : 'corridas'} · troca em ${alerta} km`)));
}

function folhaTenis(t, ctx) {
  const novo = t
    ? { ...t }
    : { id: null, nome: '', modelo: '', foto: '', kmInicial: 0, alertaKm: 700 };

  folha(t ? 'Editar tênis' : 'Novo tênis', (fechar) => h('div', { class: 'pilha' },
    campo('Nome', entradaTexto(novo.nome, (v) => { novo.nome = v; })),
    campo('Modelo', entradaTexto(novo.modelo || '', (v) => { novo.modelo = v; }),
      'Aparece abaixo do nome, como "Adizero SL"'),
    campo('Arquivo da foto', entradaTexto(novo.foto || '', (v) => { novo.foto = v.trim(); }),
      'O nome do arquivo dentro da pasta fotos, como "adidas-preto.png"'),
    h('div', { class: 'grade-2' },
      campo('Km já rodados', entradaNumero(novo.kmInicial, (v) => { novo.kmInicial = v || 0; }, { step: 1 })),
      campo('Trocar em (km)', entradaNumero(novo.alertaKm, (v) => { novo.alertaKm = v || 700; }, { step: 50 }))),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => {
        if (!novo.nome.trim()) { aviso('Dê um nome ao par.'); return; }
        mudar(() => {
          const lista = (estado.tenis ||= []);
          if (novo.id) Object.assign(lista.find((x) => x.id === novo.id), novo);
          else lista.push({ ...novo, id: uid('tn') });
        });
        fechar(); ctx.recarregar();
      },
    }, 'Salvar'),
    t && h('button', {
      class: 'botao perigo-texto largura-total',
      onclick: async () => {
        if (!await confirmar('Apagar tênis', `Remove "${t.nome}" da lista. As corridas continuam.`, 'Apagar', true)) return;
        mudar(() => { estado.tenis = estado.tenis.filter((x) => x.id !== t.id); });
        fechar(); ctx.recarregar();
      },
    }, 'Apagar este par')));
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
      ? `melhor teste de 5 km: ${tempoDeCorrida(Math.min(...testes.map((t) => t.minutos)))}`
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

// ui/telas/ajustes.js — lista agrupada: rotina, metas, dados e perfil.
// Sem gráfico; cada linha abre uma folha de edição.

import {
  desligar as desligarDemo, ligado as demoLigado, ligar as ligarDemo,
} from '../../nucleo/demo.js';
import {
  codigoNovo, configuracao as configSync, configurada as nuvemConfigurada,
  configurar as configurarSync, desconfigurar as desconfigurarSync, sincronizar,
} from '../../nucleo/nuvem.js';
import { resumoSemana } from '../../nucleo/resumo.js';
import { definirTema, tema as temaAtual } from '../../nucleo/tema.js';
import {
  TOLERANCIAS_PADRAO, estado, mudar, substituirEstado, trajeto, zerar,
} from '../../nucleo/store.js';
import { DIAS, diaLogico, inicioSemana, uid } from '../../nucleo/util.js';
import { baixarJSON, copiar, lerArquivo } from '../arquivos.js';
import { etiqueta, linha } from '../cartao.js';
import { anexar, h } from '../dom.js';
import {
  aviso, campo, confirmar, entradaHora, entradaNumero, entradaTexto, fecharFolha,
  folha, segmentos,
} from '../folha.js';
import { icone } from '../icones.js';
import { aplicarTema } from '../tema.js';

const TIPOS = [
  { id: 'acordar', rotulo: 'Acordar' },
  { id: 'dormir', rotulo: 'Dormir' },
  { id: 'transito', rotulo: 'Deslocamento' },
  { id: 'trabalho', rotulo: 'Trabalho' },
  { id: 'aula', rotulo: 'Aula' },
  { id: 'treino', rotulo: 'Treino' },
  { id: 'corrida', rotulo: 'Corrida' },
];

export function render(tela, ctx) {
  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Ajustes'),
        h('p', { class: 'cabecalho-sub' }, 'Rotina, metas, dados e perfil'))),
    h('div', { class: 'grade' },
      grupo('Rotina', [
        item('Horários da semana', `${estado.rotina.length} atividades`, () => folhaRotina(ctx)),
        item('Trajetos', `${estado.trajetos.length} rotas`, () => folhaTrajetos(ctx)),
      ]),
      grupo('Metas', [
        item('Peso alvo', `${estado.perfil.pesoAlvo ?? '—'} kg`, () => folhaMetas(ctx)),
        item('Calorias por dia', `${estado.perfil.kcalAlvo ?? '—'} kcal`, () => folhaMetas(ctx)),
        item('Tolerâncias', 'Minutos de atraso aceitos', () => folhaTolerancias(ctx)),
      ]),
      grupo('Dados', [
        item('Resumo da semana', 'Texto pronto para copiar', () => mostrarResumo()),
        item('Exportar backup', 'Arquivo JSON com tudo',
          emDemo(() => { const n = baixarJSON(); aviso(`Salvo: ${n}`); })),
        item('Importar backup', 'Substitui os dados deste aparelho', emDemo(() => abrirArquivo(ctx))),
      ]),
      grupo('Sincronização', [
        item('Entre meus aparelhos', textoSync(), () => folhaSync(ctx),
          nuvemConfigurada() ? 'ativo' : null),
      ]),
      grupo('Aparência', [
        item('Tema', ROTULO_TEMA[temaAtual()], () => folhaTema(ctx)),
      ]),
      grupo('Demonstração', [
        item('Modo demonstração', demoLigado() ? 'Ligado · dados de exemplo' : 'Desligado',
          () => alternarDemo(ctx), demoLigado() ? 'ativo' : null),
      ]),
      grupo('Perfil', [
        item('Nome', estado.perfil.nome || '—', () => folhaPerfil(ctx)),
        item('Apagar tudo e recomeçar', 'Volta ao perfil de exemplo', emDemo(async () => {
          if (!await confirmar('Apagar tudo', 'Volta ao perfil de exemplo. Não dá para desfazer.', 'Apagar tudo', true)) return;
          zerar(); aviso('Dados zerados.'); ctx.recarregar();
        }), 'perigo'),
      ]),
      // a licença gratuita do Icons8 pede crédito visível com link
      h('p', { class: 'creditos' },
        'Ícones do menu por ',
        h('a', { href: 'https://icons8.com', target: '_blank', rel: 'noopener' }, 'Icons8'))));
}

/**
 * Envolve uma ação que mexe em dados para ela não rodar durante a demonstração.
 * Exportar geraria um "backup" de dados falsos; apagar e importar destruiriam o
 * que só existe na cópia guardada.
 */
function emDemo(acao) {
  return (...args) => {
    if (demoLigado()) {
      aviso('Indisponível no modo demonstração. Desligue-o primeiro.');
      return undefined;
    }
    return acao(...args);
  };
}

async function alternarDemo(ctx) {
  try {
    if (demoLigado()) {
      desligarDemo();
      aviso('Modo demonstração desligado. Seus dados voltaram.');
    } else {
      const ok = await confirmar(
        'Ligar demonstração',
        'Seus dados ficam guardados e voltam ao desligar. O que você registrar durante a demonstração é descartado.',
        'Ligar', false,
      );
      if (!ok) return;
      ligarDemo();
      aviso('Modo demonstração ligado.');
    }
  } catch (erro) {
    aviso(erro.message);
  }
  ctx.recarregar();
}

function textoSync() {
  if (!nuvemConfigurada()) return 'Desligada';
  const { ultimo, pendente } = configSync();
  if (pendente) return 'Ligada · com envio pendente';
  if (!ultimo) return 'Ligada · ainda não sincronizou';
  const d = new Date(ultimo);
  return `Ligada · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const RESPOSTA = {
  sincronizado: 'Sincronizado.',
  offline: 'Sem conexão agora. Vai subir sozinho depois.',
  desligado: 'Preencha o endereço e o código primeiro.',
};

function folhaSync(ctx) {
  const atual = configSync();
  let url = atual.url;
  let codigo = atual.codigo;

  folha('Sincronização', (fechar) => h('div', { class: 'pilha' },
    h('p', { class: 'texto-suave' },
      'Use o mesmo código nos três aparelhos. Quem tiver o código lê e escreve '
      + 'seus dados, então trate-o como senha.'),
    campo('Endereço do servidor', entradaTexto(url, (v) => { url = v; }),
      'A URL do seu Worker, algo como https://rotina-sync.SEU-NOME.workers.dev'),
    campo('Código', entradaTexto(codigo, (v) => { codigo = v; })),
    h('button', {
      class: 'botao largura-total',
      onclick: (e) => {
        codigo = codigoNovo();
        e.target.closest('.pilha').querySelectorAll('input')[1].value = codigo;
      },
    }, icone('mais'), 'Gerar um código novo'),
    h('button', {
      class: 'botao primario largura-total',
      onclick: async () => {
        configurarSync({ url, codigo });
        const r = await sincronizar();
        aviso(r.mensagem ? `Falhou: ${r.mensagem}` : RESPOSTA[r.estado] || 'Pronto.');
        fechar();
        ctx.recarregar();
      },
    }, 'Salvar e sincronizar agora'),
    nuvemConfigurada() && h('button', {
      class: 'botao perigo-texto largura-total',
      onclick: () => { desconfigurarSync(); aviso('Sincronização desligada.'); fechar(); ctx.recarregar(); },
    }, 'Desligar neste aparelho')));
}

const ROTULO_TEMA = { auto: 'Automático · segue o sistema', claro: 'Claro', escuro: 'Escuro' };

function folhaTema(ctx) {
  folha('Tema', () => h('div', { class: 'pilha' },
    h('p', { class: 'texto-suave' },
      'No escuro o fundo é preto absoluto, não cinza. Automático acompanha o ajuste do aparelho.'),
    segmentos(
      [{ id: 'auto', rotulo: 'Automático' }, { id: 'claro', rotulo: 'Claro' }, { id: 'escuro', rotulo: 'Escuro' }],
      temaAtual(),
      (v) => { definirTema(v); aplicarTema(); fecharFolha(); ctx.recarregar(); },
    )));
}

function grupo(titulo, itens) {
  return h('section', { class: 'grupo' },
    h('h2', { class: 'grupo-titulo' }, titulo),
    h('div', { class: 'grupo-corpo' }, itens));
}

function item(titulo, valor, aoTocar, variante) {
  // 'ativo' é um interruptor já ligado: o check diz o estado melhor que a seta,
  // que promete abrir uma tela e não abre nada.
  return linha(
    [
      h('span', { class: `linha-titulo ${variante === 'perigo' ? 'perigoso' : ''}`.trim() }, titulo),
      valor && h('span', { class: `linha-sub ${variante === 'ativo' ? 'aceso' : ''}`.trim() }, valor),
    ],
    icone(variante === 'ativo' ? 'check' : 'chevronDireita'),
    { aoTocar },
  );
}

/** O input de arquivo precisa existir no documento para o clique valer. */
function abrirArquivo(ctx) {
  const entrada = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'oculto',
    onchange: async (e) => {
      const arquivo = e.target.files?.[0];
      if (arquivo) {
        try {
          const dados = await lerArquivo(arquivo);
          if (await confirmar('Importar backup', 'Isto substitui todos os dados deste dispositivo.', 'Importar', true)) {
            substituirEstado(dados);
            aviso('Backup importado.');
            ctx.recarregar();
          }
        } catch (err) {
          aviso(err.message);
        }
      }
      entrada.remove();
    },
  });
  document.body.append(entrada);
  entrada.click();
}

/* ---------------- folhas ---------------- */

function folhaPerfil(ctx) {
  folha('Perfil', (fechar) => h('div', { class: 'pilha' },
    campo('Nome', entradaTexto(estado.perfil.nome, (v) => mudar(() => { estado.perfil.nome = v; }))),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => { fechar(); ctx.recarregar(); },
    }, 'Pronto')));
}

function folhaMetas(ctx) {
  const p = estado.perfil;
  const set = (campos) => mudar(() => Object.assign(estado.perfil, campos));
  folha('Metas', (fechar) => h('div', { class: 'pilha' },
    h('div', { class: 'grade-2' },
      campo('Peso alvo (kg)', entradaNumero(p.pesoAlvo, (v) => set({ pesoAlvo: v }), { step: 0.5 })),
      campo('Calorias/dia', entradaNumero(p.kcalAlvo, (v) => set({ kcalAlvo: v }), { step: 50 }))),
    h('div', { class: 'grade-2' },
      campo('Ganho mínimo (kg/sem)', entradaNumero(p.ganhoSemanaAlvo?.[0],
        (v) => set({ ganhoSemanaAlvo: [v, p.ganhoSemanaAlvo?.[1] ?? 0.35] }), { step: 0.05 })),
      campo('Ganho máximo (kg/sem)', entradaNumero(p.ganhoSemanaAlvo?.[1],
        (v) => set({ ganhoSemanaAlvo: [p.ganhoSemanaAlvo?.[0] ?? 0.2, v] }), { step: 0.05 }))),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => { fechar(); ctx.recarregar(); },
    }, 'Pronto')));
}

function folhaTolerancias(ctx) {
  const t = estado.perfil.tolerancias || {};
  const linhas = [
    ['transito', 'Saída / deslocamento'],
    ['acordar', 'Acordar'],
    ['treino', 'Treino'],
    ['dormir', 'Dormir'],
  ];
  const set = (tipo, campo2, v) => mudar(() => {
    estado.perfil.tolerancias[tipo] = { ...TOLERANCIAS_PADRAO[tipo], ...t[tipo], [campo2]: v ?? 0 };
  });
  folha('Tolerâncias', (fechar) => h('div', { class: 'pilha' },
    h('p', { class: 'texto-suave' },
      'Minutos de atraso. Até o verde está no alvo; até o amarelo ainda conta como cumprido.'),
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-sub' }, 'Atividade'),
        [h('span', { class: 'linha-sub tol-col' }, 'verde'), h('span', { class: 'linha-sub tol-col' }, 'amarelo')]),
      linhas.map(([tipo, rotulo]) => linha(
        h('span', { class: 'linha-titulo' }, rotulo),
        [
          entradaNumero(t[tipo]?.verde ?? TOLERANCIAS_PADRAO[tipo].verde,
            (v) => set(tipo, 'verde', v), { step: 1, min: 0, class: 'mini tol-col' }),
          entradaNumero(t[tipo]?.amarelo ?? TOLERANCIAS_PADRAO[tipo].amarelo,
            (v) => set(tipo, 'amarelo', v), { step: 1, min: 0, class: 'mini tol-col' }),
        ],
      ))),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => { fechar(); ctx.recarregar(); },
    }, 'Pronto')));
}

function folhaRotina(ctx) {
  const porHora = [...estado.rotina].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  folha('Horários da semana', () => h('div', { class: 'pilha' },
    h('div', { class: 'lista' }, porHora.map((it) => linha(
      [
        h('span', { class: 'linha-titulo' }, it.titulo),
        h('span', { class: 'linha-sub' }, (it.diasSemana || []).map((d) => DIAS[d]).join(' ')),
      ],
      [etiqueta(it.inicio), icone('chevronDireita')],
      { aoTocar: () => editarRotina(it, ctx) },
    ))),
    h('button', {
      class: 'botao largura-total',
      onclick: () => editarRotina({
        id: null, tipo: 'trabalho', titulo: '', diasSemana: [1, 2, 3, 4, 5], inicio: '08:00', fim: '09:00', local: '',
      }, ctx),
    }, icone('mais'), 'Adicionar atividade')));
}

function folhaTrajetos(ctx) {
  folha('Trajetos', () => h('div', { class: 'pilha' },
    h('div', { class: 'lista' }, estado.trajetos.map((t) => linha(
      [
        h('span', { class: 'linha-titulo' }, `${t.origem} → ${t.destino}`),
        h('span', { class: 'linha-sub' }, `estimado ${t.minutosEstimados} min`),
      ],
      icone('chevronDireita'),
      { aoTocar: () => editarTrajeto(t, ctx) },
    ))),
    h('button', {
      class: 'botao largura-total',
      onclick: () => editarTrajeto({ id: null, origem: '', destino: '', minutosEstimados: 20, wazeUrl: '' }, ctx),
    }, icone('mais'), 'Adicionar trajeto')));
}


/* ---------------- editores ---------------- */

function editarRotina(item, ctx) {
  const novo = { ...item };
  folha(item.id ? 'Editar atividade' : 'Nova atividade', (fechar) => {
    const corpo = h('div', { class: 'pilha' });

    const seletorTipo = h('select', {
      onchange: (e) => { novo.tipo = e.target.value; redesenhar(); },
    }, TIPOS.map((t) => h('option', { value: t.id, selected: t.id === novo.tipo }, t.rotulo)));

    const dias = h('div', { class: 'dias' }, DIAS.map((d, i) => h('button', {
      class: `dia ${novo.diasSemana?.includes(i) ? 'ativo' : ''}`,
      onclick: (e) => {
        novo.diasSemana = novo.diasSemana?.includes(i)
          ? novo.diasSemana.filter((x) => x !== i)
          : [...(novo.diasSemana || []), i].sort();
        e.target.classList.toggle('ativo');
      },
    }, d)));

    function redesenhar() {
      corpo.replaceChildren(
        campo('Tipo', seletorTipo),
        campo('Título', entradaTexto(novo.titulo, (v) => { novo.titulo = v; })),
        campo('Dias da semana', dias),
        h('div', { class: 'grade-2' },
          campo('Início', entradaHora(novo.inicio, (v) => { novo.inicio = v; })),
          novo.tipo !== 'acordar' && novo.tipo !== 'dormir'
            ? campo('Fim', entradaHora(novo.fim, (v) => { novo.fim = v; }))
            : h('div')),
        novo.tipo === 'transito' && campo('Trajeto', h('select', {
          onchange: (e) => { novo.trajetoId = e.target.value || null; },
        }, h('option', { value: '' }, '—'),
          estado.trajetos.map((t) => h('option', { value: t.id, selected: t.id === novo.trajetoId }, `${t.origem} → ${t.destino}`)))),
        campo('Local', entradaTexto(novo.local, (v) => { novo.local = v; })),
        h('button', {
          class: 'botao primario',
          onclick: () => {
            if (!novo.titulo.trim()) { aviso('Dê um título à atividade.'); return; }
            if (novo.tipo === 'acordar' || novo.tipo === 'dormir') novo.fim = null;
            mudar(() => {
              if (item.id) Object.assign(estado.rotina.find((x) => x.id === item.id), novo);
              else estado.rotina.push({ ...novo, id: uid('rt') });
            });
            fechar(); ctx.recarregar();
          },
        }, 'Salvar'),
        item.id && h('button', {
          class: 'botao perigo-texto',
          onclick: async () => {
            if (!await confirmar('Apagar atividade', `“${item.titulo}” sai da rotina. Os registros antigos ficam.`, 'Apagar', true)) return;
            mudar(() => { estado.rotina = estado.rotina.filter((x) => x.id !== item.id); });
            fechar(); ctx.recarregar();
          },
        }, 'Apagar atividade'));
    }
    redesenhar();
    return corpo;
  });
}

function editarTrajeto(t, ctx) {
  const novo = { ...t };
  folha(t.id ? 'Editar trajeto' : 'Novo trajeto', (fechar) => h('div', { class: 'pilha' },
    campo('Origem', entradaTexto(novo.origem, (v) => { novo.origem = v; })),
    campo('Destino', entradaTexto(novo.destino, (v) => { novo.destino = v; })),
    campo('Minutos estimados', entradaNumero(novo.minutosEstimados, (v) => { novo.minutosEstimados = v ?? 0; }, { step: 1 })),
    campo('Link do Waze', entradaTexto(novo.wazeUrl, (v) => { novo.wazeUrl = v; }), 'Opcional — abre a navegação direto no destino.'),
    h('button', {
      class: 'botao primario',
      onclick: () => {
        if (!novo.origem.trim() || !novo.destino.trim()) { aviso('Preencha origem e destino.'); return; }
        mudar(() => {
          if (t.id) Object.assign(trajeto(t.id), novo);
          else estado.trajetos.push({ ...novo, id: uid('tj') });
        });
        fechar(); ctx.recarregar();
      },
    }, 'Salvar'),
    t.id && h('button', {
      class: 'botao perigo-texto',
      onclick: async () => {
        if (!await confirmar('Apagar trajeto', 'As atividades que usam este trajeto ficam sem referência.', 'Apagar', true)) return;
        mudar(() => { estado.trajetos = estado.trajetos.filter((x) => x.id !== t.id); });
        fechar(); ctx.recarregar();
      },
    }, 'Apagar trajeto')));
}


function mostrarResumo() {
  const texto = resumoSemana(inicioSemana(diaLogico()));
  folha('Resumo da semana', () => h('div', { class: 'pilha' },
    h('pre', { class: 'resumo' }, texto),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => copiar(texto).then(() => aviso('Copiado.')),
    }, icone('copiar'), 'Copiar')));
}
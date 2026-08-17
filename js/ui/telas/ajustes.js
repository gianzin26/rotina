// ui/telas/ajustes.js — editores de rotina, trajetos, sessões, tolerâncias e backup.

import { resumoSemana } from '../../nucleo/resumo.js';
import {
  TOLERANCIAS_PADRAO, estado, mudar, sessao, substituirEstado, trajeto, zerar,
} from '../../nucleo/store.js';
import { DIAS, diaLogico, inicioSemana, uid } from '../../nucleo/util.js';
import { baixarJSON, copiar, lerArquivo } from '../arquivos.js';
import { cartao, etiqueta, linha } from '../cartao.js';
import { anexar, h, vazio } from '../dom.js';
import {
  aviso, campo, confirmar, entradaHora, entradaNumero, entradaTexto, folha,
} from '../folha.js';
import { icone } from '../icones.js';

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
        h('p', { class: 'cabecalho-sub' }, 'Rotina, trajetos, sessões e backup'))),
    h('div', { class: 'grade' },
      cartaoPerfil(),
      cartaoTolerancias(),
      cartaoRotina(ctx),
      cartaoTrajetos(ctx),
      cartaoSessoes(ctx),
      cartaoDados(ctx),
      cartaoSobre()));
}

/* ---------------- perfil ---------------- */

function cartaoPerfil() {
  const p = estado.perfil;
  const set = (campos) => mudar(() => Object.assign(estado.perfil, campos));
  return cartao({ titulo: 'Perfil e metas', subtitulo: 'Alvo de peso e calorias' },
    campo('Nome', entradaTexto(p.nome, (v) => set({ nome: v }))),
    h('div', { class: 'grade-2' },
      campo('Peso alvo (kg)', entradaNumero(p.pesoAlvo, (v) => set({ pesoAlvo: v }), { step: 0.5 })),
      campo('Calorias/dia', entradaNumero(p.kcalAlvo, (v) => set({ kcalAlvo: v }), { step: 50 }))),
    h('div', { class: 'grade-2' },
      campo('Ganho mínimo (kg/sem)', entradaNumero(p.ganhoSemanaAlvo?.[0], (v) => set({ ganhoSemanaAlvo: [v, p.ganhoSemanaAlvo?.[1] ?? 0.35] }), { step: 0.05 })),
      campo('Ganho máximo (kg/sem)', entradaNumero(p.ganhoSemanaAlvo?.[1], (v) => set({ ganhoSemanaAlvo: [p.ganhoSemanaAlvo?.[0] ?? 0.2, v] }), { step: 0.05 }))));
}

/* ---------------- tolerâncias ---------------- */

function cartaoTolerancias() {
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

  return cartao({
    titulo: 'Tolerância',
    subtitulo: 'Minutos de atraso aceitos por atividade',
  },
    h('p', { class: 'texto-suave' },
      'Até o verde está no alvo. Até o amarelo ainda conta como cumprido — serve para revelar deriva.'),
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-sub' }, 'Atividade'),
        [h('span', { class: 'linha-sub tol-col' }, 'verde'), h('span', { class: 'linha-sub tol-col' }, 'amarelo')]),
      linhas.map(([tipo, rotulo]) => linha(
        h('span', { class: 'linha-titulo' }, rotulo),
        [
          entradaNumero(t[tipo]?.verde ?? TOLERANCIAS_PADRAO[tipo].verde, (v) => set(tipo, 'verde', v), { step: 1, min: 0, class: 'mini tol-col' }),
          entradaNumero(t[tipo]?.amarelo ?? TOLERANCIAS_PADRAO[tipo].amarelo, (v) => set(tipo, 'amarelo', v), { step: 1, min: 0, class: 'mini tol-col' }),
        ],
      ))));
}

/* ---------------- rotina ---------------- */

function cartaoRotina(ctx) {
  const porDia = [...estado.rotina].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  return cartao({
    titulo: 'Rotina',
    subtitulo: 'Atividades recorrentes da semana',
    periodo: `${porDia.length} itens`,
    largo: true,
  },
    h('div', { class: 'lista' }, porDia.map((it) => linha(
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
    }, icone('mais'), 'Adicionar atividade'));
}

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
        novo.tipo === 'treino' && campo('Sessão', h('select', {
          onchange: (e) => { novo.sessaoId = e.target.value || null; },
        }, h('option', { value: '' }, '—'),
          estado.sessoesTreino.map((s) => h('option', { value: s.id, selected: s.id === novo.sessaoId }, s.nome)))),
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

/* ---------------- trajetos ---------------- */

function cartaoTrajetos(ctx) {
  return cartao({
    titulo: 'Trajetos',
    subtitulo: 'Origem, destino e tempo estimado',
    periodo: `${estado.trajetos.length} rotas`,
  },
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
    }, icone('mais'), 'Adicionar trajeto'));
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

/* ---------------- sessões de treino ---------------- */

function cartaoSessoes(ctx) {
  return cartao({
    titulo: 'Sessões de treino',
    subtitulo: 'Exercícios de cada sessão',
    periodo: `${estado.sessoesTreino.length} sessões`,
  },
    h('div', { class: 'lista' }, estado.sessoesTreino.map((s) => linha(
      [
        h('span', { class: 'linha-titulo' }, s.nome),
        h('span', { class: 'linha-sub' }, `${s.exercicios.length} exercícios`),
      ],
      icone('chevronDireita'),
      { aoTocar: () => editarSessao(s, ctx) },
    ))),
    h('button', {
      class: 'botao largura-total',
      onclick: () => editarSessao({ id: null, nome: '', exercicios: [] }, ctx),
    }, icone('mais'), 'Adicionar sessão'));
}

function editarSessao(s, ctx) {
  const novo = { ...s, exercicios: s.exercicios.map((e) => ({ ...e })) };
  folha(s.id ? 'Editar sessão' : 'Nova sessão', (fechar) => {
    const corpo = h('div', { class: 'pilha' });

    function redesenhar() {
      corpo.replaceChildren(
        campo('Nome da sessão', entradaTexto(novo.nome, (v) => { novo.nome = v; })),
        h('h3', { class: 'sub' }, 'Exercícios'),
        novo.exercicios.length ? h('div', { class: 'pilha-fina' }, novo.exercicios.map((e, i) => h('div', { class: 'ex-editor' },
          entradaTexto(e.nome, (v) => { e.nome = v; }, { placeholder: 'Nome do exercício' }),
          h('div', { class: 'grade-3' },
            campo('Séries', entradaNumero(e.series, (v) => { e.series = v; }, { step: 1, class: 'mini' })),
            campo('Reps', entradaNumero(e.repsAlvo, (v) => { e.repsAlvo = v; }, { step: 1, class: 'mini' })),
            campo('Carga inicial', entradaNumero(e.cargaInicial, (v) => { e.cargaInicial = v; }, { step: 2.5, class: 'mini' }))),
          h('button', {
            class: 'botao perigo-texto mini-botao',
            onclick: () => { novo.exercicios.splice(i, 1); redesenhar(); },
          }, 'Remover')))) : vazio('Nenhum exercício.'),
        h('button', {
          class: 'botao',
          onclick: () => { novo.exercicios.push({ nome: '', series: 3, repsAlvo: 10, cargaInicial: null }); redesenhar(); },
        }, 'Adicionar exercício'),
        h('button', {
          class: 'botao primario',
          onclick: () => {
            if (!novo.nome.trim()) { aviso('Dê um nome à sessão.'); return; }
            novo.exercicios = novo.exercicios.filter((e) => e.nome.trim());
            mudar(() => {
              if (s.id) Object.assign(sessao(s.id), novo);
              else estado.sessoesTreino.push({ ...novo, id: uid('ss') });
            });
            fechar(); ctx.recarregar();
          },
        }, 'Salvar sessão'),
        s.id && h('button', {
          class: 'botao perigo-texto',
          onclick: async () => {
            if (!await confirmar('Apagar sessão', 'O histórico de treinos continua guardado.', 'Apagar', true)) return;
            mudar(() => { estado.sessoesTreino = estado.sessoesTreino.filter((x) => x.id !== s.id); });
            fechar(); ctx.recarregar();
          },
        }, 'Apagar sessão'));
    }
    redesenhar();
    return corpo;
  });
}

/* ---------------- dados ---------------- */

function cartaoDados(ctx) {
  const entrada = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'oculto',
    onchange: async (e) => {
      const arquivo = e.target.files?.[0];
      if (!arquivo) return;
      try {
        const dados = await lerArquivo(arquivo);
        if (!await confirmar('Importar backup', 'Isto substitui todos os dados deste dispositivo.', 'Importar', true)) return;
        substituirEstado(dados);
        aviso('Backup importado.');
        ctx.recarregar();
      } catch (err) {
        aviso(err.message);
      } finally {
        e.target.value = '';
      }
    },
  });

  return cartao({ titulo: 'Dados', subtitulo: 'Resumo semanal e backup' },
    h('button', { class: 'botao primario largura-total', onclick: () => mostrarResumo() },
      icone('copiar'), 'Resumo da semana'),
    h('button', {
      class: 'botao largura-total',
      onclick: () => { const n = baixarJSON(); aviso(`Salvo: ${n}`); },
    }, icone('baixar'), 'Exportar backup (JSON)'),
    h('button', { class: 'botao largura-total', onclick: () => entrada.click() },
      icone('subir'), 'Importar backup'),
    entrada,
    h('p', { class: 'texto-suave' },
      'Os dados ficam só neste navegador. Para levar para outro aparelho, exporte e importe o JSON.'),
    h('button', {
      class: 'botao perigo-texto largura-total',
      onclick: async () => {
        if (!await confirmar('Apagar tudo', 'Volta ao perfil de exemplo. Não dá para desfazer.', 'Apagar tudo', true)) return;
        zerar(); aviso('Dados zerados.'); ctx.recarregar();
      },
    }, icone('lixeira'), 'Apagar tudo e recomeçar'));
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

function cartaoSobre() {
  return cartao({ titulo: 'Sobre', subtitulo: 'Funciona offline, na tela de início' },
    h('p', { class: 'texto-suave' },
      'Adicione à tela de início pelo menu de compartilhamento do Safari para usar sem conexão.'),
    h('div', { class: 'lista' },
      linha(h('span', { class: 'linha-titulo' }, 'Atividades na rotina'), etiqueta(String(estado.rotina.length))),
      linha(h('span', { class: 'linha-titulo' }, 'Trajetos'), etiqueta(String(estado.trajetos.length))),
      linha(h('span', { class: 'linha-titulo' }, 'Sessões de treino'), etiqueta(String(estado.sessoesTreino.length))),
      linha(h('span', { class: 'linha-titulo' }, 'Pesagens registradas'), etiqueta(String(estado.registros.peso.length)))));
}

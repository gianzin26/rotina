// ui/telas/dinheiro.js — o mês em finanças: o que chega, o que sai, o que sobra.

import {
  CATEGORIAS, balanco, config, configurado, diasClassificados, mesAnterior,
  mesAtual, mesDe, mesSeguinte, mesesComMovimento, ritmo,
} from '../../nucleo/dinheiro.js';
import { estado, mudar, reg } from '../../nucleo/store.js';
import { dataCurta, diaLogico, uid } from '../../nucleo/util.js';
import { cartao, etiqueta, linha, metricas } from '../cartao.js';
import { anexar, classeSituacao, h, variaveis } from '../dom.js';
import {
  aviso, campo, confirmar, entradaNumero, entradaTexto, fecharFolha, folha, segmentos,
} from '../folha.js';
import { icone } from '../icones.js';

/* Qual mês a tela está mostrando. Fora do estado salvo de propósito: é onde o
   olho está agora, não um dado da vida financeira. */
let mesEscolhido = null;

const reais = (v) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(v || 0);

const reaisExato = (v) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
}).format(v || 0);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesPorExtenso(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export function render(tela, ctx) {
  const mes = mesEscolhido || mesAtual();
  const b = balanco(mes);

  anexar(tela,
    h('header', { class: 'cabecalho' },
      h('div', {},
        h('h1', {}, 'Finanças'),
        h('p', { class: 'cabecalho-sub' }, mesPorExtenso(mes))),
      h('div', { class: 'cabecalho-acoes' },
        h('button', { class: 'botao primario', onclick: () => folhaGasto(null, ctx) },
          icone('mais'), 'Gasto'))),
    h('div', { class: 'grade' },
      configurado() ? cartaoSobra(b, mes, ctx) : cartaoPrimeiroUso(ctx),
      cartaoReceita(b, ctx),
      cartaoCategorias(b, ctx),
      cartaoDias(mes, ctx),
      cartaoLancamentos(b, ctx)));
}

/* Antes de saber salário e data de admissão o app não tem como fechar mês
   nenhum. Melhor pedir os dois do que preencher a tela com um chute. */
function cartaoPrimeiroUso(ctx) {
  return cartao({ titulo: 'Falta combinar o básico' },
    h('p', { class: 'texto-suave' },
      'Informe seu salário e o primeiro dia de trabalho. Sem isso o app não '
      + 'sabe o que você já ganhou nem quando o dinheiro cai.'),
    h('button', { class: 'botao primario largura-total', onclick: () => folhaConfig(ctx) },
      icone('lapis'), 'Configurar'));
}

/* ---------------- a pergunta principal ---------------- */

function cartaoSobra(b, mes, ctx) {
  const r = ritmo(mes, diaLogico());
  /* Mês sem receita não tem orçamento: barra e teto de gasto não querem dizer
     nada, e uma barra cheia diria justamente o contrário do que está havendo. */
  const semReceita = b.receita.total === 0;
  const fracao = b.disponivel > 0
    ? Math.max(0, Math.min(1, b.gastos.total / b.disponivel))
    : 1;
  const estourou = b.restante < 0;

  return cartao({
    titulo: 'Sobra do mês',
    periodo: { rotulo: mesPorExtenso(mes), aoTrocar: () => folhaMes(ctx) },
    metrica: reais(b.sobra),
    legenda: semReceita
      ? (b.emCurso.total > 0 && b.pagamentoEmCurso
        ? `Nada caiu neste mês · o primeiro pagamento é ${dataCurta(b.pagamentoEmCurso)}`
        : 'Nada caiu neste mês')
      : estourou
        ? `${reais(-b.restante)} acima da meta de ${reais(b.meta)}`
        : `meta de ${reais(b.meta)} · ainda pode gastar ${reais(b.restante)}`,
    legendaSituacao: b.situacao,
  },
  semReceita ? null
    : variaveis(h('div', { class: 'barra-gasto' },
      h('div', { class: `barra-gasto-cheia ${classeSituacao(b.situacao)}` })), { fracao }),
  h('p', { class: 'texto-suave barra-gasto-nota' },
    semReceita
      ? `${reais(b.gastos.total)} gastos, sem nenhuma receita neste mês`
      : `${reais(b.gastos.total)} gastos de ${reais(b.disponivel)} disponíveis`),
  metricas(
    { rotulo: 'Entra', valor: reais(b.receita.total) },
    { rotulo: 'Sai', valor: reais(b.gastos.total) },
    {
      // com sinal sempre: sem ele, estar R$ 1.164 abaixo do esperado se lê
      // igualzinho a estar R$ 1.164 acima
      rotulo: 'Ritmo',
      valor: r.semTeto ? '—' : `${r.adiantado > 0 ? '+' : '−'}${reais(Math.abs(r.adiantado))}`,
      nota: r.semTeto ? 'sem salário no mês'
        : r.adiantado > 0 ? 'acima do esperado' : 'abaixo do esperado',
    },
    { rotulo: 'Dia do mês', valor: String(r.diaDoMes), nota: `de ${r.diasNoMes}` },
  ));
}

/* ---------------- de onde vem ---------------- */

function cartaoReceita(b, ctx) {
  const rec = b.receita;
  const curso = b.emCurso;
  const inicio = config().inicioTrabalho;

  /* Mês sem nada a receber precisa dizer POR QUE, senão o zero parece defeito
     do app. E precisa mostrar o que já está sendo acumulado, que é a única
     notícia boa que existe no primeiro mês. */
  const nada = rec.total === 0;
  const comecouNesteMes = inicio && mesDe(inicio) === b.mes;

  return cartao({
    titulo: 'O que entra',
    subtitulo: nada
      ? `Nada cai em ${mesPorExtenso(b.mes)}`
      : `Trabalhado em ${mesPorExtenso(rec.mes)}`,
    periodo: nada || !b.pagamento ? null : `cai ${dataCurta(b.pagamento)}`,
    metrica: reais(rec.total),
    legenda: nada
      ? (inicio
        ? `Você começou em ${dataCurta(inicio)}, então não há mês anterior a receber`
        : 'Informe o primeiro dia de trabalho')
      : `${reais(rec.base)} de base mais ${rec.diasNoEscritorio} dias de vale`,
  },
  nada ? null : metricas(
    {
      rotulo: 'Base',
      valor: reais(rec.base),
      nota: rec.parcial ? `proporcional a ${rec.diasEmpregado} de 30 dias` : null,
    },
    { rotulo: 'Vales', valor: reais(rec.vales), nota: `${reais(rec.porDia)} por dia` },
    { rotulo: 'No escritório', valor: String(rec.diasNoEscritorio), nota: 'dias com vale' },
    { rotulo: 'Em casa', valor: String(rec.diasEmCasa), nota: rec.diasEmCasa ? 'sem vale' : null },
  ),

  // o que está sendo trabalhado agora e só vira dinheiro no mês que vem
  curso.total > 0 && b.pagamentoEmCurso
    ? h('div', { class: 'em-curso' },
      h('div', { class: 'em-curso-topo' },
        h('span', { class: 'em-curso-rotulo' },
          `Já trabalhado em ${mesPorExtenso(b.mes).replace(/ de \d+$/, '')}`),
        h('span', { class: 'em-curso-valor' }, reais(curso.total))),
      h('span', { class: 'em-curso-nota' },
        `cai ${dataCurta(b.pagamentoEmCurso)} · ${curso.diasNoEscritorio} dias no escritório`
        + (curso.parcial && comecouNesteMes ? `, base proporcional a ${curso.diasEmpregado} dias` : '')))
    : null,

  h('button', { class: 'botao largura-total', onclick: () => folhaConfig(ctx) },
    icone('lapis'), 'Ajustar salário e meta'));
}

/* ---------------- para onde vai ---------------- */

function cartaoCategorias(b, ctx) {
  const maior = Math.max(1, ...b.gastos.porCategoria.map((c) => c.total));
  const quantos = b.gastos.lista.length;

  return cartao({
    titulo: 'Para onde vai',
    periodo: `${quantos} ${quantos === 1 ? 'lançamento' : 'lançamentos'}`,
  },
  h('div', { class: 'categorias' }, b.gastos.porCategoria.map((c) => h('button', {
    class: 'categoria',
    onclick: () => folhaGasto({ categoria: c.id }, ctx),
  },
  h('div', { class: 'categoria-topo' },
    h('span', { class: 'categoria-nome' }, c.nome),
    h('span', { class: 'categoria-valor' }, reais(c.total))),
  variaveis(h('div', { class: 'categoria-trilho' },
    h('div', { class: 'categoria-barra' })), { fracao: c.total / maior }),
  h('span', { class: 'categoria-nota' },
    c.quantos ? `${c.quantos} ${c.quantos === 1 ? 'lançamento' : 'lançamentos'}` : 'nada ainda')))));
}

/* ---------------- os dias ---------------- */

function cartaoDias(mes, ctx) {
  const dias = diasClassificados(mes);
  // dia anterior à admissão não é dia útil dele: contá-lo inflaria o mês
  const uteis = dias.filter((d) => d.tipo !== 'fimDeSemana' && d.tipo !== 'antes');
  const feriados = dias.filter((d) => d.tipo === 'feriado');
  const noEscritorio = dias.filter((d) => d.tipo === 'escritorio').length;
  const antes = dias.filter((d) => d.tipo === 'antes').length;

  return cartao({
    titulo: 'Dias do mês',
    subtitulo: `Pagos em ${mesPorExtenso(mesSeguinte(mes)).replace(' de ', '/')}`,
    periodo: `${noEscritorio} no escritório`,
  },
  h('div', { class: 'dias-grade' },
    // cabeçalho e recuo: sem eles as colunas não querem dizer nada, e o mês
    // deixa de parecer um calendário
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((letra, i) =>
      h('span', { class: 'dia-titulo', 'aria-hidden': 'true', key: i }, letra)),
    Array.from({ length: new Date(`${dias[0].data}T12:00`).getDay() },
      (_, i) => h('span', { class: 'dia-vago', key: `v${i}` })),
    dias.map((d) => {
      const clicavel = d.tipo === 'casa' || d.tipo === 'escritorio';
      return h(clicavel ? 'button' : 'div', {
        class: `dia-caixa dia-${d.tipo}`,
        title: d.feriado ? d.feriado.nome : null,
        'aria-label': d.feriado ? `${dataCurta(d.data)}: ${d.feriado.nome}` : null,
        onclick: clicavel ? () => { alternarCasa(d.data); ctx.recarregar(); } : null,
      }, String(Number(d.data.slice(8))));
    })),
  h('div', { class: 'legenda-dias' },
    h('span', {}, h('i', { class: 'ponto dia-escritorio' }), 'escritório'),
    h('span', {}, h('i', { class: 'ponto dia-casa' }), 'casa'),
    h('span', {}, h('i', { class: 'ponto dia-feriado' }), 'feriado')),
  feriados.length
    ? h('div', { class: 'lista' }, feriados.map((f) => linha(
      [
        h('span', { class: 'linha-titulo' }, f.feriado.nome),
        h('span', { class: 'linha-sub' }, dataCurta(f.data)),
      ],
      f.feriado.facultativo ? etiqueta('facultativo') : null,
    )))
    : null,
  h('p', { class: 'texto-suave' },
    (antes ? `${antes} dias antes da admissão · ` : '')
    + `${uteis.length} dias úteis · ${feriados.length} feriados`
    + (uteis.length ? ' · toque num dia para marcar home office' : '')));
}

function alternarCasa(dataISO) {
  mudar(() => {
    const lista = reg('homeOffice');
    const i = lista.findIndex((x) => x.data === dataISO);
    if (i >= 0) lista.splice(i, 1);
    else {
      lista.push({ data: dataISO });
      lista.sort((a, b) => a.data.localeCompare(b.data));
    }
  });
}

/* ---------------- o extrato ---------------- */

const nomeDaCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nome || 'Outros';

function cartaoLancamentos(b, ctx) {
  if (!b.gastos.lista.length) {
    return cartao({ titulo: 'Lançamentos' },
      h('p', { class: 'texto-suave' }, 'Nenhum gasto neste mês.'));
  }

  return cartao({ titulo: 'Lançamentos', periodo: reais(b.gastos.total) },
    h('div', { class: 'lista' }, b.gastos.lista.map((g) => linha(
      [
        // sem descricao o titulo ja e a categoria: repeti-la embaixo so ocupa
        // a linha duas vezes com a mesma palavra
        h('span', { class: 'linha-titulo' }, g.nota || nomeDaCategoria(g.categoria)),
        h('span', { class: 'linha-sub' }, g.nota
          ? `${dataCurta(g.data)} · ${nomeDaCategoria(g.categoria)}`
          : dataCurta(g.data)),
      ],
      h('span', { class: 'linha-valor' }, reaisExato(g.valor)),
      { aoTocar: () => folhaGasto(g, ctx) },
    ))));
}

/* ---------------- folhas ---------------- */

function folhaGasto(base, ctx) {
  const existente = base?.id ? base : null;
  const novo = {
    id: existente?.id || null,
    data: existente?.data || diaLogico(),
    categoria: existente?.categoria || base?.categoria || CATEGORIAS[0].id,
    valor: existente?.valor ?? null,
    nota: existente?.nota || '',
  };

  folha(existente ? 'Editar gasto' : 'Novo gasto', (fechar) => h('div', { class: 'pilha' },
    campo('Valor', entradaNumero(novo.valor, (v) => { novo.valor = v; }, { step: 1, min: 0 })),
    campo('Categoria', segmentos(
      CATEGORIAS.map((c) => ({ id: c.id, rotulo: c.nome })),
      novo.categoria,
      (v) => { novo.categoria = v; },
    )),
    campo('Data', h('input', {
      type: 'date',
      value: novo.data,
      onchange: (e) => { novo.data = e.target.value; },
    })),
    campo('Descrição', entradaTexto(novo.nota, (v) => { novo.nota = v; }), 'Opcional'),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => {
        if (!(novo.valor > 0)) { aviso('Informe um valor maior que zero.'); return; }
        mudar(() => {
          const lista = reg('gasto');
          if (novo.id) Object.assign(lista.find((x) => x.id === novo.id), novo);
          else lista.push({ ...novo, id: uid('gs') });
        });
        // a tela segue o lançamento: salvar num outro mês não pode fazê-lo sumir
        mesEscolhido = mesDe(novo.data);
        fechar();
        ctx.recarregar();
      },
    }, 'Salvar'),
    existente && h('button', {
      class: 'botao perigo-texto largura-total',
      onclick: async () => {
        if (!await confirmar('Apagar gasto', 'Remove este lançamento.', 'Apagar', true)) return;
        mudar(() => { estado.registros.gasto = reg('gasto').filter((x) => x.id !== existente.id); });
        fechar();
        ctx.recarregar();
      },
    }, 'Apagar')));
}

function folhaMes(ctx) {
  const atual = mesEscolhido || mesAtual();
  // os últimos seis meses sempre aparecem, mesmo sem nenhum lançamento
  const recentes = [];
  let m = mesAtual();
  for (let i = 0; i < 6; i++) { recentes.push(m); m = mesAnterior(m); }
  const lista = [...new Set([...mesesComMovimento(), ...recentes])]
    .sort((a, b) => b.localeCompare(a));

  folha('Mês', () => h('div', { class: 'pilha' },
    h('div', { class: 'lista' }, lista.map((mes) => linha(
      [h('span', { class: 'linha-titulo' }, mesPorExtenso(mes))],
      mes === atual ? icone('check') : null,
      { aoTocar: () => { mesEscolhido = mes; fecharFolha(); ctx.recarregar(); } },
    )))));
}

function folhaConfig(ctx) {
  const novo = { ...config() };

  folha('Salário e meta', (fechar) => h('div', { class: 'pilha' },
    campo('Salário base', entradaNumero(novo.salarioBase, (v) => { novo.salarioBase = v || 0; }, { step: 100 })),
    h('div', { class: 'grade-2' },
      campo('Refeição por dia', entradaNumero(novo.valeRefeicao, (v) => { novo.valeRefeicao = v || 0; }, { step: 5 })),
      campo('Transporte por dia', entradaNumero(novo.valeTransporte, (v) => { novo.valeTransporte = v || 0; }, { step: 5 }))),
    campo('Meta de sobra', entradaNumero(novo.metaSobra, (v) => { novo.metaSobra = v || 0; }, { step: 100 }),
      'Quanto você quer que sobre todo mês'),
    campo('Primeiro dia de trabalho', h('input', {
      type: 'date',
      value: novo.inicioTrabalho || '',
      onchange: (e) => { novo.inicioTrabalho = e.target.value || null; },
    }), 'Antes desta data nada é contado como trabalhado'),
    h('button', {
      class: 'botao primario largura-total',
      onclick: () => {
        if (!(novo.salarioBase > 0)) { aviso('Informe o salário base.'); return; }
        if (!novo.inicioTrabalho) { aviso('Informe o primeiro dia de trabalho.'); return; }
        mudar(() => { estado.perfil.financeiro = novo; });
        fechar();
        ctx.recarregar();
      },
    }, 'Salvar')));
}

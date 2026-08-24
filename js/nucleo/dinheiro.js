// nucleo/dinheiro.js — quanto entra, quanto sai, quanto sobra.
//
// O mês tem duas faces: o dinheiro que CHEGA nele foi ganho no mês anterior,
// porque o pagamento do quinto dia útil se refere aos dias já trabalhados.
// Por isso `receitaQueChega` e `receitaGanhaEm` são funções diferentes —
// confundir as duas erra o mês inteiro.

import { mapaDeFeriados } from './feriados.js';
import { estado, reg } from './store.js';

export const CATEGORIAS = [
  { id: 'namorada', nome: 'Namorada' },
  { id: 'almoco', nome: 'Almoço de trabalho' },
  { id: 'lanches', nome: 'Lanches' },
  { id: 'pessoais', nome: 'Pessoais' },
];

const PADRAO = {
  salarioBase: 5000,
  valeRefeicao: 40,
  valeTransporte: 25,
  metaSobra: 4000,
  // carnaval e corpus christi são facultativos: contam como dia parado
  facultativoNaoTrabalha: true,
};

export const config = () => ({ ...PADRAO, ...(estado.perfil.financeiro || {}) });

const dd = (n) => String(n).padStart(2, '0');
export const mesDe = (dataISO) => dataISO.slice(0, 7);
export const mesAtual = (d = new Date()) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}`;

/** '2026-08' → '2026-07'. */
export function mesAnterior(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${dd(mes - 1)}`;
}

/** O mês em que estes dias trabalhados viram dinheiro na conta. */
export function mesSeguinte(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${dd(mes + 1)}`;
}

/** Todos os dias do mês, em ISO. */
export function diasDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const quantos = new Date(ano, mes, 0).getDate();
  return Array.from({ length: quantos }, (_, i) => `${anoMes}-${dd(i + 1)}`);
}

const ehFimDeSemana = (dataISO) => {
  const d = new Date(`${dataISO}T12:00`).getDay();
  return d === 0 || d === 6;
};

/** Marcado à mão como home office: o dia é trabalhado, mas sem vale. */
export const emCasa = (dataISO) => reg('homeOffice').some((x) => x.data === dataISO);

/**
 * Classifica cada dia do mês.
 *
 * O padrão é presencial, por escolha do dono: ir ao escritório é a regra, e o
 * que se marca é a exceção.
 *
 * @returns {Array<{data:string, tipo:'fimDeSemana'|'feriado'|'casa'|'escritorio', feriado?:object}>}
 */
export function diasClassificados(anoMes) {
  const ano = Number(anoMes.slice(0, 4));
  const feriados = mapaDeFeriados(ano - 1, ano + 1);
  const c = config();

  return diasDoMes(anoMes).map((data) => {
    if (ehFimDeSemana(data)) return { data, tipo: 'fimDeSemana' };
    const f = feriados.get(data);
    if (f && (!f.facultativo || c.facultativoNaoTrabalha)) return { data, tipo: 'feriado', feriado: f };
    if (emCasa(data)) return { data, tipo: 'casa' };
    return { data, tipo: 'escritorio' };
  });
}

/**
 * O que foi ganho num mês de trabalho: a base mais um vale por dia no
 * escritório. Home office e feriado não pagam vale.
 */
export function receitaGanhaEm(anoMes) {
  const c = config();
  const dias = diasClassificados(anoMes);
  const noEscritorio = dias.filter((d) => d.tipo === 'escritorio').length;
  const porDia = c.valeRefeicao + c.valeTransporte;
  return {
    mes: anoMes,
    base: c.salarioBase,
    diasNoEscritorio: noEscritorio,
    diasEmCasa: dias.filter((d) => d.tipo === 'casa').length,
    feriados: dias.filter((d) => d.tipo === 'feriado').length,
    porDia,
    vales: noEscritorio * porDia,
    total: c.salarioBase + noEscritorio * porDia,
  };
}

/** O dinheiro que chega neste mês foi ganho no anterior. */
export const receitaQueChega = (anoMes) => receitaGanhaEm(mesAnterior(anoMes));

/**
 * Quinto dia útil do mês: pula fins de semana e feriados, inclusive os
 * facultativos quando o perfil os trata como dia parado.
 */
export function diaDoPagamento(anoMes) {
  const uteis = diasClassificados(anoMes)
    .filter((d) => d.tipo !== 'fimDeSemana' && d.tipo !== 'feriado');
  return uteis[4]?.data || uteis[uteis.length - 1]?.data || null;
}

/* ---------------- gastos ---------------- */

export const gastos = () => reg('gasto');

export function gastosDoMes(anoMes) {
  const lista = gastos().filter((g) => mesDe(g.data) === anoMes && g.valor > 0);
  const soma = (quais) => quais.reduce((a, g) => a + g.valor, 0);

  const porCategoria = CATEGORIAS.map((cat) => {
    const quais = lista.filter((g) => g.categoria === cat.id);
    return { ...cat, total: soma(quais), quantos: quais.length };
  });

  const soltos = lista.filter((g) => !CATEGORIAS.some((c) => c.id === g.categoria));
  if (soltos.length) {
    porCategoria.push({ id: 'outros', nome: 'Outros', total: soma(soltos), quantos: soltos.length });
  }

  return {
    total: soma(lista),
    porCategoria,
    lista: [...lista].sort((a, b) => b.data.localeCompare(a.data)),
  };
}

/**
 * O fechamento do mês.
 *
 * `disponivel` é o teto de gasto que ainda respeita a meta; `restante` é o que
 * sobra desse teto. É o número que responde "posso gastar isso?".
 */
export function balanco(anoMes) {
  const c = config();
  const receita = receitaQueChega(anoMes);
  const g = gastosDoMes(anoMes);
  const sobra = receita.total - g.total;
  const disponivel = receita.total - c.metaSobra;

  return {
    mes: anoMes,
    receita,
    gastos: g,
    meta: c.metaSobra,
    sobra,
    disponivel,
    restante: disponivel - g.total,
    situacao: sobra >= c.metaSobra ? 'noAlvo'
      : sobra >= c.metaSobra * 0.9 ? 'deriva' : 'fora',
    pagamento: diaDoPagamento(anoMes),
  };
}

/**
 * Ritmo de gasto: no dia 10 de um mês de 30, ter gasto um terço do teto é
 * estar em dia. Serve para avisar antes do fim do mês, não depois.
 */
export function ritmo(anoMes, hoje) {
  const dias = diasDoMes(anoMes);
  const b = balanco(anoMes);
  const passados = Math.max(1, Math.min(dias.length, dias.filter((d) => d <= hoje).length));
  const esperado = (b.disponivel / dias.length) * passados;
  return {
    diaDoMes: passados,
    diasNoMes: dias.length,
    esperado,
    gasto: b.gastos.total,
    adiantado: b.gastos.total - esperado,   // positivo = gastando rápido demais
  };
}

/** Meses com algum lançamento, do mais novo para o mais velho. */
export function mesesComMovimento() {
  const meses = new Set(gastos().map((g) => mesDe(g.data)));
  meses.add(mesAtual());
  return [...meses].sort((a, b) => b.localeCompare(a));
}

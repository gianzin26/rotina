// nucleo/feriados.js — os feriados que tiram o dia da conta.
//
// Calculados, não listados: uma lista fixa envelheceria e daria dia útil
// errado no ano seguinte. Os móveis saem todos da Páscoa.

/** Domingo de Páscoa pelo algoritmo gregoriano anônimo. */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/**
 * Feriados nacionais do ano.
 *
 * Carnaval e Corpus Christi são ponto facultativo federal, não feriado por
 * lei — mas quase ninguém trabalha. Vêm marcados como `facultativo` para a
 * tela poder tratá-los à parte.
 *
 * @returns {Array<{data:string, nome:string, facultativo?:boolean}>}
 */
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const fixos = [
    [`${ano}-01-01`, 'Confraternização Universal'],
    [`${ano}-04-21`, 'Tiradentes'],
    [`${ano}-05-01`, 'Dia do Trabalho'],
    [`${ano}-09-07`, 'Independência'],
    [`${ano}-10-12`, 'Nossa Senhora Aparecida'],
    [`${ano}-11-02`, 'Finados'],
    [`${ano}-11-15`, 'Proclamação da República'],
    [`${ano}-11-20`, 'Consciência Negra'],
    [`${ano}-12-25`, 'Natal'],
  ].map(([data, nome]) => ({ data, nome }));

  const moveis = [
    { data: iso(somar(p, -48)), nome: 'Carnaval (segunda)', facultativo: true },
    { data: iso(somar(p, -47)), nome: 'Carnaval', facultativo: true },
    { data: iso(somar(p, -2)), nome: 'Sexta-feira Santa' },
    { data: iso(somar(p, 60)), nome: 'Corpus Christi', facultativo: true },
  ];

  return [...fixos, ...moveis].sort((a, b) => a.data.localeCompare(b.data));
}

/** Mapa data → feriado, para consulta rápida num intervalo de anos. */
export function mapaDeFeriados(anoInicio, anoFim = anoInicio) {
  const mapa = new Map();
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (const f of feriadosNacionais(ano)) mapa.set(f.data, f);
  }
  return mapa;
}

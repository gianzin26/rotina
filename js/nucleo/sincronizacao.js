// nucleo/sincronizacao.js — o que mudou, quando, e como juntar dois aparelhos.
//
// Duas decisões que definem o resto:
//
// 1. O carimbo de tempo NÃO entra no modelo de dados. Ele mora numa chave
//    própria (`rotina.sync`), então `rotina.v1` e os backups continuam com a
//    forma exata de antes.
//
// 2. Ninguém precisa lembrar de carimbar. Toda escrita passa por `salvar()`,
//    então comparamos o estado com a última fotografia e carimbamos só o que
//    mudou de fato. São 32 lugares que escrevem; nenhum precisou mudar.
//
// Apagar exige lápide: sem ela, o aparelho que ainda tem o registro o
// ressuscita na próxima mesclagem.

/** Partes que não são lista de registros: viajam inteiras, não por item. */
export const BLOCOS = ['perfil', 'rotina', 'trajetos', 'sessoesTreino', 'tenis', 'semanasAtipicas'];

/** Identidade estável de um registro: o id quando existe, senão o dia. */
export const chaveDoRegistro = (tipo, r) => `${tipo}:${r.id || r.data}`;

/** Mapa chave → JSON de tudo que é comparável. */
export function fotografar(estado) {
  const foto = {};
  for (const bloco of BLOCOS) {
    if (estado[bloco] !== undefined) foto[bloco] = JSON.stringify(estado[bloco]);
  }
  for (const [tipo, lista] of Object.entries(estado.registros || {})) {
    for (const r of lista) foto[chaveDoRegistro(tipo, r)] = JSON.stringify(r);
  }
  return foto;
}

/**
 * Carimba o que mudou entre duas fotografias.
 * @returns {{carimbos:object, removidos:object}} novos mapas, sem mutar os de entrada
 */
export function carimbar({ anterior = {}, atual, carimbos = {}, removidos = {}, agora = Date.now() }) {
  const c = { ...carimbos };
  const lapides = { ...removidos };

  for (const [chave, json] of Object.entries(atual)) {
    if (anterior[chave] !== json) c[chave] = agora;
    delete lapides[chave]; // existe de novo: a lápide não vale mais
  }
  for (const chave of Object.keys(anterior)) {
    if (!(chave in atual)) {
      lapides[chave] = agora;
      delete c[chave];
    }
  }
  return { carimbos: c, removidos: lapides };
}

/** Quando aquela chave mudou pela última vez, contando lápide. */
const quando = (lado, chave) => Math.max(lado.carimbos?.[chave] ?? 0, lado.removidos?.[chave] ?? 0);
const foiApagada = (lado, chave) => (lado.removidos?.[chave] ?? 0) > (lado.carimbos?.[chave] ?? 0);

/**
 * Junta dois aparelhos. Decide chave a chave, não documento a documento: é o
 * que permite registrar no iPhone e no iPad no mesmo dia sem perder nenhum.
 *
 * @param {{estado:object, carimbos:object, removidos:object}} a
 * @param {{estado:object, carimbos:object, removidos:object}} b
 * @returns {{estado:object, carimbos:object, removidos:object, conflitos:string[]}}
 */
export function mesclar(a, b) {
  const fa = fotografar(a.estado);
  const fb = fotografar(b.estado);
  const chaves = new Set([
    ...Object.keys(fa), ...Object.keys(fb),
    ...Object.keys(a.removidos || {}), ...Object.keys(b.removidos || {}),
  ]);

  const estado = estruturaVazia(a.estado, b.estado);
  const carimbos = {};
  const removidos = {};
  const conflitos = [];

  for (const chave of chaves) {
    const ta = quando(a, chave);
    const tb = quando(b, chave);
    // empate resolve pelo lado A, para a mesclagem ser determinística
    const vencedor = tb > ta ? b : a;
    const perdedor = vencedor === a ? b : a;
    const foto = vencedor === a ? fa : fb;
    const fotoPerdedor = vencedor === a ? fb : fa;

    if (ta && tb && ta !== tb && foto[chave] !== fotoPerdedor[chave]) conflitos.push(chave);

    if (foiApagada(vencedor, chave)) {
      removidos[chave] = quando(vencedor, chave);
      continue;
    }
    const json = foto[chave] ?? fotoPerdedor[chave];
    if (json === undefined) continue;
    aplicar(estado, chave, JSON.parse(json));
    const t = Math.max(ta, tb);
    if (t) carimbos[chave] = t;
  }

  ordenar(estado);
  return { estado, carimbos, removidos, conflitos };
}

/** Casca com as listas certas, sem nenhum registro. */
function estruturaVazia(a, b) {
  const base = { ...b, ...a };
  const tipos = new Set([
    ...Object.keys(a.registros || {}), ...Object.keys(b.registros || {}),
  ]);
  base.registros = {};
  for (const t of tipos) base.registros[t] = [];
  return base;
}

function aplicar(estado, chave, valor) {
  if (BLOCOS.includes(chave)) { estado[chave] = valor; return; }
  const tipo = chave.slice(0, chave.indexOf(':'));
  (estado.registros[tipo] ||= []).push(valor);
}

function ordenar(estado) {
  for (const lista of Object.values(estado.registros)) {
    lista.sort((x, y) => String(x.data).localeCompare(String(y.data)));
  }
}

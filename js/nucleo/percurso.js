// nucleo/percurso.js — a geometria do percurso, sem mapa e sem rede.
//
// O Strava devolve o traçado como polyline codificada (algoritmo do Google):
// uma string que guarda a sequência de coordenadas em diferenças sucessivas.
// Decodificar é aritmética pura, então o percurso fica no aparelho, desenha
// offline e não depende de nenhum provedor de mapa.

/**
 * Decodifica uma polyline em pares [latitude, longitude].
 * @param {string} texto
 * @param {number} [precisao] 5 é o padrão do Strava e do Google
 */
export function decodificar(texto, precisao = 5) {
  if (typeof texto !== 'string' || !texto) return [];
  const fator = 10 ** precisao;
  const pontos = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  while (i < texto.length) {
    for (const eixo of ['lat', 'lng']) {
      let resultado = 0;
      let deslocamento = 0;
      let byte;
      do {
        byte = texto.charCodeAt(i++) - 63;
        // cada caractere carrega 5 bits; o 6º diz se o próximo continua
        resultado |= (byte & 0x1f) << deslocamento;
        deslocamento += 5;
      } while (byte >= 0x20 && i < texto.length);
      // o bit menos significativo marca o sinal, o resto é o valor
      const delta = (resultado & 1) ? ~(resultado >> 1) : (resultado >> 1);
      if (eixo === 'lat') lat += delta; else lng += delta;
    }
    pontos.push([lat / fator, lng / fator]);
  }
  return pontos;
}

/**
 * Projeta o percurso numa caixa, mantendo a proporção real.
 *
 * Um grau de longitude encolhe conforme se afasta do equador — sem corrigir
 * isso, um percurso norte-sul sai achatado. A correção é o cosseno da
 * latitude, que a essa escala (poucos quilômetros) é exata o bastante.
 *
 * @returns {{pontos:Array<[number,number]>, largura:number, altura:number}}
 */
export function projetar(coordenadas, larguraMax, alturaMax, margem = 6) {
  if (!coordenadas.length) return { pontos: [], largura: 0, altura: 0 };

  const lats = coordenadas.map((p) => p[0]);
  const lngs = coordenadas.map((p) => p[1]);
  const latMin = Math.min(...lats); const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs); const lngMax = Math.max(...lngs);
  const escalaLng = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);

  const larguraReal = Math.max(1e-9, (lngMax - lngMin) * escalaLng);
  const alturaReal = Math.max(1e-9, latMax - latMin);

  const util = { larg: larguraMax - margem * 2, alt: alturaMax - margem * 2 };
  const k = Math.min(util.larg / larguraReal, util.alt / alturaReal);
  const larg = larguraReal * k;
  const alt = alturaReal * k;
  const dx = margem + (util.larg - larg) / 2;
  const dy = margem + (util.alt - alt) / 2;

  return {
    largura: larg,
    altura: alt,
    pontos: coordenadas.map(([la, ln]) => [
      dx + (ln - lngMin) * escalaLng * k,
      // latitude cresce para o norte; y da tela cresce para baixo
      dy + (latMax - la) * k,
    ]),
  };
}

/** Distância aproximada do percurso em km, para conferir contra o Strava. */
export function comprimentoKm(coordenadas) {
  let total = 0;
  for (let i = 1; i < coordenadas.length; i++) {
    const [la1, ln1] = coordenadas[i - 1];
    const [la2, ln2] = coordenadas[i];
    const dLat = (la2 - la1) * 111.32;
    const dLng = (ln2 - ln1) * 111.32 * Math.cos(((la1 + la2) / 2) * Math.PI / 180);
    total += Math.hypot(dLat, dLng);
  }
  return total;
}

/** O inverso de `decodificar`, para guardar o traçado compacto. */
export function codificar(coordenadas, precisao = 5) {
  const f = 10 ** precisao;
  let lat = 0;
  let lng = 0;
  let saida = '';
  const pedaco = (v) => {
    let n = v < 0 ? ~(v << 1) : (v << 1);
    let texto = '';
    while (n >= 0x20) { texto += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
    return texto + String.fromCharCode(n + 63);
  };
  for (const [la, ln] of coordenadas) {
    const a = Math.round(la * f);
    const b = Math.round(ln * f);
    saida += pedaco(a - lat) + pedaco(b - lng);
    lat = a; lng = b;
  }
  return saida;
}

/**
 * Reduz o número de pontos preservando a forma (Douglas-Peucker).
 *
 * Um GPX de corrida traz um ponto por segundo — alguns milhares. Guardar tudo
 * incharia o estado que a sincronização carrega. A simplificação joga fora o
 * que não muda o desenho: em linha reta, dez pontos e dois desenham igual.
 *
 * @param {Array<[number,number]>} pontos
 * @param {number} tolerancia desvio máximo aceito, em graus
 */
export function simplificar(pontos, tolerancia = 0.00004) {
  if (pontos.length < 3) return pontos.slice();

  const distanciaDaReta = (p, a, b) => {
    const [py, px] = p; const [ay, ax] = a; const [by, bx] = b;
    const dx = bx - ax; const dy = by - ay;
    const den = dx * dx + dy * dy;
    if (den === 0) return Math.hypot(px - ax, py - ay);
    // projeção do ponto sobre o segmento, limitada às pontas
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / den));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  const manter = new Uint8Array(pontos.length);
  manter[0] = 1;
  manter[pontos.length - 1] = 1;
  // pilha em vez de recursão: percurso longo estouraria a pilha de chamadas
  const pendentes = [[0, pontos.length - 1]];
  while (pendentes.length) {
    const [ini, fim] = pendentes.pop();
    let pior = tolerancia;
    let onde = -1;
    for (let i = ini + 1; i < fim; i++) {
      const d = distanciaDaReta(pontos[i], pontos[ini], pontos[fim]);
      if (d > pior) { pior = d; onde = i; }
    }
    if (onde !== -1) {
      manter[onde] = 1;
      pendentes.push([ini, onde], [onde, fim]);
    }
  }
  return pontos.filter((_, i) => manter[i]);
}

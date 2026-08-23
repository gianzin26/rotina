// nucleo/gpx.js — lê o arquivo que o Strava exporta.
//
// Sem DOMParser de propósito: assim a mesma função roda no navegador e num
// teste em Node, e não depende de como cada plataforma trata XML malformado.
// GPX é regular o bastante para uma leitura direta, e o que interessa são os
// pontos do trajeto, os carimbos de tempo e a altitude.

import { codificar, comprimentoKm, simplificar } from './percurso.js';

const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/**
 * @param {string} texto conteúdo do arquivo .gpx
 * @returns {{coordenadas:Array<[number,number]>, inicio:Date|null, fim:Date|null,
 *   distanciaKm:number, elevacaoM:number, nome:string|null}}
 * @throws {Error} quando não há nenhum ponto de trajeto
 */
export function lerGPX(texto) {
  if (typeof texto !== 'string' || !texto.includes('<trkpt')) {
    throw new Error('Arquivo não parece um GPX com trajeto.');
  }

  const coordenadas = [];
  const tempos = [];
  const altitudes = [];

  // cada <trkpt> traz lat e lon nos atributos, e ele/time como filhos
  const ponto = /<trkpt\b[^>]*?\blat="([^"]+)"[^>]*?\blon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*?\blat="([^"]+)"[^>]*?\blon="([^"]+)"[^>]*\/>/g;
  let m = ponto.exec(texto);
  while (m) {
    const lat = numero(m[1] ?? m[4]);
    const lon = numero(m[2] ?? m[5]);
    if (lat != null && lon != null) {
      coordenadas.push([lat, lon]);
      const dentro = m[3] || '';
      const t = /<time>([^<]+)<\/time>/.exec(dentro);
      const e = /<ele>([^<]+)<\/ele>/.exec(dentro);
      tempos.push(t ? new Date(t[1]) : null);
      altitudes.push(e ? numero(e[1]) : null);
    }
    m = ponto.exec(texto);
  }

  if (!coordenadas.length) throw new Error('O GPX não tem nenhum ponto de trajeto.');

  const validos = tempos.filter((t) => t instanceof Date && !Number.isNaN(t.getTime()));
  const nome = /<trk>[\s\S]*?<name>([^<]+)<\/name>/.exec(texto)?.[1]?.trim() || null;

  // só o que sobe conta como ganho, e um degrau mínimo evita somar o ruído do GPS
  let elevacao = 0;
  for (let i = 1; i < altitudes.length; i++) {
    if (altitudes[i] == null || altitudes[i - 1] == null) continue;
    const d = altitudes[i] - altitudes[i - 1];
    if (d > 0.5) elevacao += d;
  }

  return {
    coordenadas,
    tempos,
    inicio: validos[0] || null,
    fim: validos[validos.length - 1] || null,
    distanciaKm: comprimentoKm(coordenadas),
    elevacaoM: Math.round(elevacao),
    nome,
  };
}

/**
 * Pace de cada quilômetro cheio.
 *
 * Percorre o trajeto somando distância; toda vez que fecha 1 km, fecha também
 * uma parcial. O último trecho, se sobrar menos de um quilômetro, entra como
 * parcial parcial — marcada, para não ser comparada de igual com as outras.
 *
 * @returns {Array<{km:number, minutos:number, pace:number, completa:boolean}>}
 */
export function parciaisPorKm(coordenadas, tempos) {
  if (coordenadas.length < 2) return [];

  const parciais = [];
  let acumulado = 0;
  let inicioDoKm = tempos[0];
  let kmAtual = 1;

  const fechar = (quando, distancia, completa) => {
    if (!(inicioDoKm instanceof Date) || !(quando instanceof Date) || !(distancia > 0)) return;
    const minutos = (quando - inicioDoKm) / 60000;
    if (!(minutos > 0)) return;
    parciais.push({
      km: kmAtual,
      minutos: Math.round(minutos * 100) / 100,
      pace: Math.round((minutos / distancia) * 100) / 100,
      completa,
    });
    kmAtual++;
    inicioDoKm = quando;
  };

  for (let i = 1; i < coordenadas.length; i++) {
    const [la1, ln1] = coordenadas[i - 1];
    const [la2, ln2] = coordenadas[i];
    const dLat = (la2 - la1) * 111.32;
    const dLng = (ln2 - ln1) * 111.32 * Math.cos(((la1 + la2) / 2) * Math.PI / 180);
    acumulado += Math.hypot(dLat, dLng);

    if (acumulado >= 1) {
      fechar(tempos[i], acumulado, true);
      acumulado = 0;
    }
  }
  // o resto do caminho, quando dá para medir
  if (acumulado > 0.05) fechar(tempos[coordenadas.length - 1], acumulado, false);
  return parciais;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/**
 * Converte o GPX no registro de corrida do app.
 *
 * O traçado é simplificado e guardado codificado: um GPX traz um ponto por
 * segundo, e carregar tudo isso na sincronização não se paga — o desenho fica
 * igual com uma fração dos pontos.
 *
 * @returns {{data:string, inicio:string, distanciaKm:number, minutos:number|null,
 *   elevacaoM:number, traco:string, origem:'gpx'}}
 */
export function corridaDoGPX(texto) {
  const g = lerGPX(texto);
  const quando = g.inicio || new Date();
  // o dia do app vira às 5h, como em todo registro
  const logico = new Date(quando.getTime() - 5 * 3600000);
  const minutos = g.inicio && g.fim
    ? Math.round((g.fim - g.inicio) / 60000)
    : null;

  return {
    data: `${logico.getFullYear()}-${doisDigitos(logico.getMonth() + 1)}-${doisDigitos(logico.getDate())}`,
    inicio: `${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`,
    distanciaKm: Math.round(g.distanciaKm * 100) / 100,
    minutos: minutos && minutos > 0 ? minutos : null,
    elevacaoM: g.elevacaoM,
    traco: codificar(simplificar(g.coordenadas)),
    parciais: parciaisPorKm(g.coordenadas, g.tempos),
    origem: 'gpx',
  };
}

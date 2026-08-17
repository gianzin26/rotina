// ferramentas/versionar.js — carimba o sw.js com uma versão derivada do conteúdo.
//
// Roda antes de publicar (o workflow do GitHub Pages chama sozinho). Lê a lista
// de arquivos que o service worker guarda em cache, tira um hash do conteúdo de
// todos eles e escreve esse hash na constante VERSAO.
//
// Consequência: mudou qualquer byte do app, muda o nome do cache; o service
// worker novo instala, o antigo é descartado e o iPhone recebe a atualização
// sem ninguém precisar limpar nada. Não mudou nada, a versão é a mesma e não há
// atualização fantasma.
//
//   node ferramentas/versionar.js          carimba
//   node ferramentas/versionar.js --check  só confere (falha se estiver velho)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const caminhoSw = path.join(raiz, 'sw.js');
const MARCA = /const VERSAO = '([^']*)';/;

function listaDeArquivos(sw) {
  const bloco = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/);
  if (!bloco) throw new Error('Não encontrei a lista ARQUIVOS em sw.js.');
  return [...bloco[1].matchAll(/'\.\/([^']*)'/g)]
    .map((m) => m[1])
    .filter(Boolean); // './' é a própria index, já contada
}

const BINARIOS = /\.(png|jpg|jpeg|gif|webp|ico|woff2?)$/i;

/**
 * Windows guarda CRLF, Linux guarda LF. Sem normalizar, o mesmo conteúdo daria
 * hashes diferentes na minha máquina e no runner do GitHub — e o app anunciaria
 * atualização sem nada ter mudado.
 */
function conteudoNormalizado(abs, rel) {
  const bruto = fs.readFileSync(abs);
  return BINARIOS.test(rel) ? bruto : Buffer.from(bruto.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

function calcularVersao(sw) {
  const arquivos = listaDeArquivos(sw);
  const hash = crypto.createHash('sha256');
  const ausentes = [];

  for (const rel of arquivos.sort()) {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) { ausentes.push(rel); continue; }
    hash.update(rel);
    hash.update(conteudoNormalizado(abs, rel));
  }
  // o próprio sw.js entra no hash, sem a linha da versão (senão nunca estabiliza)
  hash.update(sw.replace(MARCA, '').replace(/\r\n/g, '\n'));

  if (ausentes.length) {
    throw new Error(`sw.js lista arquivos que não existem: ${ausentes.join(', ')}`);
  }
  return `rotina-${hash.digest('hex').slice(0, 12)}`;
}

function principal() {
  const sw = fs.readFileSync(caminhoSw, 'utf8');
  const atual = sw.match(MARCA)?.[1];
  if (atual == null) throw new Error("Não encontrei a linha const VERSAO = '...' em sw.js.");

  const nova = calcularVersao(sw);
  const conferir = process.argv.includes('--check');

  if (atual === nova) {
    console.log(`versão em dia: ${nova}`);
    return;
  }
  if (conferir) {
    console.error(`sw.js está com ${atual}, deveria estar com ${nova}.`);
    console.error('Rode: node ferramentas/versionar.js');
    process.exit(1);
  }

  fs.writeFileSync(caminhoSw, sw.replace(MARCA, `const VERSAO = '${nova}';`));
  console.log(`${atual} → ${nova}`);
}

principal();

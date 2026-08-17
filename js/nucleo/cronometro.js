// nucleo/cronometro.js — máquina de estados do cronômetro de intervalo.
// Conta pelo relógio, não por acúmulo de tiques, para não derivar.
// Não emite som nem vibração: avisa por callback e a apresentação decide o efeito.

export function fases({ ciclos = 6, corridaMin = 3, caminhadaMin = 2 }) {
  const lista = [];
  for (let i = 1; i <= ciclos; i++) {
    if (corridaMin > 0) lista.push({ tipo: 'corrida', rotulo: `Corrida ${i}/${ciclos}`, seg: Math.round(corridaMin * 60) });
    if (caminhadaMin > 0) lista.push({ tipo: 'caminhada', rotulo: `Caminhada ${i}/${ciclos}`, seg: Math.round(caminhadaMin * 60) });
  }
  return lista;
}

/**
 * @param {{ciclos:number, corridaMin:number, caminhadaMin:number}} config
 * @param {{aoAtualizar?:Function, aoTrocarFase?:Function, aoTerminar?:Function}} avisos
 *        `aoTrocarFase` avisa cada virada de fase e recebe null no fim da sessão.
 *        Não dispara ao iniciar: quem começa a sessão já sabe qual é a fase.
 */
export function criarCronometro(config, { aoAtualizar, aoTrocarFase, aoTerminar } = {}) {
  const lista = fases(config);
  const totalSeg = lista.reduce((a, f) => a + f.seg, 0);
  let iFase = 0;
  let decorridoFase = 0;   // segundos concluídos na fase atual
  let marcaInicio = null;  // Date.now() do retomar
  let rodando = false;
  let tique = null;

  const decorridoNaFase = () => decorridoFase + (rodando ? (Date.now() - marcaInicio) / 1000 : 0);
  const restanteFase = () => Math.max(0, lista[iFase].seg - decorridoNaFase());
  const decorridoTotal = () => lista.slice(0, iFase).reduce((a, f) => a + f.seg, 0) + decorridoNaFase();

  function estadoAtual() {
    return {
      fase: lista[iFase], indice: iFase, totalFases: lista.length,
      restante: restanteFase(), decorridoTotal: decorridoTotal(), totalSeg,
      rodando, terminado: iFase >= lista.length,
    };
  }

  // setInterval em vez de requestAnimationFrame: continua correndo com a aba
  // em segundo plano, e o tempo sai do relógio, então não acumula erro.
  function laco() {
    if (!rodando) return;
    if (restanteFase() <= 0) avancar();
    else aoAtualizar?.(estadoAtual());
  }

  function ligarTique() {
    clearInterval(tique);
    tique = setInterval(laco, 250);
  }

  function avancar() {
    iFase++;
    decorridoFase = 0;
    marcaInicio = Date.now();
    if (iFase >= lista.length) {
      rodando = false;
      clearInterval(tique);
      aoTrocarFase?.(null);
      aoAtualizar?.({ ...estadoAtual(), terminado: true });
      aoTerminar?.(totalSeg / 60);
      return;
    }
    aoTrocarFase?.(lista[iFase]);
    aoAtualizar?.(estadoAtual());
  }

  return {
    estado: estadoAtual,
    iniciar() {
      if (rodando || iFase >= lista.length) return;
      rodando = true;
      marcaInicio = Date.now();
      ligarTique();
      aoAtualizar?.(estadoAtual());
    },
    pausar() {
      if (!rodando) return;
      decorridoFase = decorridoNaFase();
      rodando = false;
      clearInterval(tique);
      aoAtualizar?.(estadoAtual());
    },
    pular() { if (iFase < lista.length) avancar(); },
    parar() {
      rodando = false;
      clearInterval(tique);
      const feitos = decorridoTotal();
      iFase = 0; decorridoFase = 0;
      aoAtualizar?.(estadoAtual());
      return feitos / 60;
    },
  };
}

export function mmss(segundos) {
  const s = Math.max(0, Math.ceil(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

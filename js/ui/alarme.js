// ui/alarme.js — retorno sensorial: bipe, vibração e trava de tela.
// Fica na apresentação porque é efeito, não regra.

let audioCtx = null;

/** Destrava o áudio dentro do gesto do usuário (exigência do Safari). */
export function prepararAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch { /* sem áudio disponível */ }
}

/** Bipe curto em Web Audio — o único jeito de fazer som confiável no iOS. */
export function bipe(frequencia = 880, ms = 180) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000 + 0.05);
  } catch { /* sem áudio disponível */ }
}

export function vibrar(padrao = 10) {
  try { navigator.vibrate?.(padrao); } catch { /* iOS ignora */ }
}

/** Bipe de partida da sessão de intervalos. */
export const avisarInicio = () => bipe(1046, 220);

/** Aviso de troca de fase da corrida. `fase` nula = fim da sessão. */
export function avisarFase(fase) {
  if (!fase) {
    bipe(1320, 260);
    setTimeout(() => bipe(1320, 260), 320);
    vibrar([120, 80, 120, 80, 240]);
    return;
  }
  bipe(fase.tipo === 'corrida' ? 1046 : 660, 220);
  vibrar(fase.tipo === 'corrida' ? [200, 80, 200] : 200);
}

/* ---------- tela acesa durante a corrida ---------- */

let trava = null;

export async function segurarTela() {
  try { trava = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte */ }
}

export function soltarTela() {
  try { trava?.release(); } catch { /* ignora */ }
  trava = null;
}

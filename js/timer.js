import {
    getState,
    setState,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    resetSession,
    tickPreparation,
    getSequence,
    SessionStatus
} from './state.js';

let interval = null;
let phaseStep = 0;

const BASE = window.location.origin + window.location.pathname.split('/pages')[0] + '/';

// AudioMgr basado en archivos + Web Audio API
const AudioMgr = (() => {
    let ctx = null;
    let buffers = {}; // { key: AudioBuffer }
    let loaded = false;

    // Mapas de archivos (ajustados a tu estructura)
    const FILES = {
        countdown: `${BASE}assets/sounds/countdown-hold.mp3`,
        sessionEnd: `${BASE}assets/sounds/session-end.mp3`,
        phase: {
            inhale: `${BASE}assets/sounds/phase-inhale.mp3`,
            holdAfterInhale: `${BASE}assets/sounds/countdown-hold.mp3`,
            exhale: `${BASE}assets/sounds/phase-exhale.mp3`,
            holdAfterExhale: `${BASE}assets/sounds/countdown-hold.mp3`
        }
    };

    function ensureCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    async function fetchAsArrayBuffer(url) {
        const resp = await fetch(url, { cache: 'force-cache' });
        if (!resp.ok) throw new Error(`Audio HTTP ${resp.status} - ${url}`);
        return await resp.arrayBuffer();
    }

    async function decodeToBuffer(url) {
        const c = ensureCtx();
        const ab = await fetchAsArrayBuffer(url);
        return await c.decodeAudioData(ab);
    }

    // helper: intenta decodificar si hay URL
    async function tryDecode(url, assign, label = '') {
        if (!url) {
            console.debug('[Audio] Ruta vacía/indefinida:', label);
            return;
        }
        try {
            const buf = await decodeToBuffer(url);
            if (buf) assign(buf);
        } catch (err) {
            console.warn('[Audio] No se pudo cargar:', label, url);
        }
    }

    // Cargamos todos los sonidos. Llamar una vez tras el primer gesto del user (p.ej. Play)
    async function loadAll() {
        if (loaded) return;

        const tasks = [];
        // countdown y fin de sesión
        tasks.push(tryDecode(FILES.countdown, (b) => { buffers.countdown = b; }, 'countdown'));
        tasks.push(tryDecode(FILES.sessionEnd, (b) => { buffers.sessionEnd = b; }, 'sessionEnd'));

        // chime genérico (fallback de fases) — solo si lo definiste
        if (FILES.chime) {
            tasks.push(tryDecode(FILES.chime, (b) => { buffers.chime = b; }, 'chime'));
        }

        // por fase (solo si existen)
        const perPhase = FILES.phase || {};
        await Promise.all([
            tryDecode(perPhase.inhale, (b) => { buffers['phase:inhale'] = b; }, 'phase:inhale'),
            tryDecode(perPhase.holdAfterInhale, (b) => { buffers['phase:holdAfterInhale'] = b; }, 'phase:holdAfterInhale'),
            tryDecode(perPhase.exhale, (b) => { buffers['phase:exhale'] = b; }, 'phase:exhale'),
            tryDecode(perPhase.holdAfterExhale, (b) => { buffers['phase:holdAfterExhale'] = b; }, 'phase:holdAfterExhale'),
        ]);

        await Promise.all(tasks);
        loaded = true;
    }

    // Reproducir un AudioBuffer con volumen (0..1)
    function playBuffer(buf, volume = 1.0) {
        if (!buf || volume <= 0) return;
        const c = ensureCtx();
        const src = c.createBufferSource();
        const gain = c.createGain();
        src.buffer = buf;
        gain.gain.value = Math.max(0, Math.min(1, volume));
        src.connect(gain).connect(c.destination);
        src.start(0);
    }

    // Public API que respeta tu config.audio
    function playCountdown(tick, volume) {
        // un solo archivo “tick” para los 3 golpes
        playBuffer(buffers.countdown, volume);
    }

    function playPhase(phase, volume) {
        // intenta específico por fase; si no, usa chime genérico (si lo cargaste)
        const buf = buffers[`phase:${phase}`] || buffers.chime;
        playBuffer(buf, volume);
    }

    function playSessionEnd(volume) {
        playBuffer(buffers.sessionEnd, volume);
    }

    // Exponer también loadAll para llamarlo al comenzar
    return { loadAll, playCountdown, playPhase, playSessionEnd };
})();

/* ========= API ========= */
export async function playTimer() {
    const { session } = getState();

    // asegurar contexto y pre-carga tras el primer click
    try { await AudioMgr.loadAll(); } catch { }

    if (session.status === SessionStatus.IDLE || session.status === SessionStatus.FINISHED) {
        startSession();
        startPreparationTick();
        return;
    }
    if (session.status === SessionStatus.PAUSED) {
        resumeSession();
        startRunningTick();
    }
}

export function pauseTimer() {
    clearTick();
    pauseSession();
}

export function resetTimer() {
    clearTick();
    resetSession();
}

/* ===== PREPARACIÓN ===== */
function startPreparationTick() {
    clearTick();
    interval = setInterval(() => {
        const { session, config } = getState();

        if (session.status !== SessionStatus.PREPARING) {
            clearTick();
            return;
        }

        // 🔊 Cuenta regresiva 3, 2, 1 (antes de decrementar)
        const audio = config.audio;
        const t = session.prepRemaining;
        if (audio?.enabled && audio?.countdown?.enabled && (t === 4 || t === 3 || t === 2)) {
            AudioMgr.playCountdown(t, (audio.volume ?? 1) * (audio.countdown.volume ?? 1));
        }

        // Tick de preparación (esto decrementa prepRemaining o pasa a RUNNING)
        tickPreparation();

        // ¿Pasamos a RUNNING? → iniciar sesión
        if (getState().session.status === SessionStatus.RUNNING) {
            clearTick();
            startRunning();
        }
    }, 1000);
}

/* =====   SESIÓN   ===== */
function startRunning() {
    const { config } = getState();
    const seq = getSequence();
    phaseStep = 0;

    const firstPhase = seq[0];
    setState({
        phase: firstPhase,
        remaining: config[firstPhase]
    });

    // 🔊 Campanita inicial de fase (una sola vez al comenzar)
    const audio = config.audio;
    if (audio?.enabled) {
        const phaseVol = (audio.phases?.[firstPhase] ?? 0);
        const globalVol = (audio.volume ?? 1);
        const vol = Math.max(0, Math.min(1, globalVol * phaseVol));
        if (vol > 0) AudioMgr.playPhase(firstPhase, vol);
    }

    startRunningTick();
}

function startRunningTick() {
    clearTick();
    interval = setInterval(tickRunning, 1000);
}

function tickRunning() {
    const current = getState();
    const { session, remaining, phase, config } = current;

    // ¿Termina la sesión?
    if (session.remaining <= 1) {
        clearTick();
        finishSession();

        // 🔊 Fin de sesión (una vez)
        const audio = config.audio;
        if (audio?.enabled && audio?.sessionEnd?.enabled) {
            const vol = (audio.volume ?? 1) * (audio.sessionEnd.volume ?? 1);
            if (vol > 0) AudioMgr.playSessionEnd(vol);
        }
        return;
    }

    const seq = getSequence();

    const nextSessionRemaining = session.remaining - 1;
    let nextPhase = phase;
    let nextPhaseRemaining = remaining;
    let nextPhaseStep = phaseStep;

    // Flag para saber si realmente hubo cambio de fase
    let phaseChanged = false;

    if (remaining > 1) {
        nextPhaseRemaining = remaining - 1;
    } else {
        nextPhaseStep = (phaseStep + 1) % seq.length;
        nextPhase = seq[nextPhaseStep];
        nextPhaseRemaining = config[nextPhase];
        phaseStep = nextPhaseStep;
        phaseChanged = true; // ✅ solo ahora hubo cambio de fase
    }

    setState({
        session: { remaining: nextSessionRemaining },
        phase: nextPhase,
        remaining: nextPhaseRemaining
    });

    // 🔊 Sonar SOLO si cambió la fase
    if (phaseChanged) {
        const audio = config.audio;
        if (audio?.enabled) {
            const phaseVol = (audio.phases?.[nextPhase] ?? 0);
            const globalVol = (audio.volume ?? 1);
            const vol = Math.max(0, Math.min(1, globalVol * phaseVol));
            if (vol > 0) AudioMgr.playPhase(nextPhase, vol);
        }
    }
}

/* ===== Helpers ===== */
function clearTick() {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
}
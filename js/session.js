import { playTimer, pauseTimer, resetTimer } from '../js/timer.js';
import { subscribe, getState, SessionStatus } from '../js/state.js';

const playBtn = document.getElementById('play');
const backBtn = document.getElementById('back');

/* 1) Labels: usar las fases reales del state/timer */
const PHASE_LABEL = {
    inhale: 'Inhalar',
    holdAfterInhale: 'Sostener',
    exhale: 'Exhalar',
    holdAfterExhale: 'Sostener',
    finished: 'Buen trabajo'
};

let lastPhase = null;
let lastPhaseRemaining = null;
let lastSessionRemaining = null;

initSessionUI();

subscribe(syncPlayButton);

function syncPlayButton() {
    const { session } = getState();
    const status = session.status;

    const isPreparing = status === SessionStatus.PREPARING;
    const isRunning = status === SessionStatus.RUNNING;
    const isActive = isPreparing || isRunning;

    // Estado visual
    playBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    playBtn.setAttribute('aria-label', isActive ? 'Pausar' : 'Iniciar');

    // Bloqueo durante PREPARING
    playBtn.toggleAttribute('disabled', isPreparing);
    playBtn.setAttribute('aria-disabled', isPreparing ? 'true' : 'false');
}

playBtn.addEventListener('click', () => {
    const { session } = getState();
    const status = session.status;

    // Durante PREPARING no se permite interacción
    if (status === SessionStatus.PREPARING) return;

    if (status === SessionStatus.RUNNING) {
        pauseTimer();
    } else {
        playTimer();
    }
});


backBtn.addEventListener('click', () => {
    resetTimer();
});


/* =========================
   Título de respiración: {Nombre} i-h-e
   ========================= */
function getPresetNameFallback() {
    const n1 = sessionStorage.getItem('presetName');
    if (n1) return n1;
    const n2 = localStorage.getItem('respira-last-preset-name');
    if (n2) return n2;
    return 'Respirar';
}

/* 3) Pattern: ya no existe config.hold; usar holdAfterInhale (y opcionalmente el post-exhale) */
function formatPattern(config) {
    const i = Number(config.inhale ?? 0);
    const hIn = Number(config.holdAfterInhale ?? 0);
    const e = Number(config.exhale ?? 0);
    const hEx = Number(config.holdAfterExhale ?? 0);
    return `${i}-${hIn}-${e}-${hEx}`;
}

function renderBreathTitle(el, state) {
    if (!el) return;
    const name = getPresetNameFallback();
    const pattern = formatPattern(state.config);
    el.textContent = `${name} ${pattern}`;
}

/* =========================
   UI de sesión
   ========================= */
export function initSessionUI() {
    const phaseEl = document.getElementById('phaseWord');
    const timerEl = document.getElementById('phaseRemaining');
    const infoEl = document.getElementById('sessionInfo');
    const circleEl = document.getElementById('breathCircle');
    const titleEl = document.getElementById('breathTitle');
    const root = document.querySelector('main') || document.body;

    /* 2) Fases reales que pueden venir del state/timer */
    const PHASES = ['inhale', 'holdAfterInhale', 'exhale', 'holdAfterExhale'];

    const setPhaseWord = (word) => {
        if (!phaseEl) return;
        phaseEl.classList.remove('show');
        phaseEl.classList.add('enter');
        phaseEl.textContent = word;
        requestAnimationFrame(() => {
            phaseEl.classList.remove('enter');
            phaseEl.classList.add('show');
        });
    };

    const formatMMSS = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const setPausedState = (isPaused) => {
        root.classList.toggle('paused', isPaused);
        const container = circleEl?.closest('.breath-container') || document.body;
        container.classList.toggle('breath-paused', isPaused);
    };

    const updatePhaseUI = (phase, sessionStatus, config) => {
        // Texto principal (palabra)
        if (phase && PHASE_LABEL[phase]) {
            setPhaseWord(PHASE_LABEL[phase]);
        } else if (sessionStatus === 'preparing') {
            setPhaseWord('Preparados...');
        } else if (sessionStatus === 'idle') {
            setPhaseWord('Respirar');
        }

        // Animación del texto por fase
        if (phaseEl) {
            phaseEl.classList.remove(...PHASES);
            if (PHASES.includes(phase)) {
                const seconds = Math.max(1, Number(config[phase] ?? 1));
                phaseEl.style.setProperty('--phase-duration', `${seconds}s`);
                phaseEl.classList.add(phase);
            } else {
                phaseEl.style.removeProperty('--phase-duration');
            }
        }
    };

    const updateTimerUI = (phaseRemaining) => {
        if (!timerEl) return;
        timerEl.textContent = phaseRemaining > 0 ? phaseRemaining : '';
        timerEl.classList.remove('flash');
        void timerEl.offsetWidth; // reflow para reiniciar animación
        timerEl.classList.add('flash');
    };

    const updateInfoUI = (session) => {
        if (!infoEl) return;
        if (session.status === 'preparing') {
            infoEl.textContent = `Comenzamos en ${session.prepRemaining}s`;
        } else if (session.status === 'running' || session.status === 'paused') {
            infoEl.textContent = `Tiempo restante: ${formatMMSS(session.remaining)}`;
        } else if (session.status === 'finished') {
            phaseEl.textContent = 'Buen trabajo'
            infoEl.textContent = 'Sesión terminada';
        } else {
            infoEl.textContent = '';
        }
    };

    const updateCircleUI = (phase, config) => {
        if (!circleEl) return;
        circleEl.classList.remove(...PHASES);
        if (PHASES.includes(phase)) {
            const ms = Math.max(1, Number(config[phase] ?? 1)) * 1000;
            circleEl.style.setProperty('--phaseMs', `${ms}ms`);
            circleEl.classList.add(phase);
        } else {
            circleEl.style.removeProperty('--phaseMs');
        }
    };

    // Pintado inicial del rótulo
    renderBreathTitle(titleEl, getState());

    subscribe((state) => {
        const { phase, remaining, session, config } = state;

        setPausedState(session.status === 'paused');

        // Fase (texto + animación) y círculo cuando cambia la fase
        if (phase !== lastPhase) {
            updatePhaseUI(phase, session.status, config);
            updateCircleUI(phase, config);
            lastPhase = phase;
        }

        // Timer grande
        if (remaining !== lastPhaseRemaining) {
            updateTimerUI(remaining);
            lastPhaseRemaining = remaining;
        }

        // Subtexto de sesión
        updateInfoUI(session);

        // Rótulo (si cambió la config por cualquier motivo)
        renderBreathTitle(titleEl, state);

        lastSessionRemaining = session.remaining;
    });
}


import { initAudioModal } from '../js/audio_modal.js';
initAudioModal({ pauseStrategy: 'auto' });

const STORAGE_KEY = 'respira-state';

const defaultState = {
    phase: null,              // 'inhale' | 'hold' | 'exhale' | null
    remaining: 0,             // segundos restantes de la fase actual
    config: {
        inhale: 2,
        holdAfterInhale: 2,
        exhale: 2,
        holdAfterExhale: 2,
        prepTime: 4
    },
    session: {
        status: 'idle',         // 'idle' | 'preparing' | 'running' | 'paused' | 'finished'
        duration: 300,          // segundos totales de la sesión
        remaining: 300,         // segundos restantes de la sesión
        prepRemaining: 4
    }
};

export const SessionStatus = Object.freeze({
    IDLE: 'idle',
    PREPARING: 'preparing',
    RUNNING: 'running',
    PAUSED: 'paused',
    FINISHED: 'finished'
});

const ALLOWED_TRANSITIONS = {
    idle: ['preparing'],
    preparing: ['running'],
    running: ['paused', 'finished'],
    paused: ['running', 'idle'],
    finished: ['idle']
};

let state = loadState();
const listeners = [];

/* ========= Core ========= */
export function initState() { notify(); }
export function getState() { return structuredClone(state); }

/** setState con merge profundo sobre config y session */
export function setState(patch) {
    state = {
        ...state,
        ...patch,
        config: { ...state.config, ...(patch.config ?? {}) },
        session: { ...state.session, ...(patch.session ?? {}) }
    };
    persist();
    notify();
}

export function subscribe(fn) { listeners.push(fn); fn(getState()); }
function notify() { listeners.forEach(fn => fn(getState())); }

/* ======== Config ======== */
export function updateConfig(key, value) {
    if (state.session.status === SessionStatus.RUNNING) return;
    const next = normalizeConfig({ ...state.config, [key]: value });
    setState({ config: next });
}

export function updatePrepTime(seconds) {
    if (state.session.status === SessionStatus.RUNNING) return;
    setState({
        config: { prepTime: seconds },
        session: { prepRemaining: seconds }
    });
}

export function updateSessionDuration(seconds) {
    if (state.session.status === SessionStatus.RUNNING) return;
    setState({
        session: { duration: seconds, remaining: seconds }
    });
}

/* ======== Session FSM ======== */
function canTransition(from, to) {
    return ALLOWED_TRANSITIONS[from]?.includes(to);
}

export function startSession() {
    const { session, config } = getState();
    if (!canTransition(session.status, SessionStatus.PREPARING)) return;
    setState({
        session: {
            status: SessionStatus.PREPARING,
            remaining: session.duration,          // usamos la duración configurada en sesión
            prepRemaining: config.prepTime
        },
        phase: null,
        remaining: 0
    });
}

export function pauseSession() {
    const { session } = getState();
    if (!canTransition(session.status, SessionStatus.PAUSED)) return;
    setState({ session: { status: SessionStatus.PAUSED } });
}

export function resumeSession() {
    const { session } = getState();
    if (!canTransition(session.status, SessionStatus.RUNNING)) return;
    setState({ session: { status: SessionStatus.RUNNING } });
}

export function finishSession() {
    const { config } = getState();
    setState({
        session: {
            status: SessionStatus.FINISHED,
            remaining: 0,
            prepRemaining: config.prepTime
        },
        phase: null,
        remaining: 0
    });
}

export function resetSession() {
    const { session, config } = getState();
    setState({
        session: {
            status: SessionStatus.IDLE,
            duration: session.duration,
            remaining: session.duration,
            prepRemaining: config.prepTime
        },
        phase: null,
        remaining: 0
    });
}

/* ======== Ticks ======== */
export function tickPreparation() {
    const { session } = getState();
    if (session.prepRemaining <= 1) {
        // pasar a RUNNING
        setState({ session: { status: SessionStatus.RUNNING } });
        return;
    }
    setState({ session: { prepRemaining: session.prepRemaining - 1 } });
}

/* ======== Secuencia ======== */
export function getSequence() {
    const { holdAfterInhale = 0, holdAfterExhale = 0 } = getState().config;

    // Siempre inhalar → (hold si >0) → exhalar → (hold si >0)
    const seq = ['inhale'];
    if (holdAfterInhale > 0) seq.push('holdAfterInhale');
    seq.push('exhale');
    if (holdAfterExhale > 0) seq.push('holdAfterExhale');
    return seq;
}
/* ======== Persistence ======== */
function persist() {
    const { config, session, phase, remaining } = state;
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ config, session, phase, remaining })
    );
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(defaultState);
        const saved = JSON.parse(raw);
        return {
            ...structuredClone(defaultState),
            ...saved,
            phase: null,
            remaining: 0,
            session: {
                ...structuredClone(defaultState.session),
                ...saved.session,
                status: SessionStatus.IDLE,
                prepRemaining:
                    saved.session?.prepRemaining ??
                    saved.config?.prepTime ??
                    defaultState.config.prepTime
            }
        };
    } catch {
        return structuredClone(defaultState);
    }
}

/* ======== Utils ======== */
function normalizeConfig(config) {
    return {
        prepTime: Math.max(1, Number(config.prepTime)),
        inhale: Math.max(1, Number(config.inhale)),
        holdAfterInhale: Math.max(0, Number(config.holdAfterInhale)),
        exhale: Math.max(1, Number(config.exhale)),
        holdAfterExhale: Math.max(0, Number(config.holdAfterExhale))
    };
}
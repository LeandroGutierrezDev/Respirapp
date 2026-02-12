const playBtn = document.getElementById('play');

import { getState, setState } from './state.js';

const MAX_BREATH_SECONDS = 45;

const LIMITS = {
  duration: { min: 1, max: 60 }, // minutos
  inhale: { min: 1, max: MAX_BREATH_SECONDS },
  holdAfterInhale: { min: 0, max: MAX_BREATH_SECONDS },
  exhale: { min: 1, max: MAX_BREATH_SECONDS },
  holdAfterExhale: { min: 0, max: MAX_BREATH_SECONDS }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadConfig() {
  const { config, session } = getState(); // ← duration vive en session

  Object.entries(LIMITS).forEach(([key, limits]) => {
    const input = document.getElementById(key);
    if (!input) return;

    let value =
      key === 'duration'
        ? (session.duration / 60) // minutos
        : config[key];

    value = clamp(Number(value) || limits.min, limits.min, limits.max);
    input.value = value;
  });
}

playBtn.addEventListener('click', () => {
  const state = getState();

  // No cambiamos config acá; solo reseteamos la sesión para arrancar
  setState({
    // phase es top-level (no dentro de session)
    phase: null,
    remaining: 0,
    session: {
      status: 'idle',
      remaining: state.session.duration, // segundos
      prepRemaining: state.config.prepTime
    }
  });

  window.location.href = './session.html';
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stepper]');
  if (!btn) return;

  const id = btn.dataset.target;  // id del input a modificar
  const delta = Number(btn.dataset.delta);

  const input = document.getElementById(id);
  if (!input) return;

  const limits = LIMITS[id];
  if (!limits) return;

  let value = Number(input.value) || limits.min;
  value += delta;

  value = clamp(value, limits.min, limits.max);
  input.value = value;

  saveConfig();
});

function saveConfig() {
  // Obtener inputs por ID (evitar variables implícitas)
  const inhaleEl = document.getElementById('inhale');
  const holdInEl = document.getElementById('holdAfterInhale');
  const exhaleEl = document.getElementById('exhale');
  const holdOutEl = document.getElementById('holdAfterExhale');
  const durationEl = document.getElementById('duration');

  const nextConfig = {
    inhale: Number(inhaleEl?.value) || 1,
    holdAfterInhale: Number(holdInEl?.value) || 0,
    exhale: Number(exhaleEl?.value) || 1,
    holdAfterExhale: Number(holdOutEl?.value) || 0,
    // prepTime: lo podés exponer si querés; por ahora lo dejamos igual
    prepTime: getState().config.prepTime
  };

  const minutes = Number(durationEl?.value) || 1;
  const nextDuration = Math.round(minutes * 60);

  // Guardamos en el shape correcto:
  // - tiempos de respiración en config
  // - duración de sesión en session
  setState({
    config: nextConfig,
    session: {
      duration: nextDuration,
      remaining: nextDuration
    }
  });
}

loadConfig();
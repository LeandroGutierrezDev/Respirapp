// /js/index.js
import { getState, setState } from './state.js';
import { pauseTimer, playTimer } from './timer.js';

const LIMITS = { min: 0, max: 10 };

/* =========================
   Inyectar el modal (HTML) y luego atar listeners
   ========================= */
export function injectAudioModal() {
  // Si ya existe, no lo duplicamos
  if (document.getElementById('audioModal')) return;
  const wrapper = document.createElement('div');

  wrapper.innerHTML = `
<div id="audioModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="audioModalTitle" hidden>
  <div class="modal__overlay" data-audio-close></div>
  <div class="modal__panel" role="document">
    <header class="modal__header">
        <h1 class="phase-word" id="audioModalTitle"></h1>
      <button type="button" class="modal__close" data-audio-close aria-label="Cerrar"></button>
    </header>

    <div class="audio-wrapper">
      <h2 class="phase-word">Panel de Volumen</h2>
      <div class="audio-card">
        <!-- PREPARACIÓN -->
        <div class="stepper-row">
          <label for="countdownVolume">Preparación:</label>
          <div class="stepper-box" role="group" aria-label="Volumen cuenta regresiva">
            <button type="button" class="stepper-btn" data-stepper data-target="countdownVolume" data-delta="-1">−</button>
            <input id="countdownVolume" type="number" min="0" max="10" step="1" value="5" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="countdownVolume" data-delta="+1">+</button>
          </div>
        </div>
        <!-- INHALAR -->
        <div class="stepper-row">
          <label for="inhaleVolume">Inhalar:</label>
          <div class="stepper-box" role="group" aria-label="Volumen inhalar">
            <button type="button" class="stepper-btn" data-stepper data-target="inhaleVolume" data-delta="-1">−</button>
            <input id="inhaleVolume" type="number" min="0" max="10" step="1" value="5" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="inhaleVolume" data-delta="+1">+</button>
          </div>
        </div>
        <!-- SOSTENER post-inhale -->
        <div class="stepper-row">
          <label for="holdAfterInhaleVolume">Sostener:</label>
          <div class="stepper-box" role="group" aria-label="Volumen sostener tras inhalar">
            <button type="button" class="stepper-btn" data-stepper data-target="holdAfterInhaleVolume" data-delta="-1">−</button>
            <input id="holdAfterInhaleVolume" type="number" min="0" max="10" step="1" value="3" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="holdAfterInhaleVolume" data-delta="+1">+</button>
          </div>
        </div>
        <!-- EXHALAR -->
        <div class="stepper-row">
          <label for="exhaleVolume">Exhalar:</label>
          <div class="stepper-box" role="group" aria-label="Volumen exhalar">
            <button type="button" class="stepper-btn" data-stepper data-target="exhaleVolume" data-delta="-1">−</button>
            <input id="exhaleVolume" type="number" min="0" max="10" step="1" value="4" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="exhaleVolume" data-delta="+1">+</button>
          </div>
        </div>
        <!-- SOSTENER post-exhale -->
        <div class="stepper-row">
          <label for="holdAfterExhaleVolume">Sostener:</label>
          <div class="stepper-box" role="group" aria-label="Volumen sostener tras exhalar">
            <button type="button" class="stepper-btn" data-stepper data-target="holdAfterExhaleVolume" data-delta="-1">−</button>
            <input id="holdAfterExhaleVolume" type="number" min="0" max="10" step="1" value="2" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="holdAfterExhaleVolume" data-delta="+1">+</button>
          </div>
        </div>
        <!-- FINALIZAR -->
        <div class="stepper-row">
          <label for="sessionEndVolume">Finalizar:</label>
          <div class="stepper-box" role="group" aria-label="Volumen fin de sesión">
            <button type="button" class="stepper-btn" data-stepper data-target="sessionEndVolume" data-delta="-1">−</button>
            <input id="sessionEndVolume" type="number" min="0" max="10" step="1" value="5" readonly />
            <button type="button" class="stepper-btn" data-stepper data-target="sessionEndVolume" data-delta="+1">+</button>
          </div>
        </div>
      </div>

      <!-- Toggle global -->
      <div class="stepper-row audio-toggle">
        <label for="soundEnabled">Sonido:</label>
        <div class="stepper-box-audio">
          <span class="toggle-text off">OFF</span>
          <label class="toggle-switch">
            <input id="soundEnabled" type="checkbox" checked />
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-text on">ON</span>
        </div>
      </div>
    </div>
    <footer class="order-btns">    
      <button type="button" class="btn-ghost home-link" data-audio-close>← Volver</button>
    </footer>
  </div>
</div>
  `;

  // Agregamos ambos bloques (modal + botón volver)
  document.body.append(...wrapper.children);

  // 🟢 Ahora que el modal existe, obtenemos referencias frescas y atamos listeners
  const EL = getEL();
  EL.soundEnabled?.addEventListener('change', (e) => {
    applyDisabledLook(!e.target.checked);
    saveAudioConfig();
  });
}

/* =========================
   Helpers de elementos (siempre consultan el DOM actual)
   ========================= */
function getEL() {
  return {
    modal: document.getElementById('audioModal'),
    soundEnabled: document.getElementById('soundEnabled'),
    countdownVolume: document.getElementById('countdownVolume'),
    inhaleVolume: document.getElementById('inhaleVolume'),
    holdAfterInhaleVolume: document.getElementById('holdAfterInhaleVolume'),
    exhaleVolume: document.getElementById('exhaleVolume'),
    holdAfterExhaleVolume: document.getElementById('holdAfterExhaleVolume'),
    sessionEndVolume: document.getElementById('sessionEndVolume')
  };
}

/* =========================
   Utilidades y mapeos 0–10 <-> 0–1
   ========================= */
function clampInt(v) {
  const n = Math.round(Number(v) || 0);
  return Math.min(Math.max(n, LIMITS.min), LIMITS.max);
}
function to01(int0to10) { return clampInt(int0to10) / 10; }
function from01(float0to1) { return Math.round((Number(float0to1) || 0) * 10); }

/* =========================
   Cargar UI desde config.audio
   ========================= */
function loadAudioUI() {
  const EL = getEL();
  if (!EL.soundEnabled) return; // si por alguna razón aún no está

  const { config } = getState();
  const audio = config.audio ?? {};

  EL.soundEnabled.checked = audio.enabled ?? true;
  EL.countdownVolume.value = from01(audio.countdown?.volume ?? .6);
  EL.inhaleVolume.value = from01(audio.phases?.inhale ?? 0.7);
  EL.holdAfterInhaleVolume.value = from01(audio.phases?.holdAfterInhale ?? 0.3);
  EL.exhaleVolume.value = from01(audio.phases?.exhale ?? 0.7);
  EL.holdAfterExhaleVolume.value = from01(audio.phases?.holdAfterExhale ?? 0.3);
  EL.sessionEndVolume.value = from01(audio.sessionEnd?.volume ?? 1.0);

  applyDisabledLook(!EL.soundEnabled.checked);
}

/* =========================
   Look atenuado si sonido OFF
   ========================= */
function applyDisabledLook(disabled) {
  const modal = document.getElementById('audioModal');
  if (!modal) return;
  modal.querySelectorAll('.stepper-row').forEach(row => {
    if (row.classList.contains('audio-toggle')) return;
    row.style.opacity = disabled ? '.5' : '1';
    row.style.pointerEvents = disabled ? 'none' : 'auto';
  });
}

/* =========================
   Guardar config.audio (auto-save)
   ========================= */
function saveAudioConfig() {
  const EL = getEL();
  if (!EL.soundEnabled) return;

  const state = getState();
  const prevAudio = state.config?.audio ?? {};

  const next = {
    enabled: !!EL.soundEnabled.checked,
    volume: 1.0,
    countdown: { enabled: true, volume: to01(EL.countdownVolume.value) },
    phases: {
      inhale: to01(EL.inhaleVolume.value),
      holdAfterInhale: to01(EL.holdAfterInhaleVolume.value),
      exhale: to01(EL.exhaleVolume.value),
      holdAfterExhale: to01(EL.holdAfterExhaleVolume.value)
    },
    sessionEnd: { enabled: true, volume: to01(EL.sessionEndVolume.value) }
  };

  setState({
    config: {
      ...state.config,
      audio: { ...prevAudio, ...next }
    }
  });
}

/* =========================
   Delegación de steppers (document-level)
   ========================= */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stepper]');
  if (!btn) return;

  const id = btn.dataset.target;
  const delta = Number(btn.dataset.delta);
  const input = document.getElementById(id);
  if (!input) return;

  input.value = clampInt(Number(input.value) + delta);
  saveAudioConfig();
});

// Toggle global (si el modal ya existe; si no, lo atamos en injectAudioModal)
const EL0 = getEL();
EL0.soundEnabled?.addEventListener('change', (e) => {
  applyDisabledLook(!e.target.checked);
  saveAudioConfig();
});

/* =========================
   Modal: abrir/cerrar (accesible)
   ========================= */

export function initAudioModal({ openButtonSelector = '#openAudio', pauseStrategy = 'none' } = {}) {
  const modal = document.getElementById('audioModal');
  const openBtn = document.querySelector(openButtonSelector);
  if (!modal || !openBtn) return;

  const closeEls = modal.querySelectorAll('[data-audio-close]');
  const firstFocus = modal.querySelector('#soundEnabled');
  const pageRoot = document.querySelector('main');
  let lastActive = null;
  let wasRunningOnOpen = false; // ← bandera

  function isInside(root, el) { return !!(root && el && root.contains(el)); }

  function openModal(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    lastActive = document.activeElement;

    // ⬇️ Pausar si corresponde (solo en sesión)
    if (pauseStrategy === 'auto') {
      const { session } = getState();
      wasRunningOnOpen = (session.status === 'running');
      if (wasRunningOnOpen) pauseTimer();
    }

    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    if (pageRoot) pageRoot.inert = true;

    // Cargar valores del estado actual
    loadAudioUI();

    (firstFocus || modal).focus({ preventScroll: true });
    document.addEventListener('keydown', onEsc);
  }

  function closeModal(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    if (pageRoot) pageRoot.inert = false;
    modal.classList.add('hidden');
    modal.setAttribute('hidden', '');

    // ⬇️ Reanudar solo si estaba corriendo al abrir y sigue en 'paused'
    if (pauseStrategy === 'auto' && wasRunningOnOpen && getState().session.status === 'paused') {
      playTimer();
    }

    // devolver foco fuera del modal
    const returnTarget = lastActive || openBtn || document.body;
    if (isInside(modal, document.activeElement)) {
      returnTarget.focus({ preventScroll: true });
    }

    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape') closeModal(e);
  }

  // Abrir (captura para evitar cualquier navegación residual)
  openBtn.setAttribute('href', '#');
  openBtn.addEventListener('click', openModal, { capture: true });

  // Cerrar (botones y overlay)
  closeEls.forEach(btn => {
    if (btn.tagName === 'BUTTON') btn.type = 'button';
    btn.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', (e) => {
    if (e.target.matches('.modal__overlay')) closeModal(e);
  });
}
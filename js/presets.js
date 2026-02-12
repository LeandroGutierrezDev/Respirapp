import { PRESETS } from './presets.data.js';
import { setState } from './state.js';

window.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-preset]');

    // Seguridad: si algún botón está dentro de un <form>, evitás submit por default
    buttons.forEach(btn => {
        if (btn.tagName === 'BUTTON' && !btn.getAttribute('type')) {
            btn.setAttribute('type', 'button');
        }
    });

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const key = e.currentTarget.dataset.preset;

            if (key === 'custom') {
                // Nombre para el rótulo cuando el flujo sea personalizado
                sessionStorage.setItem('presetName', 'Personalizado');
                localStorage.setItem('respira-last-preset-name', 'Personalizado');
                window.location.href = './config.html';
                return;
            }

            const preset = PRESETS[key];
            if (!preset) {
                console.warn('[presets] key inválida:', key);
                return;
            }

            // 1) Guardamos también el nombre del preset (para el rótulo en sesión)
            const presetName = preset.name ?? key;
            sessionStorage.setItem('presetName', presetName);
            localStorage.setItem('respira-last-preset-name', presetName);

            // 2) (Opcional) Guardar el objeto preset para otros usos
            sessionStorage.setItem('preset', JSON.stringify(preset));

            // 3) Tu lógica actual: aplicar al estado y navegar
            setState({
                config: {
                    ...preset,
                    // si preferís que prepTime sea configurable, podés leerlo de otro lado
                    prepTime: 4
                },
                session: {
                    status: 'idle',
                    remaining: preset.duration,
                    prepRemaining: 4,
                    phase: null
                }
            });

            window.location.href = './session.html';
        });
    });
});
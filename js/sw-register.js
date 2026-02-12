// sw-register.js - Registro centralizado del Service Worker

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Detectar si estamos en raíz o en /pages/
        const isInPagesFolder = window.location.pathname.includes('/pages/');
        const swPath = isInPagesFolder ? '../sw.js' : './sw.js';

        navigator.serviceWorker.register(swPath)
            .then(registration => {
                console.log('✅ Service Worker registrado:', registration.scope);
                
                // Detectar actualizaciones disponibles
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Hay una nueva versión disponible
                            if (confirm('Nueva versión disponible. ¿Recargar ahora?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(err => console.error('❌ Error registrando SW:', err));
    });

    // Recargar cuando el nuevo SW tome control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}
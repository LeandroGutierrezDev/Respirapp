const VERSION = 'v1.0.3';

const SHELL_CACHE = `respira-shell-${VERSION}`;
const PAGES_CACHE = `respira-pages-${VERSION}`;
const STATIC_CACHE = `respira-static-${VERSION}`;

const CACHE_NAMES = [SHELL_CACHE, PAGES_CACHE, STATIC_CACHE];

// Derivar basePath en función del scope (soporta GH Pages y local)
const SCOPE = new URL(self.registration.scope);
const basePath = SCOPE.pathname.endsWith('/') ? SCOPE.pathname : (SCOPE.pathname + '/');

// Helper para rutas con base
const p = (path) => {
    if (path.startsWith('/')) path = path.slice(1);
    return basePath + path;
};

const APP_SHELL = [
    p(''),  // raíz (importante para GH Pages)
    p('index.html'),
    p('css/styles.css'),
    p('js/audio_modal.js'),
    p('js/config.js'),
    p('js/presets.data.js'),
    p('js/presets.js'),
    p('js/session.js'),
    p('js/state.js'),
    p('js/sw-register.js'),
    p('js/timer.js'),
    p('pages/presets.html'),
    p('pages/session.html'),
    p('pages/config.html'),
    p('pages/about.html'),
    p('assets/icons/icon-192.png'),
    p('assets/icons/icon-512.png'),
    p('assets/sounds/countdown-hold.mp3'),
    p('assets/sounds/phase-exhale.mp3'),
    p('assets/sounds/phase-inhale.mp3'),
    p('assets/sounds/session-end.mp3'),
    p('manifest.webmanifest'),
    p('favicon.ico'),
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando versión:', VERSION);
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => {
                console.log('[SW] Cacheando APP_SHELL');
                return cache.addAll(APP_SHELL);
            })
            .then(() => {
                console.log('[SW] APP_SHELL cacheado exitosamente');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Error cacheando APP_SHELL:', err);
                throw err;
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activando versión:', VERSION);
    event.waitUntil((async () => {
        // Habilitar Navigation Preload si está disponible
        if (self.registration.navigationPreload) {
            try {
                await self.registration.navigationPreload.enable();
                console.log('[SW] Navigation Preload habilitado');
            } catch (e) {
                console.log('[SW] Navigation Preload no disponible');
            }
        }

        // Limpiar caches antiguos
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((k) => !CACHE_NAMES.includes(k))
                .map((k) => {
                    console.log('[SW] Eliminando cache antiguo:', k);
                    return caches.delete(k);
                })
        );

        // Tomar control de todas las páginas inmediatamente
        await self.clients.claim();
        console.log('[SW] Control reclamado');
    })());
});

async function networkFirstHTML(request) {
    const cache = await caches.open(PAGES_CACHE);

    try {
        const fresh = await fetch(request);
        if (fresh.ok) {
            cache.put(request, fresh.clone());
        }
        return fresh;
    } catch (e) {
        console.log('[SW] Network failed, usando cache para:', request.url);
        const cached = await cache.match(request);
        if (cached) return cached;

        // Fallback a index.html
        const fallback = await caches.match(p('index.html'));
        if (fallback) return fallback;

        // Última opción: página offline básica
        return new Response(
            `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin conexión - Respirapp</title>
        <style>
          body { 
            font-family: system-ui; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh; 
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { font-size: 1.1rem; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div>
          <h1>🌐 Sin conexión</h1>
          <p>Respirapp requiere conexión para la carga inicial.</p>
          <p>Por favor, conectate a internet e intentá nuevamente.</p>
        </div>
      </body>
      </html>`,
            {
                status: 503,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
        );
    }
}

async function staleWhileRevalidateStatic(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);

    const networkPromise = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);

    return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Ignorar no-HTTP y no-GET
    if (!url.protocol.startsWith('http')) return;
    if (req.method !== 'GET') return;

    // Navegación (HTML)
    if (req.mode === 'navigate') {
        event.respondWith(networkFirstHTML(req));
        return;
    }

    // Media con Range → red directa para compatibilidad con audio
    const hasRange = req.headers.has('range');
    const isMedia = url.pathname.match(/\.(mp3|mp4|webm|ogg)$/i);
    if (hasRange && isMedia) {
        event.respondWith(fetch(req));
        return;
    }

    // Estáticos comunes (CSS, JS, imágenes)
    const isStatic = url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$/i);
    if (isStatic) {
        event.respondWith(staleWhileRevalidateStatic(req));
        return;
    }

    // Por defecto: red con fallback a cache
    event.respondWith((async () => {
        try {
            return await fetch(req);
        } catch {
            const cached = await caches.match(req);
            return cached || Response.error();
        }
    })());
});

// Canal para forzar skipWaiting desde la app (banner de actualización)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] SKIP_WAITING recibido, activando nueva versión');
        self.skipWaiting();
    }
});
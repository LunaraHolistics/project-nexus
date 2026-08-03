import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // ============================================
    // SERVIDOR DE DESENVOLVIMENTO
    // ============================================
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: true, // Abre browser automaticamente
      // HTTPS necessário para testar Service Worker localmente
      // Descomente se tiver certificados:
      // https: {
      //   key: './certs/localhost-key.pem',
      //   cert: './certs/localhost.pem',
      // }
    },

    // ============================================
    // CONFIGURAÇÃO DE BUILD
    // ============================================
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Organiza arquivos por tipo
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(png|jpe?g|gif|svg|ico|webp)$/i.test(assetInfo.name)) {
              return `images/[name]-[hash][extname]`;
            }
            if (/\.(woff2?|ttf|otf|eot)$/i.test(assetInfo.name)) {
              return `fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
        },
      },
    },

    // ============================================
    // RESOLVE & ALIASES
    // ============================================
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@telas': path.resolve(__dirname, './telas-individuais'),
        '@assets': path.resolve(__dirname, './assets'),
      },
    },

    // ============================================
    // VARIÁVEIS DE AMBIENTE
    // ============================================
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '3.0.0'),
      '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
    },

    // ============================================
    // PLUGINS
    // ============================================
    plugins: [
      // PWA Plugin - Gera SW automaticamente e cuida do manifest
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'og-image.png', 'manifest.json'],
        manifest: false, // Usamos nosso manifest.json manual
        workbox: {
          globPatterns: ['**/*.{html,js,css,png,jpg,svg,ico,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/image\.pollinations\.ai\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'pollinations-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
              },
            },
          ],
        },
        devOptions: {
          enabled: true, // Permite testar SW em dev mode
        },
      }),
    ],

    // ============================================
    // OTIMIZAÇÕES
    // ============================================
    optimizeDeps: {
      include: [],
    },

    // ============================================
    // PREVIEW (produção local)
    // ============================================
    preview: {
      port: 4173,
      host: '0.0.0.0',
      open: true,
    },
  };
});
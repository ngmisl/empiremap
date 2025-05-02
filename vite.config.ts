import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // Proxy API requests to avoid CORS issues in development
      '/api': {
        target: 'https://www.empirebuilder.world',
        changeOrigin: true,
        // Do not rewrite API path; forward /api/* directly to the target
        rewrite: (path) => path,
        configure: (proxy) => {
          // Add CORS headers to the proxy response
          proxy.on('proxyRes', (proxyRes) => {
            // Set CORS headers
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
            proxyRes.headers['Access-Control-Max-Age'] = '86400'; // 24 hours
            
            // Add caching headers
            proxyRes.headers['Cache-Control'] = 'public, max-age=300'; // 5 minutes
          });
          
          // Log any errors
          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
        }
      }
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400 // 24 hours in seconds
    }
  }
})

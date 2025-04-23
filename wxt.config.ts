import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';

// Load environment variables from .env file
const env = loadEnv('', process.cwd());

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MindNotes',
    description: 'Save web page links and summaries as notes in your account',
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'scripting',
      'alarms',
      'identity'
    ],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png'
    },
    // OAuth configuration for MV3
    oauth2: {
      client_id: '563988341291-uvlnjg8jmnva7d3m4pqk6aptla9r2bde.apps.googleusercontent.com',
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    },
    // Recommend adding a key for stable extension ID across installations
    key: env.VITE_EXTENSION_KEY || undefined
  },
  viteConfig: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || "563988341291-uvlnjg8jmnva7d3m4pqk6aptla9r2bde.apps.googleusercontent.com"),
    }
  }
});

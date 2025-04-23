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
      'alarms'
    ],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png'
    }
  },
  viteConfig: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    }
  }
});

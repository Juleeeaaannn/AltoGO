import { defineConfig, loadEnv } from 'vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (command === 'build' && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Configuralas antes de compilar para producción.'
    );
  }

  return {
    plugins: [
      {
        name: 'altogo-supabase-config',
        transformIndexHtml(html) {
          return html
            .replaceAll('__SUPABASE_URL__', supabaseUrl)
            .replaceAll('__SUPABASE_ANON_KEY__', supabaseAnonKey);
        }
      },
      {
        name: 'altogo-copy-classic-scripts',
        closeBundle() {
          cpSync(resolve('assets/js'), resolve('dist/assets/js'), { recursive: true });
        }
      }
    ],
    build: {
      target: 'es2020',
      sourcemap: false
    }
  };
});

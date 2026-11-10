import { defineConfig, loadEnv } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transform } from 'esbuild';

// Orden de carga de los scripts clásicos. Se unen en un único archivo
// minificado y ofuscado para no publicar el código fuente legible.
const CLASSIC_SCRIPTS = [
  'config.js',
  'backend.js',
  'utils.js',
  'data.js',
  'auth.js',
  'cart.js',
  'views-storefront.js',
  'views-login.js',
  'views-admin.js',
  'app.js'
];

const BUNDLE_PATH = 'assets/js/altogo.min.js';

const obfuscateBundle = async (source) => {
  const minified = await transform(source, {
    loader: 'js',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    format: 'iife'
  });

  const { default: JavaScriptObfuscator } = await import('javascript-obfuscator');
  return JavaScriptObfuscator.obfuscate(minified.code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.25,
    deadCodeInjection: false,
    identifierNamesGenerator: 'hexadecimal',
    identifiersPrefix: 'a_',
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  }).getObfuscatedCode();
};

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
        name: 'altogo-production-html',
        enforce: 'post',
        transformIndexHtml(html) {
          const withConfig = html
            .replaceAll('__SUPABASE_URL__', supabaseUrl)
            .replaceAll('__SUPABASE_ANON_KEY__', supabaseAnonKey);

          if (command !== 'build') return withConfig;

          return withConfig
            .replace(/\s*<script src="\/assets\/js\/[^"]+"><\/script>/g, '')
            .replace('</body>', `  <script src="/${BUNDLE_PATH}"></script>\n</body>`);
        },
        async closeBundle() {
          if (command !== 'build') return;
          const source = CLASSIC_SCRIPTS
            .map((file) => readFileSync(resolve('assets/js', file), 'utf8'))
            .join('\n;\n');
          const code = await obfuscateBundle(source);
          const target = resolve('dist', BUNDLE_PATH);
          mkdirSync(resolve(target, '..'), { recursive: true });
          writeFileSync(target, code, 'utf8');
        }
      }
    ],
    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: false
    }
  };
});

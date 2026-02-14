import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/**
 * Plugin to stub out uninstalled optional dependencies from Para SDK.
 * The Para SDK bundles connectors for Solana and Cosmos, but we only
 * use EVM/Base. This plugin intercepts imports to those missing packages
 * and returns an empty module instead of crashing.
 *
 * CRITICAL: This runs in both dev and production builds to prevent
 * white screen errors on Vercel deployment.
 */
function stubMissingDeps(): Plugin {
  // Comprehensive patterns for packages we don't need (Cosmos + Solana + Celo ecosystem)
  const stubbedPatterns = [
    // Cosmos ecosystem
    /^graz/,
    /^@cosmos/,
    /^cosmjs-types/,
    /^@cosmjs\//,
    /^@cosmjs\/encoding/,
    /^@keplr-wallet\//,
    // Solana ecosystem
    /^@solana\//,
    /^@solana-mobile\//,
    // Celo ecosystem - this causes white screen on Vercel
    /^@celo\//,
    /^@celo\/utils/,
    // Para SDK optional connectors
    /^@getpara\/solana/,
    /^@getpara\/cosmos/,
    /^@getpara\/cosmjs/,
  ]

  return {
    name: 'stub-missing-deps',
    enforce: 'pre',
    resolveId(id) {
      // Check if the import matches any of our stubbed patterns
      if (stubbedPatterns.some(pattern => pattern.test(id))) {
        console.log(`[stub-missing-deps] Stubbing: ${id}`)
        return '\0stub:' + id
      }
      return null
    },
    load(id) {
      if (id.startsWith('\0stub:')) {
        // TODO: BROWSER COMPATIBILITY - Return silent no-op stubs instead of throwing
        // This prevents runtime crashes when Para SDK checks for optional connectors
        return `
          export default {};
          export const Encrypt = () => null;
          export const Decrypt = () => null;
          export const toBech32 = () => null;
          export const fromBech32 = () => null;
          export const ecies = { Encrypt: () => null, Decrypt: () => null };
          export const ECIES = { Encrypt: () => null, Decrypt: () => null };
        `
      }
      return null
    },
  }
}

/**
 * Plugin to handle browser compatibility for Node.js modules
 * that might be imported by dependencies like asn1.js
 */
function browserCompatPlugin(): Plugin {
  return {
    name: 'browser-compat',
    enforce: 'pre',
    resolveId(id) {
      // Handle vm module which is used by asn1.js
      if (id === 'vm') {
        return '\0browser-vm'
      }
      return null
    },
    load(id) {
      if (id === '\0browser-vm') {
        // Provide a minimal browser-compatible vm shim
        return `
          export function runInThisContext(code) {
            return eval(code);
          }
          export function runInNewContext(code, context) {
            return eval(code);
          }
          export default { runInThisContext, runInNewContext };
        `
      }
      return null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    browserCompatPlugin(),
    stubMissingDeps(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto', 'http', 'https', 'os', 'url', 'assert', 'path', 'string_decoder'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    react(),
  ],
  // Ensure WASM files are properly handled
  assetsInclude: ['**/*.wasm'],
  define: {
    // Ensure process.env is available
    'process.env': {},
  },
  resolve: {
    alias: {
      // Alias problematic Node-only modules to browser-safe versions
      '@celo/utils/lib/ecies.js': '/src/stubs/celo-ecies.ts',
      '@celo/utils/lib/ecies': '/src/stubs/celo-ecies.ts',
      '@celo/utils': '/src/stubs/celo-utils.ts',
      '@cosmjs/encoding': '/src/stubs/cosmjs-encoding.ts',
      'graz': '/src/stubs/graz.ts',
    },
  },
  build: {
    // Ensure compatibility with Vercel edge functions and older browsers
    target: 'es2020',
    // Don't fail on warnings
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress certain warnings
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        if (warning.code === 'SOURCEMAP_ERROR') return
        if (warning.message?.includes('Use of eval')) return
        warn(warning)
      },
    },
  },
  // Enable top-level await support
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: [
      '@getpara/solana-wallet-connectors',
      '@getpara/cosmos-wallet-connectors',
      '@getpara/cosmjs-v0-integration',
    ],
  },
})

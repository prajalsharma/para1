#!/usr/bin/env node
/**
 * Bundle Check Script
 *
 * TODO: CI REGRESSION PREVENTION
 * This script scans the production build output for forbidden Node-only modules
 * that should never appear in client bundles.
 *
 * Run after build: npm run build && npm run check-bundle
 *
 * Forbidden patterns include:
 * - @celo/utils (Celo blockchain module - Node only)
 * - @cosmjs/encoding error messages (Cosmos SDK - Node only)
 * - Other Node-specific crypto modules
 *
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(__dirname, '../dist/assets');

// Forbidden patterns that should NEVER appear in client bundles
// These indicate Node-only modules leaking into the browser
const FORBIDDEN_PATTERNS = [
  // Error messages from our stubs that throw (should be fixed to not throw)
  '@celo/utils/lib/ecies is not available in browser',
  '@celo/utils is not available in browser',
  '@cosmjs/encoding is not available',

  // Direct imports of Node-only Celo modules
  'require("@celo/utils")',
  'from "@celo/utils"',
  'from "@celo/utils/lib/ecies"',

  // Celo ECIES module (should be stubbed, not bundled)
  '@celo/utils/lib/ecies.js',
];

// Warning patterns - not fatal but should be monitored
const WARNING_PATTERNS = [
  // These might appear legitimately in error messages from other libs
  'not available in browser',
];

function checkBundle() {
  console.log('🔍 Checking bundle for forbidden Node-only modules...\n');

  if (!existsSync(distDir)) {
    console.error('❌ dist/assets directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const files = readdirSync(distDir).filter(f => f.endsWith('.js'));
  let hasErrors = false;
  let warningCount = 0;

  for (const file of files) {
    const filePath = join(distDir, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (content.includes(pattern)) {
        console.error(`❌ FORBIDDEN: Found "${pattern}" in ${file}`);
        hasErrors = true;
      }
    }

    // Check warning patterns (non-fatal)
    for (const pattern of WARNING_PATTERNS) {
      const count = (content.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count > 0) {
        // Only warn if it's not from our known-ok sources
        const celoCount = (content.match(/@celo/g) || []).length;
        if (celoCount > 0) {
          console.warn(`⚠️  WARNING: Found ${celoCount} @celo references in ${file}`);
          warningCount++;
        }
      }
    }
  }

  console.log(`\n📊 Scanned ${files.length} bundle files`);

  if (hasErrors) {
    console.error('\n❌ BUNDLE CHECK FAILED: Node-only modules found in client bundle!');
    console.error('   Fix: Ensure all @celo/utils imports are aliased to silent stubs.');
    console.error('   See: vite.config.ts resolve.alias and src/stubs/');
    process.exit(1);
  }

  if (warningCount > 0) {
    console.warn(`\n⚠️  ${warningCount} warnings found. Review above for potential issues.`);
  }

  console.log('\n✅ Bundle check passed! No forbidden Node-only modules found.');
  process.exit(0);
}

checkBundle();

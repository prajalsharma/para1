/**
 * Stub for @celo/utils
 *
 * TODO: BROWSER COMPATIBILITY FIX
 * This module is not available in browser environments.
 * It's only used by Para SDK's optional Celo connector which we don't use.
 *
 * These stubs return undefined/null silently instead of throwing errors
 * to prevent runtime crashes when the Para SDK checks for Celo support.
 */

// Silent no-op stubs - do not throw errors
export function Encrypt(): null {
  return null;
}

export function Decrypt(): null {
  return null;
}

// Common @celo/utils exports as silent stubs
export const ecies = {
  Encrypt,
  Decrypt,
};

export default { Encrypt, Decrypt, ecies };

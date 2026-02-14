/**
 * Stub for @celo/utils/lib/ecies
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
  // Silent no-op - Celo connector not used in this app
  return null;
}

export function Decrypt(): null {
  // Silent no-op - Celo connector not used in this app
  return null;
}

// Additional exports that @celo/utils/lib/ecies might have
export const ECIES = {
  Encrypt,
  Decrypt,
};

export default { Encrypt, Decrypt, ECIES };

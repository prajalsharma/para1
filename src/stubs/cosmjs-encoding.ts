/**
 * Stub for @cosmjs/encoding
 *
 * TODO: BROWSER COMPATIBILITY FIX
 * This module is only used by Para SDK's optional Cosmos connector which we don't use.
 * These stubs return empty values silently instead of throwing errors
 * to prevent runtime crashes.
 */

// Silent no-op stubs - return empty values instead of throwing
export function toBech32(): string {
  return '';
}

export function fromBech32(): { prefix: string; data: Uint8Array } {
  return { prefix: '', data: new Uint8Array(0) };
}

export function toBase64(): string {
  return '';
}

export function fromBase64(): Uint8Array {
  return new Uint8Array(0);
}

export function toHex(): string {
  return '';
}

export function fromHex(): Uint8Array {
  return new Uint8Array(0);
}

export function toUtf8(): Uint8Array {
  return new Uint8Array(0);
}

export function fromUtf8(): string {
  return '';
}

export default {};

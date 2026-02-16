/**
 * Policy Storage Module
 *
 * CRITICAL SERVER-SIDE ENFORCEMENT COMPONENT
 *
 * TODO: TEMPORARY - Server-side policy storage and validation
 * ===========================================================
 * This module implements server-side enforcement as a TEMPORARY measure
 * while Para backend issues are being resolved. Once Para is working:
 * - Para will enforce policies at signing time via their SDK
 * - This module will store policies for UX display only
 * - validateTransaction will be replaced by Para's actual response
 *
 * This module stores per-wallet policies and validates transactions against them.
 * Since Para's SDK doesn't support per-wallet policy attachment, we implement
 * server-side enforcement ourselves:
 *
 * 1. When parent creates child wallet → policy stored here
 * 2. When child attempts transaction → policy retrieved and validated here
 * 3. Only if validation passes → proceed to Para signing
 *
 * This is REAL server-side enforcement because:
 * - Client cannot access this storage
 * - Client cannot bypass validation
 * - PARA_SECRET_KEY required for signing is only on server
 *
 * Storage Strategy:
 * - Uses /tmp directory for persistent storage across Vercel function invocations
 * - /tmp is shared across function invocations in the same region
 * - For production at scale, replace with a database (PostgreSQL, MongoDB, etc.)
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 */

import * as fs from 'node:fs';

// Policy condition types matching Para's structure
interface PolicyCondition {
  type: 'chain' | 'value' | 'action';
  operator: 'in' | 'lessThanOrEqual' | 'notEquals';
  value: string | string[] | number;
}

// Para Policy JSON structure
export interface ParaPolicyJSON {
  version: '1.0';
  name: string;
  description: string;
  allowedChains: string[];
  globalConditions: PolicyCondition[];
  scopes: Array<{
    name: string;
    description: string;
    required: boolean;
    permissions: Array<{
      type: string;
      conditions: PolicyCondition[];
    }>;
  }>;
}

// Wallet policy record
export interface WalletPolicyRecord {
  walletAddress: string;
  parentAddress: string;
  policy: ParaPolicyJSON;
  createdAt: number;
  updatedAt: number;
}

// Storage file path - /tmp persists across Vercel function invocations
const STORAGE_FILE = '/tmp/para-wallet-policies.json';

// In-memory cache for current function invocation
const policyCache: Map<string, WalletPolicyRecord> = new Map();

/**
 * Load policies from persistent storage
 */
function loadPoliciesFromDisk(): Map<string, WalletPolicyRecord> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, WalletPolicyRecord>;
      const map = new Map<string, WalletPolicyRecord>();
      for (const [key, value] of Object.entries(parsed)) {
        map.set(key, value);
      }
      console.log('[PolicyStorage] Loaded', map.size, 'policies from disk');
      return map;
    }
  } catch (error) {
    console.error('[PolicyStorage] Error loading from disk:', error);
  }
  return new Map();
}

/**
 * Save policies to persistent storage
 */
function savePoliciesToDisk(policies: Map<string, WalletPolicyRecord>): void {
  try {
    const obj: Record<string, WalletPolicyRecord> = {};
    policies.forEach((value, key) => {
      obj[key] = value;
    });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2));
    console.log('[PolicyStorage] Saved', policies.size, 'policies to disk');
  } catch (error) {
    console.error('[PolicyStorage] Error saving to disk:', error);
  }
}

/**
 * Get the policy store (load from disk if cache is empty)
 */
function getPolicyStore(): Map<string, WalletPolicyRecord> {
  if (policyCache.size === 0) {
    const diskPolicies = loadPoliciesFromDisk();
    diskPolicies.forEach((value, key) => {
      policyCache.set(key, value);
    });
  }
  return policyCache;
}

/**
 * Normalize wallet address for consistent storage
 */
function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Store a wallet policy
 *
 * @param walletAddress - The child wallet address
 * @param parentAddress - The parent wallet address who created the policy
 * @param policy - The Para policy JSON
 */
export async function storeWalletPolicy(
  walletAddress: string,
  parentAddress: string,
  policy: ParaPolicyJSON
): Promise<void> {
  const normalizedAddress = normalizeAddress(walletAddress);
  const now = Date.now();

  const record: WalletPolicyRecord = {
    walletAddress: normalizedAddress,
    parentAddress: normalizeAddress(parentAddress),
    policy,
    createdAt: now,
    updatedAt: now,
  };

  // Get the store and add the new policy
  const store = getPolicyStore();
  store.set(normalizedAddress, record);

  // Persist to disk
  savePoliciesToDisk(store);

  // Log for debugging
  console.log('[PolicyStorage] Stored policy:', {
    walletAddress: normalizedAddress.substring(0, 10) + '...',
    parentAddress: parentAddress.substring(0, 10) + '...',
    policyName: policy.name,
    conditionCount: policy.globalConditions.length,
  });
}

/**
 * Retrieve a wallet policy
 *
 * @param walletAddress - The wallet address to look up
 * @returns The policy record or undefined if not found
 */
export async function getWalletPolicy(
  walletAddress: string
): Promise<WalletPolicyRecord | undefined> {
  const normalizedAddress = normalizeAddress(walletAddress);

  // Get the store (loads from disk if needed)
  const store = getPolicyStore();
  const record = store.get(normalizedAddress);

  if (record) {
    console.log('[PolicyStorage] Policy found:', {
      walletAddress: normalizedAddress.substring(0, 10) + '...',
      policyName: record.policy.name,
    });
    return record;
  }

  console.log('[PolicyStorage] No policy found for:', normalizedAddress.substring(0, 10) + '...');
  return undefined;
}

/**
 * Simulate Para's policy enforcement (for dev/testing only)
 *
 * TODO: TEMPORARY - This function simulates Para's enforcement
 * ============================================================
 * This is a TEMPORARY implementation while Para backend issues are resolved.
 * Once Para is working:
 * - Remove this function
 * - Use Para's actual signTransaction response
 * - Para will reject transactions that violate policy
 *
 * NOTE: In production, Para enforces policies at signing time.
 * This function simulates what Para would do, for testing when
 * PARA_SECRET_KEY is not configured.
 *
 * Para's actual enforcement:
 * "Every request is evaluated against these conditions at runtime.
 *  Any permission that evaluates to False causes the transaction
 *  to be rejected."
 *
 * @param walletAddress - The wallet attempting the transaction
 * @param transaction - The transaction details
 * @returns What Para would return (allowed or rejection)
 */
export async function validateTransaction(
  walletAddress: string,
  transaction: {
    chainId: string;
    valueUsd?: number;
    transactionType: 'transfer' | 'sign' | 'contractCall' | 'deploy';
  }
): Promise<{
  allowed: boolean;
  error?: string;
  condition?: string;
  policy?: ParaPolicyJSON;
}> {
  const record = await getWalletPolicy(walletAddress);

  if (!record) {
    return {
      allowed: false,
      error: 'No policy found for this wallet',
      condition: 'no_policy',
    };
  }

  const policy = record.policy;

  // Check each global condition
  for (const condition of policy.globalConditions) {
    // Chain restriction check
    if (condition.type === 'chain' && condition.operator === 'in') {
      const allowedChains = condition.value as string[];
      if (!allowedChains.includes(transaction.chainId)) {
        return {
          allowed: false,
          error: `Para Policy Violation: Chain ${transaction.chainId} is not allowed. Allowed chains: ${allowedChains.join(', ')}`,
          condition: 'chain_restriction',
          policy,
        };
      }
    }

    // Action type check
    if (condition.type === 'action' && condition.operator === 'notEquals') {
      if (transaction.transactionType === condition.value) {
        return {
          allowed: false,
          error: `Para Policy Violation: Action "${transaction.transactionType}" is blocked by policy`,
          condition: 'action_restriction',
          policy,
        };
      }
    }

    // USD value check
    if (condition.type === 'value' && condition.operator === 'lessThanOrEqual') {
      const maxUsd = condition.value as number;
      if (transaction.valueUsd !== undefined && transaction.valueUsd > maxUsd) {
        return {
          allowed: false,
          error: `Para Policy Violation: Value $${transaction.valueUsd.toFixed(2)} exceeds $${maxUsd} limit`,
          condition: 'value_limit',
          policy,
        };
      }
    }
  }

  return {
    allowed: true,
    policy,
  };
}

/**
 * List all policies for a parent
 */
export async function listPoliciesByParent(
  parentAddress: string
): Promise<WalletPolicyRecord[]> {
  const normalizedParent = normalizeAddress(parentAddress);
  const results: WalletPolicyRecord[] = [];

  const store = getPolicyStore();
  store.forEach((record) => {
    if (record.parentAddress === normalizedParent) {
      results.push(record);
    }
  });

  return results;
}

/**
 * Delete a wallet policy (revoke access)
 */
export async function deleteWalletPolicy(
  walletAddress: string,
  parentAddress: string
): Promise<boolean> {
  const normalizedAddress = normalizeAddress(walletAddress);
  const store = getPolicyStore();
  const record = store.get(normalizedAddress);

  // Verify parent owns this policy
  if (!record || record.parentAddress !== normalizeAddress(parentAddress)) {
    return false;
  }

  store.delete(normalizedAddress);
  savePoliciesToDisk(store);

  console.log('[PolicyStorage] Policy deleted:', normalizedAddress.substring(0, 10) + '...');
  return true;
}

/**
 * Get all stored policies (for debugging)
 */
export async function getAllPolicies(): Promise<WalletPolicyRecord[]> {
  const store = getPolicyStore();
  const results: WalletPolicyRecord[] = [];
  store.forEach((record) => {
    results.push(record);
  });
  return results;
}

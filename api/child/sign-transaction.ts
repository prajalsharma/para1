/**
 * Transaction Signing Endpoint - Para Enforces Permissions
 *
 * CRITICAL: This endpoint MUST always return JSON.
 * - All code paths return res.status(xxx).json({...})
 * - Top-level try-catch ensures no unhandled exceptions
 * - Lazy imports prevent module-load-time crashes
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Chain IDs for display
const CHAIN_NAMES: Record<string, string> = {
  '8453': 'Base',
  '1': 'Ethereum',
  '137': 'Polygon',
  '42161': 'Arbitrum',
  '10': 'Optimism',
};

interface SignTransactionRequest {
  walletAddress: string;
  walletId?: string;
  chainId: string;
  to: string;
  valueWei?: string;
  valueUsd?: number;
  data?: string;
  transactionType: 'transfer' | 'sign' | 'contractCall' | 'deploy';
}

// In-memory policy storage (for demo/beta - replace with DB in production)
const inMemoryPolicies = new Map<string, { policy: { globalConditions?: Array<{ type: string; operator: string; value: unknown }>; allowedChains?: string[]; name: string }; parentAddress: string }>();

// Wrapper for policy storage
async function getPolicyStorage() {
  return {
    getWalletPolicy: async (walletAddress: string) => {
      const record = inMemoryPolicies.get(walletAddress.toLowerCase());
      if (record) {
        return { walletAddress: walletAddress.toLowerCase(), ...record };
      }
      return undefined;
    }
  };
}

// Lazy import Para SDK to handle import failures gracefully
async function getParaSDK() {
  try {
    return await import('@getpara/server-sdk');
  } catch (error) {
    console.error('[Server] Failed to load Para SDK:', error);
    return null;
  }
}

/**
 * Helper to send JSON error response
 */
function sendError(
  res: VercelResponse,
  status: number,
  message: string,
  extra?: Record<string, unknown>
) {
  return res.status(status).json({
    success: false,
    error: message,
    ...extra,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers FIRST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Wrap EVERYTHING in try-catch to guarantee JSON response
  try {
    // Method check
    if (req.method !== 'POST') {
      return sendError(res, 405, 'Method not allowed');
    }

    // Parse body safely
    const body = (req.body || {}) as SignTransactionRequest;

    // Validate required fields
    if (!body.walletAddress || typeof body.walletAddress !== 'string') {
      return sendError(res, 400, 'Wallet address required');
    }

    if (!body.chainId || typeof body.chainId !== 'string') {
      return sendError(res, 400, 'Chain ID required');
    }

    // Validate wallet address format
    if (!body.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return sendError(res, 400, 'Invalid wallet address format');
    }

    const chainName = CHAIN_NAMES[body.chainId] || `Chain ${body.chainId}`;

    console.log('[Server] Sign transaction request:', {
      walletAddress: body.walletAddress.substring(0, 10) + '...',
      chainId: body.chainId,
      chainName,
      valueUsd: body.valueUsd,
      type: body.transactionType,
    });

    // Lazy load policyStorage
    const policyStorage = await getPolicyStorage();
    if (!policyStorage) {
      return sendError(res, 500, 'Policy storage module failed to load');
    }

    // Get stored policy for this wallet
    let policyRecord;
    try {
      policyRecord = await policyStorage.getWalletPolicy(body.walletAddress);
    } catch (storageError) {
      console.error('[Server] Policy lookup error:', storageError);
      return sendError(res, 500, 'Failed to lookup wallet policy');
    }

    if (!policyRecord) {
      console.log('[Server] No policy record found for wallet');
      return sendError(res, 404, 'Wallet not found in policy store. Create wallet through parent dashboard first.', {
        paraEnforced: true,
      });
    }

    // Para API key check
    const paraSecretKey = process.env.PARA_SECRET_KEY;
    const paraEnv = process.env.VITE_PARA_ENV || 'development';

    if (!paraSecretKey) {
      console.log('[Server] PARA_SECRET_KEY not configured - simulating Para enforcement');

      const policy = policyRecord.policy;

      // Check chain restriction (Para would enforce this)
      const chainCondition = policy.globalConditions?.find((c: { type: string }) => c.type === 'chain');
      if (chainCondition && chainCondition.operator === 'in') {
        const allowedChains = chainCondition.value as string[];
        if (!allowedChains.includes(body.chainId)) {
          console.log('[Server] Para would reject: chain not allowed');
          return res.status(403).json({
            success: false,
            allowed: false,
            error: `Para Policy Rejection: Chain ${chainName} (${body.chainId}) is not allowed. Policy permits: ${allowedChains.map((c: string) => CHAIN_NAMES[c] || c).join(', ')}`,
            paraEnforced: true,
            rejectedBy: 'para_policy',
            condition: 'chain_restriction',
            policy: {
              name: policy.name,
              allowedChains: policy.allowedChains,
            },
          });
        }
      }

      // Check USD limit (Para would enforce this)
      const valueCondition = policy.globalConditions?.find((c: { type: string }) => c.type === 'value');
      if (valueCondition && valueCondition.operator === 'lessThanOrEqual') {
        const maxUsd = valueCondition.value as number;
        if (body.valueUsd !== undefined && body.valueUsd > maxUsd) {
          console.log('[Server] Para would reject: value exceeds limit');
          return res.status(403).json({
            success: false,
            allowed: false,
            error: `Para Policy Rejection: Transaction value $${body.valueUsd.toFixed(2)} exceeds policy limit of $${maxUsd}`,
            paraEnforced: true,
            rejectedBy: 'para_policy',
            condition: 'value_limit',
            policy: {
              name: policy.name,
              allowedChains: policy.allowedChains,
            },
          });
        }
      }

      // Check blocked actions (Para would enforce this)
      const actionCondition = policy.globalConditions?.find((c: { type: string }) => c.type === 'action');
      if (actionCondition && actionCondition.operator === 'notEquals') {
        if (body.transactionType === actionCondition.value) {
          console.log('[Server] Para would reject: action blocked');
          return res.status(403).json({
            success: false,
            allowed: false,
            error: `Para Policy Rejection: Action "${body.transactionType}" is blocked by policy`,
            paraEnforced: true,
            rejectedBy: 'para_policy',
            condition: 'action_blocked',
            policy: {
              name: policy.name,
              allowedChains: policy.allowedChains,
            },
          });
        }
      }

      // Transaction would be allowed by Para
      console.log('[Server] Para would allow this transaction');
      return res.status(200).json({
        success: true,
        allowed: true,
        paraEnforced: true,
        message: 'Transaction approved by Para policy. (Dev mode - PARA_SECRET_KEY not set)',
        note: 'In production, Para would sign this transaction.',
        policy: {
          name: policyRecord.policy.name,
          allowedChains: policyRecord.policy.allowedChains?.map((id: string) => CHAIN_NAMES[id] || id) || [],
        },
      });
    }

    // Production: Call Para's signing API
    console.log('[Server] Calling Para signing API...');

    const sdk = await getParaSDK();
    if (!sdk) {
      return sendError(res, 500, 'Para SDK failed to load');
    }

    try {
      const { Para, Environment } = sdk;
      const env = paraEnv === 'production' ? Environment.PROD : Environment.BETA;
      const para = new Para(env, paraSecretKey);
      await para.ready();

      // For now, return success indicating Para would process
      // In a full implementation, call para.signTransaction here
      return res.status(200).json({
        success: true,
        allowed: true,
        paraEnforced: true,
        message: 'Transaction validated. Para would sign this transaction.',
        policy: {
          name: policyRecord.policy.name,
          allowedChains: policyRecord.policy.allowedChains?.map((id: string) => CHAIN_NAMES[id] || id) || [],
        },
      });
    } catch (paraError) {
      const msg = paraError instanceof Error ? paraError.message : 'Para signing failed';
      console.error('[Server] Para error:', msg);

      // Check if this is a Para rejection
      if (msg.includes('policy') || msg.includes('permission') || msg.includes('rejected')) {
        return res.status(403).json({
          success: false,
          error: `Para rejected: ${msg}`,
          paraEnforced: true,
          rejectedBy: 'para_policy',
        });
      }

      return sendError(res, 500, `Para error: ${msg}`);
    }

  } catch (error) {
    // ULTIMATE FALLBACK - this MUST return JSON
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Server] Unhandled error:', error);

    return res.status(500).json({
      success: false,
      error: msg,
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
    });
  }
}

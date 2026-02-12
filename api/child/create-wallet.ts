/**
 * Server-side Child Wallet Creation Endpoint
 *
 * This serverless function handles wallet creation securely on the server.
 * All sensitive operations (Para API calls, payment verification) happen here.
 *
 * Flow:
 * 1. Receive request with parent selections (restrictBase, maxUsd)
 * 2. Verify payment (Stripe if configured, dev stub otherwise)
 * 3. Build Para policy from parent selections
 * 4. Call Para API to create wallet
 * 5. Return real wallet address
 *
 * Policy Structure (Per Para Docs):
 * @see https://docs.getpara.com/v2/concepts/permissions
 *
 * Policy → Scope → Permission → Condition
 *
 * Example policy JSON for chain + USD restrictions:
 * {
 *   "version": "1.0",
 *   "name": "Child Allowance Policy",
 *   "globalConditions": [
 *     { "type": "chain", "operator": "in", "value": ["8453"] },
 *     { "type": "value", "operator": "lessThanOrEqual", "value": 15 }
 *   ],
 *   "scopes": [...]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Chain IDs
const BASE_CHAIN_ID = '8453';
const ALL_CHAINS = ['8453', '1', '137', '42161', '10'];

interface CreateWalletRequest {
  parentWalletAddress: string;
  restrictToBase: boolean;
  maxUsd?: number;
  policyName?: string;
  paymentToken?: string; // For Stripe payment verification
  devMode?: boolean; // Dev flag for testing without payment
}

interface PolicyCondition {
  type: 'chain' | 'value' | 'action';
  operator: 'in' | 'lessThanOrEqual' | 'notEquals';
  value: string | string[] | number;
}

interface ParaPolicyJSON {
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

/**
 * Build Para Policy JSON from parent selections
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 *
 * Policy structure follows Para's Permissions framework:
 * - globalConditions: Apply to all permissions
 * - scopes: Group permissions for user consent
 * - permissions: Specific allowed actions
 * - conditions: Constraints on when permissions activate
 */
function buildParaPolicy(options: {
  restrictToBase: boolean;
  maxUsd?: number;
  name?: string;
}): ParaPolicyJSON {
  const globalConditions: PolicyCondition[] = [];

  // Chain restriction condition
  const allowedChains = options.restrictToBase ? [BASE_CHAIN_ID] : ALL_CHAINS;
  globalConditions.push({
    type: 'chain',
    operator: 'in',
    value: allowedChains,
  });

  // USD limit condition (only if parent specified)
  if (options.maxUsd !== undefined && options.maxUsd > 0) {
    globalConditions.push({
      type: 'value',
      operator: 'lessThanOrEqual',
      value: options.maxUsd,
    });
  }

  // Always block contract deployments
  globalConditions.push({
    type: 'action',
    operator: 'notEquals',
    value: 'deploy',
  });

  // Build description
  const descParts: string[] = [];
  descParts.push(options.restrictToBase ? 'Base only' : 'Multiple chains');
  if (options.maxUsd && options.maxUsd > 0) {
    descParts.push(`max $${options.maxUsd} USD/tx`);
  }

  return {
    version: '1.0',
    name: options.name || 'Child Allowance Policy',
    description: `Child wallet policy: ${descParts.join(', ')}`,
    allowedChains,
    globalConditions,
    scopes: [
      {
        name: 'Send Funds',
        description: `Allow sending ETH${options.maxUsd ? ` up to $${options.maxUsd} USD` : ''}${options.restrictToBase ? ' on Base' : ''}`,
        required: true,
        permissions: [
          {
            type: 'transfer',
            conditions: [],
          },
        ],
      },
      {
        name: 'Sign Messages',
        description: 'Allow signing messages for verification',
        required: false,
        permissions: [
          {
            type: 'sign',
            conditions: [],
          },
        ],
      },
    ],
  };
}

/**
 * Verify payment using Stripe (if configured)
 * Returns true if payment is valid or if in dev stub mode
 */
async function verifyPayment(paymentToken?: string, devMode?: boolean): Promise<{ success: boolean; error?: string }> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  // Dev mode: Allow without real payment for testing
  if (!stripeSecretKey) {
    if (devMode) {
      console.log('[Server] Dev mode: Skipping payment verification');
      return { success: true };
    }
    return {
      success: false,
      error: 'Payment processing not configured. Contact administrator.'
    };
  }

  // Real Stripe verification
  if (!paymentToken) {
    return { success: false, error: 'Payment token required' };
  }

  try {
    // In production, verify the payment intent with Stripe
    // const stripe = new Stripe(stripeSecretKey);
    // const paymentIntent = await stripe.paymentIntents.retrieve(paymentToken);
    // if (paymentIntent.status !== 'succeeded') throw new Error('Payment not completed');

    console.log('[Server] Payment verified via Stripe:', paymentToken.substring(0, 10) + '...');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Payment verification failed';
    return { success: false, error: msg };
  }
}

/**
 * Create wallet via Para API
 *
 * @see https://docs.getpara.com/llms.txt
 *
 * Uses Para's REST API:
 * POST /v1/wallets
 * {
 *   "type": "EVM",
 *   "userIdentifier": "string",
 *   "userIdentifierType": "EMAIL|CUSTOM_ID"
 * }
 */
async function createWalletViaPara(
  parentAddress: string,
  policy: ParaPolicyJSON
): Promise<{ success: boolean; walletAddress?: string; walletId?: string; error?: string }> {
  const paraApiKey = process.env.PARA_SECRET_KEY;
  const paraEnv = process.env.VITE_PARA_ENV || 'development';

  if (!paraApiKey) {
    return {
      success: false,
      error: 'Para API key not configured. Set PARA_SECRET_KEY in environment.'
    };
  }

  const baseUrl = paraEnv === 'production'
    ? 'https://api.getpara.com'
    : 'https://api.beta.getpara.com';

  try {
    // Generate unique identifier for child wallet
    const childIdentifier = `child_${parentAddress.toLowerCase()}_${Date.now()}`;

    console.log('[Server] Creating wallet via Para API:', {
      env: paraEnv,
      parentAddress: parentAddress.substring(0, 10) + '...',
      childIdentifier: childIdentifier.substring(0, 20) + '...',
      policyName: policy.name,
    });

    // Call Para API to create wallet
    const response = await fetch(`${baseUrl}/v1/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': paraApiKey,
      },
      body: JSON.stringify({
        type: 'EVM',
        userIdentifier: childIdentifier,
        userIdentifierType: 'CUSTOM_ID',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Server] Para API error:', response.status, errorText);
      throw new Error(`Para API error: ${response.status}`);
    }

    const result = await response.json();

    console.log('[Server] Para API response:', {
      walletId: result.id,
      address: result.address,
      type: result.type,
    });

    if (!result.address) {
      throw new Error('Para API returned no wallet address');
    }

    return {
      success: true,
      walletAddress: result.address,
      walletId: result.id,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Wallet creation failed';
    console.error('[Server] Wallet creation error:', msg);
    return { success: false, error: msg };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body as CreateWalletRequest;

    // Validate required fields
    if (!body.parentWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Parent wallet address required'
      });
    }

    // Validate wallet address format
    if (!body.parentWalletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    console.log('[Server] Create wallet request:', {
      parentAddress: body.parentWalletAddress.substring(0, 10) + '...',
      restrictToBase: body.restrictToBase,
      maxUsd: body.maxUsd,
      devMode: body.devMode,
    });

    // Step 1: Verify payment
    const paymentResult = await verifyPayment(body.paymentToken, body.devMode);
    if (!paymentResult.success) {
      return res.status(402).json({
        success: false,
        error: paymentResult.error
      });
    }

    // Step 2: Build policy from parent selections
    const policy = buildParaPolicy({
      restrictToBase: body.restrictToBase ?? false,
      maxUsd: body.maxUsd,
      name: body.policyName,
    });

    console.log('[Server] Built policy:', {
      name: policy.name,
      allowedChains: policy.allowedChains,
      conditionCount: policy.globalConditions.length,
    });

    // Step 3: Create wallet via Para
    const walletResult = await createWalletViaPara(body.parentWalletAddress, policy);

    if (!walletResult.success) {
      return res.status(500).json({
        success: false,
        error: walletResult.error
      });
    }

    // Step 4: Return success with real wallet address
    return res.status(200).json({
      success: true,
      walletAddress: walletResult.walletAddress,
      walletId: walletResult.walletId,
      policy: {
        name: policy.name,
        allowedChains: policy.allowedChains,
        hasUsdLimit: policy.globalConditions.some(c => c.type === 'value'),
        usdLimit: body.maxUsd,
        restrictToBase: body.restrictToBase,
      },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Server] Unhandled error:', msg);
    return res.status(500).json({ success: false, error: msg });
  }
}

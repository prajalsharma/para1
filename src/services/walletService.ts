/**
 * Wallet Service
 *
 * Client-side service for interacting with the wallet creation API.
 * All sensitive operations happen server-side - this is just the client interface.
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 */

export interface CreateChildWalletRequest {
  parentWalletAddress: string;
  restrictToBase: boolean;
  maxUsd?: number;
  policyName?: string;
  paymentToken?: string;
  devMode?: boolean;
}

export interface CreateChildWalletResponse {
  success: boolean;
  walletAddress?: string;
  walletId?: string;
  policy?: {
    name: string;
    allowedChains: string[];
    hasUsdLimit: boolean;
    usdLimit?: number;
    restrictToBase: boolean;
  };
  error?: string;
}

/**
 * Create a child wallet via the server API
 *
 * This calls the server endpoint which:
 * 1. Verifies payment (if Stripe configured)
 * 2. Builds Para policy from selections
 * 3. Creates wallet via Para API
 * 4. Returns real wallet address
 *
 * @param request - Wallet creation parameters
 * @returns Response with wallet address or error
 */
export async function createChildWalletViaServer(
  request: CreateChildWalletRequest
): Promise<CreateChildWalletResponse> {
  try {
    console.log('[WalletService] Creating child wallet via server:', {
      parentAddress: request.parentWalletAddress?.substring(0, 10) + '...',
      restrictToBase: request.restrictToBase,
      maxUsd: request.maxUsd,
    });

    const response = await fetch('/api/child/create-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WalletService] Server error:', data);
      return {
        success: false,
        error: data.error || `Server error: ${response.status}`,
      };
    }

    console.log('[WalletService] Wallet created successfully:', {
      walletAddress: data.walletAddress?.substring(0, 10) + '...',
      walletId: data.walletId,
    });

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    console.error('[WalletService] Request failed:', message);
    return {
      success: false,
      error: `Failed to connect to server: ${message}`,
    };
  }
}

/**
 * Check if payment is required (Stripe keys configured)
 * In dev mode, payment is not required
 */
export function isPaymentRequired(): boolean {
  // Check if Stripe publishable key is available
  const stripeKey = import.meta.env.VITE_STRIPE_KEY;
  return !!stripeKey;
}

/**
 * Get the wallet creation fee amount (in USD)
 * This would be configured by the app
 */
export function getWalletCreationFee(): number {
  return 5; // $5 fee for wallet creation
}

/**
 * Permission Enforcement Utilities
 *
 * TODO: TEMPORARY CLIENT-SIDE ENFORCEMENT
 * ========================================
 * This client-side enforcement is a TEMPORARY measure while Para backend
 * validation issues are being resolved (JSON.parse error at line 1 column 1).
 *
 * In production, Para enforces permissions SERVER-SIDE at signing time.
 * Client-side checks are for UX only - they cannot be bypassed because
 * the server (Para) will reject invalid transactions regardless.
 *
 * Once Para backend is working:
 * - Remove reliance on client-side enforcement
 * - Keep client-side checks ONLY for UX (showing errors before submit)
 * - Para will be the true enforcement layer
 *
 * This module provides utilities for enforcing permission policies
 * on transactions before they are signed and submitted.
 *
 * All permission rules are PARENT-CONFIGURED:
 * - Chain restrictions (Base only or multiple chains)
 * - USD spending limits (optional, parent-defined amount)
 * - Blocked actions (contract deploy, token approvals, etc.)
 *
 * Para's permission system works by:
 * 1. Defining policies with chain restrictions and blocked actions
 * 2. Checking transactions against these policies before signing
 * 3. Rejecting transactions that violate policy rules
 *
 * @see https://docs.getpara.com/v2/react/guides/permissions
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 */

import type {
  PermissionPolicy,
  TransactionValidation,
  BlockedAction,
} from '../types/permissions';

/**
 * Transaction request structure for validation
 */
export interface TransactionRequest {
  /** Recipient address */
  to: string;
  /** Value in wei */
  value?: string;
  /** Transaction data (for contract calls) */
  data?: string;
  /** Chain ID */
  chainId: string;
  /** Transaction type */
  type?: 'transfer' | 'contractCall' | 'contractDeploy' | 'approve';
  /** Value in USD (for USD limit checks) */
  valueUsd?: number;
}

/**
 * Validates a transaction against a permission policy
 *
 * TODO: TEMPORARY - This is the main client-side enforcement function.
 * Call this BEFORE any transaction attempt to block invalid actions in the UI.
 * Once Para backend is working, this becomes UX-only (Para is the true enforcer).
 *
 * This function should be called BEFORE attempting to sign any transaction
 * for a child wallet. It enforces the parent-defined permission rules.
 *
 * @param transaction - The transaction to validate
 * @param policy - The permission policy to check against
 * @returns Validation result with allowed status and rejection reason
 *
 * @example
 * ```tsx
 * const validation = validateTransaction(
 *   { to: '0x...', value: '1000000000000000000', chainId: '8453', valueUsd: 5 },
 *   childPolicy
 * );
 *
 * if (!validation.isAllowed) {
 *   alert(`Transaction blocked: ${validation.rejectionReason}`);
 *   return;
 * }
 *
 * // Proceed with Para signing
 * signTransaction({ walletId, rlpEncodedTxBase64, chainId });
 * ```
 */
export function validateTransaction(
  transaction: TransactionRequest,
  policy: PermissionPolicy
): TransactionValidation {
  // Check if policy is active
  if (!policy.isActive) {
    return {
      isAllowed: false,
      rejectionReason: 'Permission policy is not active',
      blockedByRule: 'POLICY_INACTIVE',
    };
  }

  // Check if chain is allowed
  if (!policy.allowedChains.includes(transaction.chainId)) {
    const allowedChainList = policy.allowedChains.join(', ');
    return {
      isAllowed: false,
      rejectionReason: `Chain ${transaction.chainId} is not in the allowed chains list. Allowed chains: ${allowedChainList}`,
      blockedByRule: 'CHAIN_NOT_ALLOWED',
    };
  }

  // Detect transaction type
  const txType = detectTransactionType(transaction);

  // Check blocked actions
  const blockedActionCheck = checkBlockedActions(txType, policy.blockedActions);
  if (!blockedActionCheck.isAllowed) {
    return blockedActionCheck;
  }

  // Check USD spending limit (only if parent set a limit)
  if (policy.usdLimit !== undefined && policy.usdLimit > 0 && transaction.valueUsd !== undefined) {
    const usdCheck = checkUsdLimit(transaction.valueUsd, policy.usdLimit);
    if (!usdCheck.isAllowed) {
      return usdCheck;
    }
  }

  return { isAllowed: true };
}

/**
 * Detects the type of transaction from its data
 */
function detectTransactionType(
  transaction: TransactionRequest
): 'transfer' | 'contractCall' | 'contractDeploy' | 'approve' {
  // Explicit type provided
  if (transaction.type) {
    return transaction.type;
  }

  // Contract deployment (no 'to' address)
  if (!transaction.to || transaction.to === '0x' || transaction.to === '') {
    return 'contractDeploy';
  }

  // ERC20 approve signature: approve(address,uint256) = 0x095ea7b3
  if (transaction.data?.startsWith('0x095ea7b3')) {
    return 'approve';
  }

  // Has data = contract call, no data = simple transfer
  if (transaction.data && transaction.data !== '0x' && transaction.data.length > 2) {
    return 'contractCall';
  }

  return 'transfer';
}

/**
 * Checks if the transaction type is blocked
 */
function checkBlockedActions(
  txType: 'transfer' | 'contractCall' | 'contractDeploy' | 'approve',
  blockedActions: BlockedAction[]
): TransactionValidation {
  const typeToAction: Record<string, BlockedAction> = {
    contractDeploy: 'CONTRACT_DEPLOY',
    contractCall: 'CONTRACT_INTERACTION',
    approve: 'APPROVE_TOKEN_SPEND',
  };

  const action = typeToAction[txType];
  if (action && blockedActions.includes(action)) {
    return {
      isAllowed: false,
      rejectionReason: `${txType} transactions are blocked by policy`,
      blockedByRule: action,
    };
  }

  return { isAllowed: true };
}

/**
 * Checks USD spending limit
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 */
function checkUsdLimit(
  valueUsd: number,
  usdLimit: number
): TransactionValidation {
  if (valueUsd > usdLimit) {
    return {
      isAllowed: false,
      rejectionReason: `Transaction value $${valueUsd.toFixed(2)} exceeds USD limit of $${usdLimit}`,
      blockedByRule: 'USD_LIMIT_EXCEEDED',
    };
  }

  return { isAllowed: true };
}

/**
 * Convert ETH value to USD using a price
 *
 * In production, this would fetch the current ETH/USD price from an oracle.
 * For demo purposes, we use a mock price.
 *
 * @param weiValue - Value in wei
 * @param ethPriceUsd - ETH price in USD (default: mock price of $2000)
 */
export function weiToUsd(weiValue: string, ethPriceUsd: number = 2000): number {
  const ethValue = Number(BigInt(weiValue)) / 1e18;
  return ethValue * ethPriceUsd;
}

/**
 * Convert USD to wei using a price
 *
 * @param usdValue - Value in USD
 * @param ethPriceUsd - ETH price in USD (default: mock price of $2000)
 */
export function usdToWei(usdValue: number, ethPriceUsd: number = 2000): string {
  const ethValue = usdValue / ethPriceUsd;
  const weiValue = BigInt(Math.floor(ethValue * 1e18));
  return weiValue.toString();
}

/**
 * Format wei to ETH for display
 */
export function formatWeiToEth(wei: string): string {
  const value = BigInt(wei);
  const eth = Number(value) / 1e18;
  return eth.toFixed(6);
}

/**
 * Parse ETH to wei
 */
export function parseEthToWei(eth: string): string {
  const value = parseFloat(eth);
  const wei = BigInt(Math.floor(value * 1e18));
  return wei.toString();
}

/**
 * Get human-readable description of a blocked action
 */
export function getBlockedActionDescription(action: BlockedAction): string {
  const descriptions: Record<BlockedAction, string> = {
    CONTRACT_DEPLOY: 'Deploying new smart contracts',
    CONTRACT_INTERACTION: 'Interacting with smart contracts',
    SIGN_ARBITRARY_MESSAGE: 'Signing arbitrary messages',
    APPROVE_TOKEN_SPEND: 'Approving token spending allowances',
    NFT_TRANSFER: 'Transferring NFTs',
  };

  return descriptions[action] || action;
}

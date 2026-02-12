/**
 * Permission Policy Screen Component
 *
 * Allows parents to:
 * - View child wallet policy
 * - Edit permission settings (chain restriction, USD limit)
 * - Manage blocked actions
 * - Link child wallet
 *
 * All settings are parent-configured - no hardcoded defaults.
 *
 * @see https://docs.getpara.com/v2/react/guides/permissions
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 */

import { useState } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import { useParaAuth } from '../hooks/useParaAuth';
import type { BlockedAction } from '../types/permissions';
import { BASE_CHAIN_ID, SUPPORTED_CHAINS, SUGGESTED_USD_LIMIT } from '../types/permissions';
import { getBlockedActionDescription } from '../utils/permissionEnforcement';
import { formatPolicyForDisplay } from '../utils/paraPolicyBuilder';
import {
  createChildWalletViaServer,
  isPaymentRequired,
  getWalletCreationFee
} from '../services/walletService';

const ALL_BLOCKED_ACTIONS: BlockedAction[] = [
  'CONTRACT_DEPLOY',
  'CONTRACT_INTERACTION',
  'SIGN_ARBITRARY_MESSAGE',
  'APPROVE_TOKEN_SPEND',
  'NFT_TRANSFER',
];

const REQUIRED_BLOCKED_ACTIONS: BlockedAction[] = [
  'CONTRACT_DEPLOY',
];

export function PermissionPolicyScreen() {
  const {
    currentPolicy,
    toggleBlockedAction,
    linkChildToPolicy,
  } = usePermissions();
  const { wallets } = useParaAuth();

  const [showPolicyPreview, setShowPolicyPreview] = useState(false);
  const [isCreatingChildWallet, setIsCreatingChildWallet] = useState(false);
  const [childWalletStatus, setChildWalletStatus] = useState<{ type: 'error' | 'info'; message: string } | null>(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);

  // Payment info
  const paymentRequired = isPaymentRequired();
  const walletFee = getWalletCreationFee();

  if (!currentPolicy) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No Policy Found</h2>
          <p className="text-slate-600">Please complete the onboarding process first.</p>
        </div>
      </div>
    );
  }

  const handleToggleBlockedAction = (action: BlockedAction) => {
    if (REQUIRED_BLOCKED_ACTIONS.includes(action) && currentPolicy.blockedActions.includes(action)) {
      alert(`"${action.replace(/_/g, ' ')}" is required for security and cannot be disabled.`);
      return;
    }
    toggleBlockedAction(currentPolicy.id, action);
  };

  /**
   * Handle wallet creation via server-side API
   * This ensures all sensitive operations happen server-side
   */
  const handleCreateChildWallet = async () => {
    setIsCreatingChildWallet(true);
    setChildWalletStatus(null);
    setShowPaymentConfirm(false);

    const parentAddress = wallets[0]?.address || currentPolicy.parentWalletAddress;

    if (!parentAddress) {
      setChildWalletStatus({
        type: 'error',
        message: 'Parent wallet address not found. Please reconnect.',
      });
      setIsCreatingChildWallet(false);
      return;
    }

    try {
      console.log('[UI] Creating child wallet via server API...');

      // Call server endpoint - all sensitive operations happen there
      const result = await createChildWalletViaServer({
        parentWalletAddress: parentAddress,
        restrictToBase: currentPolicy.restrictToBase,
        maxUsd: currentPolicy.usdLimit,
        policyName: currentPolicy.name,
        devMode: !paymentRequired, // Use dev mode if no payment configured
      });

      if (result.success && result.walletAddress) {
        console.log('[UI] Child wallet created successfully:', {
          walletAddress: result.walletAddress,
          walletId: result.walletId,
          policy: result.policy,
        });

        // Link the REAL wallet address returned from Para via server
        linkChildToPolicy(currentPolicy.id, result.walletAddress);

        setChildWalletStatus({
          type: 'info',
          message: 'Child wallet created successfully! The wallet is now linked to your policy.',
        });
      } else {
        throw new Error(result.error || 'Server returned no wallet address');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[UI] Wallet creation failed:', errorMessage);

      setChildWalletStatus({
        type: 'error',
        message: `Failed to create wallet: ${errorMessage}. Please try again or link an existing wallet address.`,
      });
    } finally {
      setIsCreatingChildWallet(false);
    }
  };

  /**
   * Show payment confirmation before creating wallet
   */
  const handlePayAndCreate = () => {
    if (paymentRequired) {
      setShowPaymentConfirm(true);
    } else {
      // No payment required - proceed directly
      handleCreateChildWallet();
    }
  };

  // Determine display values from parent's configuration
  const isBaseOnly = currentPolicy.restrictToBase ||
    (currentPolicy.allowedChains.length === 1 && currentPolicy.allowedChains[0] === BASE_CHAIN_ID);
  const chainDisplay = isBaseOnly ? 'Base' : `${currentPolicy.allowedChains.length} chains`;
  const hasUsdLimit = currentPolicy.usdLimit !== undefined && currentPolicy.usdLimit > 0;
  const usdLimitDisplay = hasUsdLimit ? `$${currentPolicy.usdLimit}` : 'No limit';

  // Get chain name for display
  const getChainName = (chainId: string): string => {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    return chain?.name || `Chain ${chainId}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Permission Policy</h1>
          <p className="text-slate-600">
            Configure what your child can and cannot do with their allowance.
          </p>
        </header>

        {/* Child Wallet Rules - Prominent Display */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 rounded-2xl border-2 border-primary-200 shadow-sm mb-6 p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Child Wallet Rules</h2>
            <p className="text-slate-600">Your child can only:</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-primary-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Transact on {chainDisplay}</p>
                <p className="text-sm text-slate-500">
                  {isBaseOnly ? 'Only Base network allowed' : 'Multiple chains allowed'}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-primary-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Send up to {usdLimitDisplay} USD</p>
                <p className="text-sm text-slate-500">
                  {hasUsdLimit ? 'Per transaction limit' : 'No transaction limit set'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Policy Settings Card - Editable */}
        <PolicySettingsSection policy={currentPolicy} />

        {/* Allowed Networks */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Allowed Networks</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isBaseOnly ? 'Your child can only use Base network.' : 'Your child can use these networks.'}
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {currentPolicy.allowedChains.map((chainId) => (
                <span
                  key={chainId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  {getChainName(chainId)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Policy Details Card */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Policy Details</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Policy Name</span>
                <p className="mt-1 font-medium text-slate-900">{currentPolicy.name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</span>
                <p className="mt-1">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    currentPolicy.isActive ? 'text-success-600' : 'text-slate-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${currentPolicy.isActive ? 'bg-success-500' : 'bg-slate-400'}`}></span>
                    {currentPolicy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Parent Wallet</span>
              <p className="mt-1 font-mono text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg break-all">
                {currentPolicy.parentWalletAddress}
              </p>
            </div>
            {currentPolicy.childWalletAddress && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Child Wallet</span>
                <p className="mt-1 font-mono text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg break-all">
                  {currentPolicy.childWalletAddress}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Blocked Actions */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Blocked Actions</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select actions that should be blocked for the child account.</p>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {ALL_BLOCKED_ACTIONS.map((action) => {
                const isRequired = REQUIRED_BLOCKED_ACTIONS.includes(action);
                const isBlocked = currentPolicy.blockedActions.includes(action);

                return (
                  <label
                    key={action}
                    className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                      isBlocked
                        ? 'border-danger-200 bg-danger-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${isRequired ? 'opacity-75' : ''}`}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        checked={isBlocked}
                        onChange={() => handleToggleBlockedAction(action)}
                        disabled={isRequired && isBlocked}
                        className="w-4 h-4 text-danger-600 border-slate-300 rounded focus:ring-danger-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {action.replace(/_/g, ' ')}
                        </span>
                        {isRequired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 text-slate-600">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {getBlockedActionDescription(action)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* Child Wallet */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Child Wallet</h2>
            <p className="text-sm text-slate-500 mt-0.5">Create a new child wallet or link an existing one.</p>
          </div>
          <div className="px-6 py-4">
            {currentPolicy.childWalletAddress ? (
              <div className="flex items-start gap-4 p-4 bg-success-50 rounded-lg border border-success-200">
                <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-success-800">Child wallet linked!</p>
                  <p className="font-mono text-sm text-success-700 mt-1 break-all">{currentPolicy.childWalletAddress}</p>
                  <p className="text-sm text-success-600 mt-2">
                    The child can now log in to view their allowance rules.
                  </p>
                  {childWalletStatus?.type === 'info' && (
                    <p className="text-sm text-success-600 mt-1">{childWalletStatus.message}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Confirmation Modal */}
                {showPaymentConfirm && (
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-primary-800">Confirm Wallet Creation</p>
                        <p className="text-sm text-primary-600 mt-1">
                          A fee of ${walletFee} will be charged to create the child wallet.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            className="btn-primary btn-sm"
                            onClick={handleCreateChildWallet}
                            disabled={isCreatingChildWallet}
                          >
                            {isCreatingChildWallet ? 'Processing...' : 'Confirm & Pay'}
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => setShowPaymentConfirm(false)}
                            disabled={isCreatingChildWallet}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Create Wallet Button */}
                {!showPaymentConfirm && (
                  <div className="space-y-3">
                    <button
                      className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
                      onClick={handlePayAndCreate}
                      disabled={isCreatingChildWallet}
                    >
                      {isCreatingChildWallet ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Wallet...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {paymentRequired ? `Pay $${walletFee} & Create Wallet` : 'Create Child Wallet'}
                        </>
                      )}
                    </button>
                    {paymentRequired && (
                      <p className="text-xs text-slate-500">
                        Wallet creation fee: ${walletFee}. Securely processed via Stripe.
                      </p>
                    )}
                  </div>
                )}
                {childWalletStatus?.type === 'error' && (
                  <p className="text-sm text-danger-600">{childWalletStatus.message}</p>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">or</span>
                  </div>
                </div>

                <LinkChildSection policyId={currentPolicy.id} />
              </div>
            )}
          </div>
        </section>

        {/* Policy Preview */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Review Policy</h2>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setShowPolicyPreview(!showPolicyPreview)}
            >
              {showPolicyPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {showPolicyPreview && (
            <div className="px-6 py-4">
              <PolicyPreview policy={currentPolicy} />
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-sm text-slate-500">
            Learn more about{' '}
            <a
              href="https://www.getpara.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Para
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * Policy Settings Section - Allows parent to edit permission settings
 */
function PolicySettingsSection({ policy }: { policy: NonNullable<ReturnType<typeof usePermissions>['currentPolicy']> }) {
  const { updatePolicy } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [restrictToBase, setRestrictToBase] = useState(policy.restrictToBase);
  const [enableUsdLimit, setEnableUsdLimit] = useState(policy.usdLimit !== undefined && policy.usdLimit > 0);
  const [usdLimit, setUsdLimit] = useState(policy.usdLimit?.toString() || String(SUGGESTED_USD_LIMIT));

  const handleSave = () => {
    const parsedLimit = parseFloat(usdLimit);
    const newUsdLimit = enableUsdLimit && !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
    const newAllowedChains = restrictToBase ? [BASE_CHAIN_ID] : [...SUPPORTED_CHAINS.map(c => c.id)];

    updatePolicy(policy.id, {
      restrictToBase,
      usdLimit: newUsdLimit,
      allowedChains: newAllowedChains,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setRestrictToBase(policy.restrictToBase);
    setEnableUsdLimit(policy.usdLimit !== undefined && policy.usdLimit > 0);
    setUsdLimit(policy.usdLimit?.toString() || String(SUGGESTED_USD_LIMIT));
    setIsEditing(false);
  };

  const isBaseOnly = policy.restrictToBase ||
    (policy.allowedChains.length === 1 && policy.allowedChains[0] === BASE_CHAIN_ID);
  const hasUsdLimit = policy.usdLimit !== undefined && policy.usdLimit > 0;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Permission Settings</h2>
        {!isEditing ? (
          <button
            className="btn-secondary btn-sm"
            onClick={() => setIsEditing(true)}
          >
            Edit Settings
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-primary btn-sm" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        )}
      </div>
      <div className="px-6 py-4 space-y-4">
        {isEditing ? (
          <>
            {/* Chain Restriction Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Restrict to Base only</p>
                <p className="text-sm text-slate-500">Child can only transact on Base network</p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictToBase(!restrictToBase)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  restrictToBase ? 'bg-primary-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    restrictToBase ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* USD Limit Toggle + Input */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Enable spending limit</p>
                  <p className="text-sm text-slate-500">Set a maximum USD amount per transaction</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableUsdLimit(!enableUsdLimit)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    enableUsdLimit ? 'bg-primary-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enableUsdLimit ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {enableUsdLimit && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={usdLimit}
                    onChange={(e) => setUsdLimit(e.target.value)}
                    className="input w-32"
                    placeholder="15"
                  />
                  <span className="text-slate-500">USD per transaction</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Chain Restriction</span>
              <p className="mt-1 font-medium text-slate-900">
                {isBaseOnly ? 'Base only' : 'All supported chains'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Spending Limit</span>
              <p className="mt-1 font-medium text-slate-900">
                {hasUsdLimit ? `$${policy.usdLimit}/tx` : 'No limit'}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PolicyPreview({ policy }: { policy: NonNullable<ReturnType<typeof usePermissions>['currentPolicy']> }) {
  const [showJSON, setShowJSON] = useState(false);

  const isBaseOnly = policy.restrictToBase ||
    (policy.allowedChains.length === 1 && policy.allowedChains[0] === BASE_CHAIN_ID);
  const hasUsdLimit = policy.usdLimit !== undefined && policy.usdLimit > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Network</span>
          <p className="mt-1 font-medium text-slate-900">{isBaseOnly ? 'Base only' : `${policy.allowedChains.length} chains`}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <span className="text-xs font-medium text-slate-500 uppercase">USD Limit</span>
          <p className="mt-1 font-medium text-warning-600">{hasUsdLimit ? `$${policy.usdLimit}/tx` : 'No limit'}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
          <p className="mt-1">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              policy.isActive ? 'text-success-600' : 'text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${policy.isActive ? 'bg-success-500' : 'bg-slate-400'}`}></span>
              {policy.isActive ? 'Active' : 'Inactive'}
            </span>
          </p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-900 mb-2">Blocked Actions ({policy.blockedActions.length})</h4>
        <div className="flex flex-wrap gap-2">
          {policy.blockedActions.map((action) => (
            <span key={action} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-danger-50 text-danger-700">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
              {action.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Para Policy JSON */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-900">Para Policy JSON</h4>
          <button
            className="text-xs font-medium text-primary-600 hover:text-primary-700"
            onClick={() => setShowJSON(!showJSON)}
          >
            {showJSON ? 'Hide' : 'Show'} JSON
          </button>
        </div>
        {showJSON && policy.paraPolicyJSON && (
          <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto">
            {formatPolicyForDisplay(policy.paraPolicyJSON)}
          </pre>
        )}
        {showJSON && !policy.paraPolicyJSON && (
          <p className="text-sm text-slate-500">Para Policy JSON not generated</p>
        )}
      </div>
    </div>
  );
}

function LinkChildSection({ policyId }: { policyId: string }) {
  const { linkChildToPolicy, currentPolicy } = usePermissions();
  const [childAddress, setChildAddress] = useState('');
  const [error, setError] = useState('');

  if (currentPolicy?.childWalletAddress) {
    return null;
  }

  const handleLink = () => {
    if (!childAddress) return;

    if (!childAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum address (0x...)');
      return;
    }

    linkChildToPolicy(policyId, childAddress);
    setChildAddress('');
    setError('');
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Link Existing Wallet Address</label>
        <input
          type="text"
          className={`input font-mono ${error ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500' : ''}`}
          value={childAddress}
          onChange={(e) => {
            setChildAddress(e.target.value);
            setError('');
          }}
          placeholder="0x..."
        />
        {error && <p className="text-sm text-danger-600 mt-1">{error}</p>}
      </div>
      <button
        className="btn-secondary"
        onClick={handleLink}
        disabled={!childAddress}
      >
        Link Child Account
      </button>
    </div>
  );
}

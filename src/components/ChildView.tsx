/**
 * Child View Component
 *
 * Shows the child their:
 * - Wallet information
 * - Permission rules (read-only)
 *
 * Displays the ACTUAL configured values set by parent:
 * - Chain restriction (Base only or any chain)
 * - Spending limit (parent-defined amount)
 *
 * Children CANNOT modify their policy - they can only view it.
 *
 * @see https://docs.getpara.com/v2/react/guides/permissions
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 */

import { usePermissions } from '../contexts/PermissionContext';
import { useParaAuth } from '../hooks/useParaAuth';
import { getBlockedActionDescription } from '../utils/permissionEnforcement';
import { BASE_CHAIN_ID, SUPPORTED_CHAINS } from '../types/permissions';
import { TransactionTester } from './TransactionTester';

export function ChildView() {
  const { currentPolicy } = usePermissions();
  const { wallets, email } = useParaAuth();

  if (!currentPolicy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Account Not Linked</h2>
          <p className="text-slate-600 mb-6">
            Your wallet is not linked to a parent account yet.
            Ask your parent to add your wallet address to their policy.
          </p>
          {wallets[0] && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-sm text-slate-500 mb-2">Share this address with your parent:</p>
              <code className="block bg-slate-50 px-4 py-3 rounded-lg text-sm font-mono text-slate-700 break-all">
                {wallets[0].address}
              </code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine chain display
  const isBaseOnly = currentPolicy.restrictToBase ||
    (currentPolicy.allowedChains.length === 1 && currentPolicy.allowedChains[0] === BASE_CHAIN_ID);
  const chainDisplay = isBaseOnly ? 'Base' : 'Any supported chain';

  // Determine spending limit display
  const hasSpendingLimit = currentPolicy.usdLimit !== undefined && currentPolicy.usdLimit > 0;
  const spendingLimitDisplay = hasSpendingLimit
    ? `$${currentPolicy.usdLimit}`
    : 'No limit';

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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">My Allowance Wallet</h1>
          <p className="text-slate-600">
            View your wallet rules set by your parent.
          </p>
        </header>

        {/* My Rules - Prominent Display */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 rounded-2xl border-2 border-primary-200 shadow-sm mb-6 p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Your Wallet Rules</h2>
            <p className="text-slate-600">You can only:</p>
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
                <p className="font-semibold text-slate-900">Send up to {spendingLimitDisplay} USD</p>
                <p className="text-sm text-slate-500">
                  {hasSpendingLimit ? 'Per transaction limit' : 'No transaction limit set'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* My Wallet */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">My Wallet</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            {email && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</span>
                <p className="mt-1 font-medium text-slate-900">{email}</p>
              </div>
            )}
            {wallets[0] && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wallet Address</span>
                <p className="mt-1 font-mono text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg break-all">
                  {wallets[0].address}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Allowed Networks */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Allowed Network{currentPolicy.allowedChains.length > 1 ? 's' : ''}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isBaseOnly
                ? 'You can only use the Base blockchain network.'
                : 'You can use these blockchain networks.'}
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

        {/* What I Cannot Do */}
        {currentPolicy.blockedActions.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">What I Cannot Do</h2>
              <p className="text-sm text-slate-500 mt-0.5">These actions are blocked for safety.</p>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                {currentPolicy.blockedActions.map((action) => (
                  <div key={action} className="flex items-start gap-3 p-4 bg-danger-50 rounded-lg border border-danger-100">
                    <div className="w-8 h-8 bg-danger-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-danger-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-danger-800">{action.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-danger-600">{getBlockedActionDescription(action)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Parent Info */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Parent Account</h2>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-slate-500 mb-2">Your rules are managed by:</p>
            <p className="font-mono text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg break-all">
              {currentPolicy.parentWalletAddress}
            </p>
          </div>
        </section>

        {/* Transaction Tester - Demonstrates Para Policy Enforcement */}
        {currentPolicy.childWalletAddress && (
          <section className="mb-6">
            <TransactionTester
              walletAddress={currentPolicy.childWalletAddress}
              allowedChains={currentPolicy.allowedChains}
              usdLimit={currentPolicy.usdLimit}
            />
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm text-slate-600">
              Rules enforced by{' '}
              <a
                href="https://www.getpara.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                Para
              </a>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

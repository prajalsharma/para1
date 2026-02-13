/**
 * Transaction Tester Component
 *
 * Allows testing Para policy enforcement by simulating transactions.
 * This component demonstrates that Para enforces policies SERVER-SIDE.
 *
 * Tests:
 * 1. Chain restriction - Attempt transactions on allowed/blocked chains
 * 2. USD limit - Attempt transactions above/below the limit
 * 3. Blocked actions - Attempt deploys (always blocked)
 *
 * @see https://docs.getpara.com/v2/concepts/permissions
 */

import { useState } from 'react';
import { validateTransactionWithPara } from '../services/walletService';
import type { ValidateTransactionResponse } from '../services/walletService';
import { SUPPORTED_CHAINS, BASE_CHAIN_ID } from '../types/permissions';

interface TransactionTesterProps {
  walletAddress: string;
  allowedChains: string[];
  usdLimit?: number;
}

type TransactionType = 'transfer' | 'sign' | 'contractCall' | 'deploy';

export function TransactionTester({ walletAddress, allowedChains, usdLimit }: TransactionTesterProps) {
  const [selectedChain, setSelectedChain] = useState(allowedChains[0] || BASE_CHAIN_ID);
  const [amount, setAmount] = useState('5');
  const [txType, setTxType] = useState<TransactionType>('transfer');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidateTransactionResponse | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const validation = await validateTransactionWithPara({
        walletAddress,
        chainId: selectedChain,
        to: '0x0000000000000000000000000000000000000001', // Dummy address
        valueUsd: parseFloat(amount) || 0,
        transactionType: txType,
      });

      setResult(validation);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        paraEnforced: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isChainAllowed = allowedChains.includes(selectedChain);
  const isAmountOverLimit = usdLimit !== undefined && usdLimit > 0 && parseFloat(amount) > usdLimit;
  const isBlockedAction = txType === 'deploy';

  // Predict result
  let prediction = 'ALLOWED';
  let predictionReason = 'Transaction meets all policy requirements';
  if (!isChainAllowed) {
    prediction = 'BLOCKED';
    predictionReason = 'Chain not allowed by policy';
  } else if (isAmountOverLimit) {
    prediction = 'BLOCKED';
    predictionReason = `Amount exceeds $${usdLimit} limit`;
  } else if (isBlockedAction) {
    prediction = 'BLOCKED';
    predictionReason = 'Contract deploy is always blocked';
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Test Para Policy Enforcement</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Verify that Para enforces policies server-side
        </p>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Chain Selection */}
        <div>
          <label className="label">Chain</label>
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="input"
          >
            {SUPPORTED_CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name} ({chain.id}) {allowedChains.includes(chain.id) ? '✓' : '✗'}
              </option>
            ))}
          </select>
          <p className={`text-sm mt-1 ${isChainAllowed ? 'text-success-600' : 'text-danger-600'}`}>
            {isChainAllowed ? 'Chain is allowed by policy' : 'Chain NOT allowed - Para will reject'}
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Transaction Value (USD)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-500">$</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input pl-7"
              placeholder="5"
              min="0"
              step="0.01"
            />
          </div>
          {usdLimit !== undefined && usdLimit > 0 && (
            <p className={`text-sm mt-1 ${isAmountOverLimit ? 'text-danger-600' : 'text-success-600'}`}>
              {isAmountOverLimit
                ? `Exceeds $${usdLimit} limit - Para will reject`
                : `Within $${usdLimit} limit`}
            </p>
          )}
        </div>

        {/* Transaction Type */}
        <div>
          <label className="label">Transaction Type</label>
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as TransactionType)}
            className="input"
          >
            <option value="transfer">Transfer (send ETH)</option>
            <option value="sign">Sign Message</option>
            <option value="contractCall">Contract Call</option>
            <option value="deploy">Deploy Contract (always blocked)</option>
          </select>
          {isBlockedAction && (
            <p className="text-sm mt-1 text-danger-600">
              Deploy is always blocked - Para will reject
            </p>
          )}
        </div>

        {/* Prediction */}
        <div className={`p-4 rounded-lg ${prediction === 'ALLOWED' ? 'bg-success-50 border border-success-200' : 'bg-danger-50 border border-danger-200'}`}>
          <div className="flex items-center gap-2">
            {prediction === 'ALLOWED' ? (
              <svg className="w-5 h-5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-danger-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`font-semibold ${prediction === 'ALLOWED' ? 'text-success-700' : 'text-danger-700'}`}>
              Predicted: {prediction}
            </span>
          </div>
          <p className={`text-sm mt-1 ${prediction === 'ALLOWED' ? 'text-success-600' : 'text-danger-600'}`}>
            {predictionReason}
          </p>
        </div>

        {/* Test Button */}
        <button
          onClick={handleTest}
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validating with Para...
            </>
          ) : (
            'Test Transaction'
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg ${result.allowed ? 'bg-success-50 border border-success-200' : 'bg-danger-50 border border-danger-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.allowed ? (
                <>
                  <svg className="w-5 h-5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold text-success-700">ALLOWED by Para</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-danger-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold text-danger-700">REJECTED by Para</span>
                </>
              )}
            </div>

            {result.paraEnforced && (
              <div className="flex items-center gap-1 mb-2">
                <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-primary-600 font-medium">Enforced by Para Server</span>
              </div>
            )}

            {result.error && (
              <p className="text-sm text-danger-600">{result.error}</p>
            )}

            {result.condition && (
              <p className="text-sm text-slate-600 mt-1">
                Condition: <code className="bg-slate-100 px-1 rounded">{result.condition}</code>
              </p>
            )}

            {result.policy && (
              <div className="mt-2 text-sm text-slate-500">
                <p>Policy: {result.policy.name}</p>
                <p>Allowed Chains: {result.policy.allowedChains.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">How Para Enforces Policies</p>
            <p>
              Para evaluates every request against conditions at runtime.
              Any permission that evaluates to False causes the transaction to be rejected.
              This happens <strong>server-side</strong> - client-side checks are only for UX.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

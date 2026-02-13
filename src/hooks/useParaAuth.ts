/**
 * Para Authentication Hook
 *
 * Custom hook that wraps Para SDK authentication functionality
 * for the allowance wallet application.
 *
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 * @see https://docs.getpara.com/v2/react/guides/permissions
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  useModal,
  useClient,
  useWallet,
  useAccount,
  useLogout,
  useCreateWallet,
  useKeepSessionAlive,
  useSignTransaction,
  useParaStatus,
} from '@getpara/react-sdk';
import { usePermissions } from '../contexts/PermissionContext';

export interface ParaWallet {
  id: string;
  address: string;
  type: 'EVM' | 'Solana' | 'Cosmos';
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  wallets: ParaWallet[];
  email?: string;
  error?: string;
}

interface UseParaAuthReturn extends AuthState {
  openAuthModal: () => void;
  logout: () => void;
  createWallet: (type?: 'EVM' | 'Solana' | 'Cosmos') => Promise<ParaWallet | null>;
  refreshSession: () => void;
  isModalOpen: boolean;
  isParaReady: boolean;
}

/**
 * Para Authentication Hook
 *
 * @see https://docs.getpara.com/v2/concepts/universal-embedded-wallets
 */
export function useParaAuth(): UseParaAuthReturn {
  const { setupUserProfile, clearUserData, loadChildPolicy } = usePermissions();

  // Para SDK hooks
  const { openModal, isOpen: isModalOpen } = useModal();
  const para = useClient();
  const { data: wallet, isLoading: isWalletLoading } = useWallet();
  const account = useAccount();
  const { logout: paraLogout } = useLogout();
  const { createWalletAsync } = useCreateWallet();
  const { keepSessionAlive } = useKeepSessionAlive();
  const paraStatus = useParaStatus();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    wallets: [],
  });
  const hasSetupProfile = useRef(false);

  const isLoggedIn = account.isConnected;

  // Log SDK readiness once
  useEffect(() => {
    console.log('[Para] SDK status:', {
      isReady: paraStatus.isReady,
      isConnected: account.isConnected,
      isLoading: account.isLoading,
      connectionType: account.connectionType,
      hasClient: !!para,
      isModalOpen,
    });
  }, [paraStatus.isReady, account.isConnected, account.isLoading, para, isModalOpen]);

  // Sync Para auth state - only react to actual connection changes
  useEffect(() => {
    if (isLoggedIn && wallet) {
      const wallets: ParaWallet[] = [{
        id: wallet.id || 'default',
        address: wallet.address || '',
        type: (wallet.type?.toUpperCase() as 'EVM' | 'Solana' | 'Cosmos') || 'EVM',
      }];

      const email = account.embedded?.email;

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        wallets,
        email,
      });

      // Set up user profile once
      if (!hasSetupProfile.current && wallets[0]?.address) {
        hasSetupProfile.current = true;
        setupUserProfile(wallets[0].address, email);
        loadChildPolicy(wallets[0].address);
      }
    } else if (!isWalletLoading && !account.isLoading) {
      // Only set unauthenticated when SDK has finished loading
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
      }));
    }
  }, [isLoggedIn, isWalletLoading, account.isLoading, wallet, account.embedded?.email, setupUserProfile, loadChildPolicy]);

  const openAuthModal = useCallback(() => {
    console.log('[Para] openAuthModal called:', {
      isModalOpen,
      isReady: paraStatus.isReady,
      hasClient: !!para,
      isConnected: account.isConnected,
    });

    if (!paraStatus.isReady) {
      console.warn('[Para] SDK not ready yet, waiting...');
      // Retry after a short delay
      setTimeout(() => {
        if (paraStatus.isReady) {
          try {
            openModal();
            console.log('[Para] openModal() executed after delay');
          } catch (err) {
            console.error('[Para] Error opening modal after delay:', err);
          }
        }
      }, 500);
      return;
    }

    try {
      openModal();
      console.log('[Para] openModal() executed successfully');
    } catch (err) {
      console.error('[Para] Error opening modal:', err);
    }
  }, [openModal, isModalOpen, paraStatus.isReady, para, account.isConnected]);

  const logout = useCallback(() => {
    hasSetupProfile.current = false;
    paraLogout();
    clearUserData();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      wallets: [],
    });
  }, [paraLogout, clearUserData]);

  const createWallet = useCallback(
    async (type: 'EVM' | 'Solana' | 'Cosmos' = 'EVM'): Promise<ParaWallet | null> => {
      if (!isLoggedIn || !para) {
        console.error('[Para] createWallet: not authenticated', { isLoggedIn, hasPara: !!para });
        throw new Error('Must be authenticated to create wallet');
      }

      const paraType = type.toUpperCase() as 'EVM' | 'SOLANA' | 'COSMOS';
      console.log('[Para] createWallet: calling createWalletAsync with type:', paraType);

      const result = await createWalletAsync({ type: paraType });
      console.log('[Para] createWallet: result:', result);

      if (result && result[0]) {
        const createdWallet = result[0];
        const newWallet: ParaWallet = {
          id: createdWallet.id || `wallet-${Date.now()}`,
          address: createdWallet.address || '',
          type,
        };

        console.log('[Para] createWallet: wallet created:', newWallet.address);

        setAuthState((prev) => ({
          ...prev,
          wallets: [...prev.wallets, newWallet],
        }));

        return newWallet;
      }

      throw new Error('Wallet creation returned empty result');
    },
    [isLoggedIn, para, createWalletAsync]
  );

  const refreshSession = useCallback(() => {
    if (isLoggedIn) {
      keepSessionAlive();
    }
  }, [isLoggedIn, keepSessionAlive]);

  return {
    ...authState,
    openAuthModal,
    logout,
    createWallet,
    refreshSession,
    isModalOpen,
    isParaReady: paraStatus.isReady,
  };
}

/**
 * Hook for signing transactions with permission enforcement
 *
 * @see https://docs.getpara.com/v2/react/guides/permissions
 */
export function useSignWithPermissions() {
  const { signTransactionAsync } = useSignTransaction();
  const { currentPolicy } = usePermissions();

  const signTransaction = useCallback(
    async (params: {
      walletId: string;
      to: string;
      value?: string;
      data?: string;
      chainId: string;
    }) => {
      const { validateTransaction } = await import('../utils/permissionEnforcement');

      if (currentPolicy) {
        const validation = validateTransaction(
          {
            to: params.to,
            value: params.value,
            data: params.data,
            chainId: params.chainId,
          },
          currentPolicy
        );

        if (!validation.isAllowed) {
          throw new Error(validation.rejectionReason || 'Transaction blocked by policy');
        }
      }

      const txData = JSON.stringify({
        to: params.to,
        value: params.value || '0',
        data: params.data || '0x',
      });
      const rlpEncodedTxBase64 = btoa(txData);

      const signature = await signTransactionAsync({
        walletId: params.walletId,
        chainId: params.chainId,
        rlpEncodedTxBase64,
      });

      return signature;
    },
    [signTransactionAsync, currentPolicy]
  );

  return { signTransaction };
}

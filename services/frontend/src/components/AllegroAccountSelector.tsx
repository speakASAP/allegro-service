/**
 * Allegro Account Selector Component
 * Displays dropdown to select active Allegro account
 */

import React, { useState, useEffect, useCallback } from 'react';
import { allegroAccountApi } from '../services/api';
import { AxiosError } from 'axios';

interface AllegroAccount {
  id: string;
  name: string;
  isActive: boolean;
  oauthStatus?: {
    authorized: boolean;
    expiresAt?: string;
    scopes?: string;
  };
}

interface AllegroAccountSelectorProps {
  onAccountChange?: (accountId: string | null) => void;
}

export const AllegroAccountSelector: React.FC<AllegroAccountSelectorProps> = ({ onAccountChange }) => {
  const [accounts, setAccounts] = useState<AllegroAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await allegroAccountApi.getAccounts();
      if (response.data.success) {
        const accountsData = response.data.data || [];
        setAccounts(accountsData);
        
        // Find active account
        const activeAccount = accountsData.find((acc: AllegroAccount) => acc.isActive);
        const activeId = activeAccount?.id || null;
        setActiveAccountId(activeId);
        
        if (onAccountChange) {
          onAccountChange(activeId);
        }
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error?.message || 'Failed to load accounts');
      } else {
        setError('Failed to load accounts');
      }
    } finally {
      setLoading(false);
    }
  }, [onAccountChange]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleAccountChange = async (accountId: string) => {
    if (accountId === activeAccountId) {
      return; // Already active
    }

    try {
      // Handle "No Active Account" (empty string)
      if (accountId === '') {
        await allegroAccountApi.deactivateAllAccounts();
        setActiveAccountId(null);
      } else {
        await allegroAccountApi.setActiveAccount(accountId);
        setActiveAccountId(accountId);
      }
      
      // Reload accounts to update active status
      await loadAccounts();
      
      if (onAccountChange) {
        onAccountChange(accountId === '' ? null : accountId);
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error?.message || 'Failed to set active account');
      } else {
        setError('Failed to set active account');
      }
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        Loading accounts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
      </div>
    );
  }

  const activeAccount = accounts.find(acc => acc.id === activeAccountId);

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="account-selector" className="text-sm font-medium text-gray-700">
        Allegro Account:
      </label>
      <select
        id="account-selector"
        value={activeAccountId || ''}
        onChange={(e) => handleAccountChange(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- No Active Account --</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
            {account.oauthStatus?.authorized ? ' ✓' : ' (Not Authorized)'}
          </option>
        ))}
      </select>
      {activeAccount && (
        <span className="text-xs text-gray-500">
          {activeAccount.oauthStatus?.authorized ? '✓ Authorized' : '⚠ Not Authorized'}
        </span>
      )}
    </div>
  );
};


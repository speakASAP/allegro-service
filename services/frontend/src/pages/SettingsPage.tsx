/**
 * Settings Page
 */

import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import api, { oauthApi, allegroAccountApi } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';

interface SupplierConfig {
  id: string;
  name: string;
  apiEndpoint: string;
  apiKey?: string;
  apiConfig?: Record<string, unknown>;
}

interface AllegroAccount {
  id: string;
  name: string;
  clientId?: string;
  clientSecret?: string;
  isActive: boolean;
  oauthStatus?: {
    authorized: boolean;
    expiresAt?: string;
    scopes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  id: string;
  userId: string;
  supplierConfigs?: SupplierConfig[];
  preferences?: Record<string, unknown>;
  allegroAccounts?: AllegroAccount[];
  activeAllegroAccountId?: string | null;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierEndpoint, setNewSupplierEndpoint] = useState('');
  const [newSupplierKey, setNewSupplierKey] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  // Allegro Account state
  const [accounts, setAccounts] = useState<AllegroAccount[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountClientId, setNewAccountClientId] = useState('');
  const [newAccountClientSecret, setNewAccountClientSecret] = useState('');
  const [oauthLoadingAccountId, setOauthLoadingAccountId] = useState<string | null>(null);

  useEffect(() => {
    // Load settings in background (non-blocking)
    loadSettings();

    // Check if returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth_refresh') === 'true') {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/settings');
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        setAccounts(data.allegroAccounts || []);
      }
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          setError(err.response?.data?.error?.message || 'Failed to load settings');
        }
      } else {
        setError('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  // Allegro Account handlers
  const handleAddAccount = async () => {
    if (!newAccountName || !newAccountClientId || !newAccountClientSecret) {
      setError('Please fill all account fields');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await allegroAccountApi.createAccount({
        name: newAccountName,
        clientId: newAccountClientId,
        clientSecret: newAccountClientSecret,
      });

      if (response.data.success) {
        setSuccess('Allegro account created successfully');
        setNewAccountName('');
        setNewAccountClientId('');
        setNewAccountClientSecret('');
        setShowAddAccount(false);
        loadSettings();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to create account';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAccount = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {};
      if (newAccountName) updateData.name = newAccountName;
      if (newAccountClientId) updateData.clientId = newAccountClientId;
      if (newAccountClientSecret) updateData.clientSecret = newAccountClientSecret;

      const response = await allegroAccountApi.updateAccount(accountId, updateData);

      if (response.data.success) {
        setSuccess('Allegro account updated successfully');
        setEditingAccountId(null);
        setNewAccountName('');
        setNewAccountClientId('');
        setNewAccountClientSecret('');
        loadSettings();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to update account';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This will also remove all OAuth tokens.')) {
      return;
    }

    try {
      await allegroAccountApi.deleteAccount(accountId);
      setSuccess('Allegro account deleted successfully');
      loadSettings();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to delete account';
      setError(errorMessage);
    }
  };

  const handleSetActiveAccount = async (accountId: string) => {
    try {
      await allegroAccountApi.setActiveAccount(accountId);
      setSuccess('Active account updated successfully');
      loadSettings();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to set active account';
      setError(errorMessage);
    }
  };

  const handleValidateAccountKeys = async (accountId: string, clientId: string, clientSecret: string) => {
    if (!clientId || !clientSecret) {
      setError('Please enter both Client ID and Client Secret');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await allegroAccountApi.validateKeys(accountId, clientId, clientSecret);

      if (response.data.success && response.data.data && response.data.data.valid === true) {
        setSuccess('Allegro API keys validated successfully');
        setError('');
      } else {
        const errorMsg = response.data?.data?.message || 'Invalid API keys';
        setError(errorMsg);
        setSuccess('');
      }
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          const errorMessage = err.response?.data?.error?.message 
            || err.response?.data?.data?.message
            || err.response?.data?.message
            || 'Failed to validate API keys';
          setError(errorMessage);
        }
      } else {
        setError('Failed to validate API keys');
      }
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName || !newSupplierEndpoint || !newSupplierKey) {
      setError('Please fill all supplier fields');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/settings/suppliers', {
        name: newSupplierName,
        apiEndpoint: newSupplierEndpoint,
        apiKey: newSupplierKey,
      });

      if (response.data.success) {
        setSuccess('Supplier added successfully');
        setNewSupplierName('');
        setNewSupplierEndpoint('');
        setNewSupplierKey('');
        setShowAddSupplier(false);
        loadSettings();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to add supplier';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to remove this supplier?')) {
      return;
    }

    try {
      await api.delete(`/settings/suppliers/${supplierId}`);
      setSuccess('Supplier removed successfully');
      loadSettings();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof AxiosError && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to remove supplier';
      setError(errorMessage);
    }
  };

  const handleAuthorizeOAuth = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) {
      setError('Account not found');
      return;
    }

    if (!account.clientId) {
      setError('Please configure Client ID and Client Secret for this account first');
      return;
    }

    setOauthLoadingAccountId(accountId);
    setError('');
    setSuccess('');

    try {
      const response = await oauthApi.authorize(accountId);
      if (response.data.success && response.data.data?.authorizationUrl) {
        // Redirect to Allegro authorization page
        window.location.href = response.data.data.authorizationUrl;
      } else {
        setError('Failed to generate authorization URL');
      }
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          setError(err.response?.data?.error?.message || 'Failed to start OAuth authorization');
        }
      } else {
        setError('Failed to start OAuth authorization');
      }
    } finally {
      setOauthLoadingAccountId(null);
    }
  };

  const handleRevokeOAuth = async (accountId: string) => {
    if (!confirm('Are you sure you want to revoke OAuth authorization? You will need to re-authorize to import offers.')) {
      return;
    }

    setOauthLoadingAccountId(accountId);
    setError('');
    setSuccess('');

    try {
      const response = await oauthApi.revoke(accountId);
      if (response.data.success) {
        setSuccess('OAuth authorization revoked successfully');
        loadSettings();
      } else {
        setError('Failed to revoke OAuth authorization');
      }
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          setError(err.response?.data?.error?.message || 'Failed to revoke OAuth authorization');
        }
      } else {
        setError('Failed to revoke OAuth authorization');
      }
    } finally {
      setOauthLoadingAccountId(null);
    }
  };

  const startEditAccount = (account: AllegroAccount) => {
    setEditingAccountId(account.id);
    setNewAccountName(account.name);
    setNewAccountClientId(account.clientId || '');
    setNewAccountClientSecret('');
  };

  const cancelEditAccount = () => {
    setEditingAccountId(null);
    setNewAccountName('');
    setNewAccountClientId('');
    setNewAccountClientSecret('');
  };

  // Page renders immediately, no blocking loading screen
  // Loading state is used for showing loading indicators in the UI, not blocking render

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings {loading && <span className="text-sm text-gray-500">(Loading...)</span>}</h2>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded whitespace-pre-line">
          <div className="font-semibold mb-2">Error:</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Allegro Accounts */}
      <Card title="Allegro Accounts">
        <div className="space-y-4">
          {accounts.length > 0 ? (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-lg">{account.name}</h4>
                        {account.isActive && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Active
                          </span>
                        )}
                        {account.oauthStatus?.authorized ? (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            ✓ Authorized
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            ⚠ Not Authorized
                          </span>
                        )}
                      </div>
                      {account.oauthStatus?.authorized && account.oauthStatus.expiresAt && (
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Expires:</strong> {new Date(account.oauthStatus.expiresAt).toLocaleString()}
                        </div>
                      )}
                      {editingAccountId === account.id ? (
                        <div className="space-y-3 mt-3">
                          <Input
                            label="Account Name"
                            type="text"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="e.g., statexcz, flipflop"
                          />
                          <Input
                            label="Client ID"
                            type="text"
                            value={newAccountClientId}
                            onChange={(e) => setNewAccountClientId(e.target.value)}
                            placeholder="Enter Client ID"
                          />
                          <Input
                            label="Client Secret"
                            type="password"
                            value={newAccountClientSecret}
                            onChange={(e) => setNewAccountClientSecret(e.target.value)}
                            placeholder="Enter Client Secret (leave empty to keep current)"
                          />
                          <div className="flex space-x-2">
                            <Button onClick={() => handleUpdateAccount(account.id)} disabled={saving}>
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="secondary" onClick={cancelEditAccount} disabled={saving}>
                              Cancel
                            </Button>
                            {newAccountClientId && newAccountClientSecret && (
                              <Button
                                variant="secondary"
                                onClick={() => handleValidateAccountKeys(account.id, newAccountClientId, newAccountClientSecret)}
                                disabled={saving}
                              >
                                Validate Keys
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex space-x-2 mt-3">
                          {!account.isActive && (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleSetActiveAccount(account.id)}
                            >
                              Set Active
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => startEditAccount(account)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => handleDeleteAccount(account.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center space-x-2">
                      {account.oauthStatus?.authorized ? (
                        <>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => handleRevokeOAuth(account.id)}
                            disabled={oauthLoadingAccountId === account.id}
                          >
                            {oauthLoadingAccountId === account.id ? 'Revoking...' : 'Revoke OAuth'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="small"
                            onClick={() => handleAuthorizeOAuth(account.id)}
                            disabled={oauthLoadingAccountId === account.id || !account.clientId}
                          >
                            {oauthLoadingAccountId === account.id ? 'Starting...' : 'Authorize OAuth'}
                          </Button>
                          {!account.clientId && (
                            <span className="text-sm text-yellow-600">
                              Please configure Client ID and Client Secret first
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No Allegro accounts configured yet.</p>
          )}

          {showAddAccount ? (
            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-semibold">Add New Allegro Account</h4>
              <Input
                label="Account Name"
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g., statexcz, flipflop"
              />
              <Input
                label="Client ID"
                type="text"
                value={newAccountClientId}
                onChange={(e) => setNewAccountClientId(e.target.value)}
                placeholder="Enter your Allegro Client ID"
              />
              <Input
                label="Client Secret"
                type="password"
                value={newAccountClientSecret}
                onChange={(e) => setNewAccountClientSecret(e.target.value)}
                placeholder="Enter your Allegro Client Secret"
              />
              <div className="flex space-x-4">
                <Button onClick={handleAddAccount} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Account'}
                </Button>
                <Button variant="secondary" onClick={() => setShowAddAccount(false)}>
                  Cancel
                </Button>
                {newAccountClientId && newAccountClientSecret && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // For new account, we need to create it first, then validate
                      // For now, just show message
                      setError('Please add the account first, then you can validate keys');
                    }}
                    disabled={saving}
                  >
                    Validate Keys
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowAddAccount(true)}>
              + Add Allegro Account
            </Button>
          )}
        </div>
      </Card>

      {/* Supplier Configurations */}
      <Card title="Supplier Configurations">
        <div className="space-y-4">
          {settings?.supplierConfigs && settings.supplierConfigs.length > 0 ? (
            <div className="space-y-2">
              {settings.supplierConfigs.map((supplier: SupplierConfig) => (
                <div key={supplier.id} className="p-4 border rounded-lg flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{supplier.name}</h4>
                    <p className="text-sm text-gray-600">{supplier.apiEndpoint}</p>
                  </div>
                  <Button variant="danger" size="small" onClick={() => handleRemoveSupplier(supplier.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No suppliers configured yet.</p>
          )}

          {showAddSupplier ? (
            <div className="p-4 border rounded-lg space-y-4">
              <Input
                label="Supplier Name"
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="e.g., Supplier ABC"
              />
              <Input
                label="API Endpoint"
                type="text"
                value={newSupplierEndpoint}
                onChange={(e) => setNewSupplierEndpoint(e.target.value)}
                placeholder="https://api.supplier.com"
              />
              <Input
                label="API Key"
                type="password"
                value={newSupplierKey}
                onChange={(e) => setNewSupplierKey(e.target.value)}
                placeholder="Enter API key"
              />
              <div className="flex space-x-4">
                <Button onClick={handleAddSupplier} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Supplier'}
                </Button>
                <Button variant="secondary" onClick={() => setShowAddSupplier(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowAddSupplier(true)}>
              + Add Supplier
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;

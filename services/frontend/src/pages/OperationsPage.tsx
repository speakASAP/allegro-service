import React, { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

type OperationsTab = 'sync-runs' | 'cursors' | 'raw-payloads' | 'projection-audit' | 'stock-snapshots';

interface OperationsSummary {
  generatedAt: string;
  counts: {
    syncRuns: number;
    cursors: number;
    rawPayloads: number;
    projectionAuditLogs: number;
    stockSnapshots: number;
  };
  latest: {
    syncRuns: any[];
    stockSnapshots: any[];
    cursors: any[];
  };
}

const tabs: Array<{ id: OperationsTab; label: string }> = [
  { id: 'sync-runs', label: 'Sync runs' },
  { id: 'cursors', label: 'Cursors' },
  { id: 'raw-payloads', label: 'Payload metadata' },
  { id: 'projection-audit', label: 'Projection audit' },
  { id: 'stock-snapshots', label: 'Stock snapshots' },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function extractItems(payload: any): any[] {
  return payload?.data?.items || payload?.data?.data?.items || payload?.items || [];
}

const OperationsPage: React.FC = () => {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>('sync-runs');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/allegro/operations');
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) return;
      setError(err instanceof AxiosError ? err.response?.data?.error?.message || err.message : 'Failed to load operations summary');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTab = useCallback(async (tab: OperationsTab) => {
    setTableLoading(true);
    setError(null);
    try {
      const response = await api.get(`/allegro/operations/${tab}`, { params: { limit: 25 } });
      if (response.data.success) {
        setItems(extractItems(response.data));
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) return;
      setError(err instanceof AxiosError ? err.response?.data?.error?.message || err.message : 'Failed to load operations data');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const refresh = () => {
    loadSummary();
    loadTab(activeTab);
  };

  const renderRows = () => {
    if (tableLoading) {
      return (
        <tr>
          <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Loading...</td>
        </tr>
      );
    }
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>No records</td>
        </tr>
      );
    }

    return items.map((item) => (
      <tr key={item.id} className="border-t border-gray-100">
        <td className="px-4 py-3 text-xs font-mono text-gray-700">{item.id}</td>
        <td className="px-4 py-3 text-sm text-gray-900">{formatValue(item.domain || item.entityType || item.allegroOfferId)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatValue(item.status || item.action || item.authorityClass || item.cursorType || item.piiClass)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatValue(item.mode || item.endpoint || item.externalId || item.availableQuantity)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatValue(item.account?.name || item.accountId)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.startedAt || item.updatedAt || item.receivedAt || item.createdAt || item.sourceFetchedAt)}</td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operations</h2>
          <p className="text-sm text-gray-600">Read-only Allegro sync and projection evidence</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading || tableLoading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Sync runs">
          <p className="text-3xl font-semibold text-gray-900">{summary?.counts.syncRuns ?? (loading ? '...' : 0)}</p>
        </Card>
        <Card title="Cursors">
          <p className="text-3xl font-semibold text-gray-900">{summary?.counts.cursors ?? (loading ? '...' : 0)}</p>
        </Card>
        <Card title="Payloads">
          <p className="text-3xl font-semibold text-gray-900">{summary?.counts.rawPayloads ?? (loading ? '...' : 0)}</p>
        </Card>
        <Card title="Audit logs">
          <p className="text-3xl font-semibold text-gray-900">{summary?.counts.projectionAuditLogs ?? (loading ? '...' : 0)}</p>
        </Card>
        <Card title="Stock snapshots">
          <p className="text-3xl font-semibold text-gray-900">{summary?.counts.stockSnapshots ?? (loading ? '...' : 0)}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Detail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {renderRows()}
            </tbody>
          </table>
        </div>
      </Card>

      {summary && (
        <p className="text-xs text-gray-500">Last refreshed {formatDate(summary.generatedAt)}</p>
      )}
    </div>
  );
};

export default OperationsPage;

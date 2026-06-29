import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface AllegroUserActivity {
  sources: string[];
  accountCount: number;
  settingsCount: number;
  publishAttemptCount: number;
  lastActivityAt?: string | null;
}

interface AllegroUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  isVerified: boolean;
  userType: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  allegro?: AllegroUserActivity;
}

interface AllegroAdminUser extends AllegroUser {
  roles?: string[];
}

interface AllegroAdminUsersPayload {
  users: {
    items: AllegroUser[];
    count: number;
    limit: number;
    offset: number;
  };
  admins: {
    items: AllegroAdminUser[];
    count: number;
  };
}

const PAGE_SIZE = 100;

const fullName = (user: Pick<AllegroUser, 'firstName' | 'lastName'>) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';

const formatDate = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const statusBadge = (isActive: boolean) => (
  <span className={`rounded px-2 py-1 text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AllegroUser[]>([]);
  const [admins, setAdmins] = useState<AllegroAdminUser[]>([]);
  const [count, setCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async (nextOffset = offset) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/allegro/admin/users', {
        params: { limit: PAGE_SIZE, offset: nextOffset },
      });
      const payload = response.data?.data as AllegroAdminUsersPayload | undefined;
      setUsers(payload?.users?.items || []);
      setAdmins(payload?.admins?.items || []);
      setCount(payload?.users?.count || 0);
      setAdminCount(payload?.admins?.count || 0);
      setOffset(payload?.users?.offset ?? nextOffset);
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load Allegro users'
          : 'Failed to load Allegro users';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(0);
  }, []);

  const canGoBack = offset > 0;
  const canGoForward = offset + PAGE_SIZE < count;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Allegro service users</h2>
          <p className="text-sm text-gray-600">
            {count} workspace users and {adminCount} administrators for Allegro Service
          </p>
        </div>
        <Button variant="secondary" onClick={() => loadUsers(offset)} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card title="Allegro administrators">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Admin roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {admins.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.email || user.id}</td>
                  <td className="px-4 py-3 text-gray-700">{fullName(user)}</td>
                  <td className="px-4 py-3 text-gray-700">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{user.roles?.join(', ') || 'admin'}</td>
                  <td className="px-4 py-3">{statusBadge(user.isActive)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {!loading && admins.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-600" colSpan={6}>
                    No Allegro administrators found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Allegro workspace users">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Allegro activity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.email || user.id}</td>
                  <td className="px-4 py-3 text-gray-700">{fullName(user)}</td>
                  <td className="px-4 py-3 text-gray-700">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {[
                      user.allegro?.accountCount ? `${user.allegro.accountCount} account${user.allegro.accountCount === 1 ? '' : 's'}` : '',
                      user.allegro?.publishAttemptCount ? `${user.allegro.publishAttemptCount} publish attempt${user.allegro.publishAttemptCount === 1 ? '' : 's'}` : '',
                      user.allegro?.sources?.includes('workspace_access') ? 'workspace access' : '',
                    ].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3">{statusBadge(user.isActive)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(user.allegro?.lastActivityAt || user.updatedAt)}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-600" colSpan={6}>
                    No Allegro workspace users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-gray-600">
          <span>
            Showing {users.length === 0 ? 0 : offset + 1}-{Math.min(offset + users.length, count)} of {count}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="small" onClick={() => loadUsers(Math.max(0, offset - PAGE_SIZE))} disabled={!canGoBack || loading}>
              Previous
            </Button>
            <Button variant="secondary" size="small" onClick={() => loadUsers(offset + PAGE_SIZE)} disabled={!canGoForward || loading}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminUsersPage;

import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface AdminUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive: boolean;
  isVerified: boolean;
  userType: string;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 100;

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async (nextOffset = offset) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/auth/admin/users', {
        params: { limit: PAGE_SIZE, offset: nextOffset },
      });
      setUsers(response.data?.users || []);
      setCount(response.data?.count || 0);
      setOffset(response.data?.offset || nextOffset);
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load users'
          : 'Failed to load users';
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
          <h2 className="text-2xl font-bold text-gray-900">Registered users</h2>
          <p className="text-sm text-gray-600">{count} users in Auth service</p>
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

      <Card title="Auth service users">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{user.userType}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{new Date(user.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-600" colSpan={6}>
                    No users found
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

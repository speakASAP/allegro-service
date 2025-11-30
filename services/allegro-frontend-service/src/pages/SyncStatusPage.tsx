/**
 * Sync Status Page
 */

import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { Card } from '../components/Card';

interface SyncJob {
  id: string;
  type: string;
  direction: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
}

const SyncStatusPage: React.FC = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const response = await api.get('/sync/jobs');
      if (response.data.success) {
        setJobs(response.data.data.items || []);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load sync jobs', err);
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          setError('Failed to load sync jobs. Please try again later.');
        }
      } else {
        setError('Failed to load sync jobs. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      case 'RUNNING':
        return 'text-blue-600 bg-blue-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return <div>Loading sync jobs...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Sync Status</h2>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded whitespace-pre-line">
          <div className="font-semibold mb-2">Error:</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      <Card>
        {jobs.length === 0 ? (
          <p className="text-gray-600">No sync jobs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.direction}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.processedItems} / {job.totalItems} ({job.successfulItems} success, {job.failedItems} failed)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SyncStatusPage;


/**
 * Orders Page
 */

import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import api from '../services/api';
import { Card } from '../components/Card';

interface Order {
  id: string;
  allegroOrderId: string;
  buyerEmail?: string;
  quantity: number;
  price: number | string;
  totalPrice: number | string;
  currency?: string;
  lineItemsCount?: number;
  marketplaceId?: string;
  status: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  orderDate: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false); // Start as false to render immediately
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load orders in background (non-blocking)
    loadOrders(page);
  }, [page]);

  const loadOrders = async (requestedPage = 1) => {
    setLoading(true); // Set loading only during the API call
    try {
      // Use reasonable timeout for database queries (5 seconds maximum)
      const response = await api.get('/allegro/orders', {
        params: {
          page: requestedPage,
          limit: pagination.limit,
        },
        timeout: 5000, // 5 seconds maximum
      });
      if (response.data.success) {
        const data = response.data.data || {};
        setOrders(data.items || []); // Set orders from response data
        setPagination(data.pagination || {
          page: requestedPage,
          limit: pagination.limit,
          total: data.items?.length || 0,
          totalPages: 1,
        });
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Failed to load orders', err);
      if (err instanceof AxiosError) {
        const axiosError = err as AxiosError & { isConnectionError?: boolean; serviceErrorMessage?: string };
        if (axiosError.isConnectionError && axiosError.serviceErrorMessage) {
          setError(axiosError.serviceErrorMessage);
        } else {
          setError('Failed to load orders. Please try again later.');
        }
      } else {
        setError('Failed to load orders. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY_FOR_PROCESSING':
      case 'PAID':
        return 'text-green-600 bg-green-100';
      case 'SENT':
      case 'PICKED_UP':
        return 'text-blue-600 bg-blue-100';
      case 'DELIVERED':
      case 'RETURNED':
        return 'text-purple-600 bg-purple-100';
      case 'CANCELLED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatMoney = (amount: number | string, currency?: string) => {
    const resolvedCurrency = currency || 'CZK';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: resolvedCurrency,
      }).format(Number(amount || 0));
    } catch {
      return `${amount} ${resolvedCurrency}`;
    }
  };

  const goToPage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), Math.max(pagination.totalPages || 1, 1));
    if (boundedPage !== page) {
      setPage(boundedPage);
    }
  };

  // Page renders immediately, no blocking loading screen
  // Loading state is used for showing loading indicators in the UI, not blocking render

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Orders{loading && <span className="ml-2 text-sm text-gray-500">(Loading...)</span>}</h2>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded whitespace-pre-line">
          <div className="font-semibold mb-2">Error:</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            Showing page {pagination.page || page} of {Math.max(pagination.totalPages || 1, 1)} ({pagination.total} orders)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={loading || page <= 1}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={loading || page >= Math.max(pagination.totalPages || 1, 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="text-gray-600">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lines</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fulfillment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.allegroOrderId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.buyerEmail || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.marketplaceId || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.lineItemsCount ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatMoney(order.totalPrice, order.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.paymentStatus || '')}`}>
                        {order.paymentStatus || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.fulfillmentStatus || '')}`}>
                        {order.fulfillmentStatus || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.orderDate).toLocaleString()}
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

export default OrdersPage;

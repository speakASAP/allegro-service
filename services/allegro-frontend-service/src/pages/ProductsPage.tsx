import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { AxiosError } from 'axios';

interface ProductParameter {
  parameterId: string;
  name?: string;
  values?: any;
  valuesIds?: any;
  rangeValue?: any;
}

interface Product {
  id: string;
  allegroProductId: string;
  name?: string;
  brand?: string;
  manufacturerCode?: string;
  ean?: string;
  publicationStatus?: string;
  isAiCoCreated?: boolean;
  marketedBeforeGPSR?: boolean | null;
  rawData?: any;
  parameters?: ProductParameter[];
  createdAt?: string;
  updatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const defaultPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState({
    allegroProductId: '',
    name: '',
    brand: '',
    manufacturerCode: '',
    ean: '',
    publicationStatus: '',
    isAiCoCreated: false,
    marketedBeforeGPSR: false,
    rawDataText: '',
    parametersText: '',
  });

  const loadProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/allegro/products', {
        params: { page, limit: pagination.limit, search },
      });
      const data = res.data?.data;
      setProducts(data?.items || []);
      setPagination(data?.pagination || defaultPagination);
      setError(null);
    } catch (err) {
      console.error('Failed to load products', err);
      const axiosErr = err as AxiosError & { serviceErrorMessage?: string };
      setError(axiosErr.serviceErrorMessage || axiosErr.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, search]);

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  const openCreate = () => {
    setSelected(null);
    setForm({
      allegroProductId: '',
      name: '',
      brand: '',
      manufacturerCode: '',
      ean: '',
      publicationStatus: '',
      isAiCoCreated: false,
      marketedBeforeGPSR: false,
      rawDataText: JSON.stringify({}, null, 2),
      parametersText: '',
    });
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setSelected(product);
    setForm({
      allegroProductId: product.allegroProductId || '',
      name: product.name || '',
      brand: product.brand || '',
      manufacturerCode: product.manufacturerCode || '',
      ean: product.ean || '',
      publicationStatus: product.publicationStatus || '',
      isAiCoCreated: !!product.isAiCoCreated,
      marketedBeforeGPSR: product.marketedBeforeGPSR ?? false,
      rawDataText: JSON.stringify(product.rawData || {}, null, 2),
      parametersText: product.parameters && product.parameters.length > 0 ? JSON.stringify(product.parameters, null, 2) : '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/allegro/products/${id}`);
      await loadProducts(pagination.page);
    } catch (err) {
      console.error('Failed to delete product', err);
      const axiosErr = err as AxiosError & { serviceErrorMessage?: string };
      setError(axiosErr.serviceErrorMessage || axiosErr.message || 'Failed to delete product');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let rawDataParsed: any = {};
      let parametersParsed: any[] | undefined;

      if (form.rawDataText) {
        rawDataParsed = JSON.parse(form.rawDataText);
      }
      if (form.parametersText.trim()) {
        const parsed = JSON.parse(form.parametersText);
        parametersParsed = Array.isArray(parsed) ? parsed : [];
      }

      const payload: any = {
        allegroProductId: form.allegroProductId || undefined,
        name: form.name || undefined,
        brand: form.brand || undefined,
        manufacturerCode: form.manufacturerCode || undefined,
        ean: form.ean || undefined,
        publicationStatus: form.publicationStatus || undefined,
        isAiCoCreated: !!form.isAiCoCreated,
        marketedBeforeGPSR: form.marketedBeforeGPSR,
        rawData: rawDataParsed,
        parameters: parametersParsed,
      };

      if (selected) {
        await api.put(`/allegro/products/${selected.id}`, payload);
      } else {
        await api.post('/allegro/products', payload);
      }

      setModalOpen(false);
      await loadProducts(pagination.page);
    } catch (err) {
      console.error('Failed to save product', err);
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in raw data or parameters');
      } else {
        const axiosErr = err as AxiosError & { serviceErrorMessage?: string };
        setError(axiosErr.serviceErrorMessage || axiosErr.message || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Products</h2>
          <p className="text-gray-600">Manage Allegro products extracted from offers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => loadProducts(pagination.page)} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={openCreate}>Add Product</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Input
            label="Search"
            placeholder="Name, brand, EAN, Allegro product ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" onClick={() => loadProducts(1)} disabled={loading}>
            Apply
          </Button>
        </div>

        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Allegro Product ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Brand</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">EAN</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Updated</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2 text-sm">{product.allegroProductId}</td>
                  <td className="px-4 py-2 text-sm">{product.name || '—'}</td>
                  <td className="px-4 py-2 text-sm">{product.brand || '—'}</td>
                  <td className="px-4 py-2 text-sm">{product.ean || '—'}</td>
                  <td className="px-4 py-2 text-sm">{product.publicationStatus || '—'}</td>
                  <td className="px-4 py-2 text-sm">
                    {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <Button variant="secondary" size="small" onClick={() => openEdit(product)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="small" onClick={() => handleDelete(product.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={7}>
                    {loading ? 'Loading products...' : 'No products found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </div>
          <div className="space-x-2">
            <Button
              variant="secondary"
              size="small"
              disabled={pagination.page <= 1 || loading}
              onClick={() => loadProducts(pagination.page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              size="small"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => loadProducts(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Allegro Product ID"
              value={form.allegroProductId}
              onChange={(e) => setForm({ ...form, allegroProductId: e.target.value })}
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
            <Input
              label="Manufacturer Code"
              value={form.manufacturerCode}
              onChange={(e) => setForm({ ...form, manufacturerCode: e.target.value })}
            />
            <Input label="EAN" value={form.ean} onChange={(e) => setForm({ ...form, ean: e.target.value })} />
            <Input
              label="Publication Status"
              value={form.publicationStatus}
              onChange={(e) => setForm({ ...form, publicationStatus: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAiCoCreated}
                onChange={(e) => setForm({ ...form, isAiCoCreated: e.target.checked })}
              />
              AI Co-Created
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.marketedBeforeGPSR}
                onChange={(e) => setForm({ ...form, marketedBeforeGPSR: e.target.checked })}
              />
              Marketed before GPSR
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Raw Data (JSON)</label>
            <textarea
              className="mt-1 w-full border rounded p-2 font-mono text-sm"
              rows={8}
              value={form.rawDataText}
              onChange={(e) => setForm({ ...form, rawDataText: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Parameters (JSON array, optional)</label>
            <textarea
              className="mt-1 w-full border rounded p-2 font-mono text-sm"
              rows={6}
              placeholder='[{"parameterId":"225693","name":"EAN (GTIN)","values":["4650097695809"]}]'
              value={form.parametersText}
              onChange={(e) => setForm({ ...form, parametersText: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductsPage;


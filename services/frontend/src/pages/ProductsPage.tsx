import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  allegroAccountApi,
  catalogProductsApi,
  catalogSellActionApi,
  PrepareCatalogSellActionPayload,
} from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

type ProductImage = string | { url?: string; src?: string; path?: string };

interface ProductRawData {
  images?: ProductImage[];
  media?: ProductImage[];
}

interface CatalogProduct {
  id: string;
  allegroProductId?: string;
  name?: string | null;
  title?: string | null;
  brand?: string | null;
  manufacturerCode?: string | null;
  ean?: string | null;
  publicationStatus?: string | null;
  parameters?: unknown[];
  images?: ProductImage[];
  media?: ProductImage[];
  rawData?: ProductRawData | null;
  allegroProduct?: {
    publicationStatus?: string | null;
    rawData?: ProductRawData | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  catalogProduct?: {
    id?: string;
    sku?: string;
    title?: string;
    name?: string;
    description?: string;
    shortDescription?: string;
    brand?: string;
    ean?: string;
    categoryId?: string;
    allegroCategoryId?: string;
    price?: { gross?: number; currency?: string } | number;
    salePrice?: number;
    quantity?: number;
    stock?: number;
    stockQuantity?: number;
    images?: ProductImage[];
    media?: ProductImage[];
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DraftSummary {
  id?: string;
  accountId?: string | null;
  catalogProductId?: string | null;
  allegroOfferId?: string | null;
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  price?: number | string | null;
  currency?: string | null;
  quantity?: number | string | null;
  stockQuantity?: number | string | null;
  publicationStatus?: string | null;
  status?: string | null;
  updatedAt?: string | null;
}

interface AccountChoice {
  id: string;
  name?: string;
  isActive?: boolean;
  tokenExpiresAt?: string | null;
}

interface AllegroAccount {
  id: string;
  name: string;
  isActive: boolean;
  oauthStatus?: {
    authorized?: boolean;
    expiresAt?: string;
    scopes?: string;
  };
}

interface CatalogContentPreview {
  marketplace?: string | null;
  label?: string | null;
  format?: string | null;
  content?: {
    title?: string | null;
    plainText?: string | null;
    html?: string | null;
    blockCount?: number;
    sectionCount?: number;
  } | null;
  source?: {
    canonicalDocumentVersion?: string | null;
    legacyDescriptionFallback?: boolean | null;
    sourceHash?: string | null;
    generatedAt?: string | null;
  } | null;
  overridesApplied?: boolean;
  warnings?: string[];
}

interface CatalogSellStatus {
  status?: string | null;
  nextAction?: string | null;
  draft?: DraftSummary | null;
  attempt?: { id?: string; status?: string; blockedReasons?: string[]; previewToken?: string; previewTokenBinding?: Record<string, unknown> } | null;
  accountChoices?: AccountChoice[];
  categoryChoice?: { selectedCategoryId?: string | null; source?: string | null };
  catalogProduct?: { id?: string; sku?: string; title?: string; brand?: string; ean?: string } | null;
  catalogContentPreview?: CatalogContentPreview | null;
  listingUrl?: string | null;
  canEditDraft?: boolean;
  canConfirmPublish?: boolean;
}

interface DraftForm {
  title: string;
  description: string;
  categoryId: string;
  price: string;
  quantity: string;
  accountId: string;
  forceNewDraft: boolean;
}

const defaultPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 1 };

const unwrapData = <T,>(body: unknown): T => {
  const response = body as { data?: T };
  return (response?.data ?? body) as T;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  const axiosErr = err as AxiosError & { serviceErrorMessage?: string };
  const responseMessage = (axiosErr.response?.data as { error?: { message?: string }; message?: string } | undefined)?.error?.message
    || (axiosErr.response?.data as { message?: string } | undefined)?.message;
  return axiosErr.serviceErrorMessage || responseMessage || axiosErr.message || fallback;
};

const productTitle = (product: CatalogProduct | null) => (
  product?.name
  || product?.title
  || product?.catalogProduct?.title
  || product?.catalogProduct?.name
  || product?.allegroProductId
  || product?.id
  || ''
);

const productSku = (product: CatalogProduct | null) => product?.catalogProduct?.sku || product?.allegroProductId || product?.id || '';

const productPrice = (product: CatalogProduct | null) => {
  const price = product?.catalogProduct?.price;
  if (typeof price === 'number') return String(price);
  if (price && typeof price === 'object' && price.gross !== undefined) return String(price.gross);
  if (product?.catalogProduct?.salePrice !== undefined) return String(product.catalogProduct.salePrice);
  return '';
};

const productQuantity = (product: CatalogProduct | null) => {
  const value = product?.catalogProduct?.stockQuantity
    ?? product?.catalogProduct?.quantity
    ?? product?.catalogProduct?.stock;
  return value !== undefined && value !== null ? String(value) : '';
};

const productCategory = (product: CatalogProduct | null) => (
  product?.catalogProduct?.allegroCategoryId
  || product?.catalogProduct?.categoryId
  || ''
);

const productDescription = (product: CatalogProduct | null) => (
  product?.catalogProduct?.description
  || product?.catalogProduct?.shortDescription
  || ''
);

const contentPreviewDescription = (preview?: CatalogContentPreview | null) => {
  const content = preview?.content;
  if (typeof content?.plainText === 'string' && content.plainText.trim()) return content.plainText;
  if (typeof content?.html === 'string' && content.html.trim()) return content.html;
  return '';
};

const imageUrl = (image: ProductImage | undefined) => {
  if (!image) return '';
  return typeof image === 'string' ? image : image.url || image.src || image.path || '';
};

const productImageUrl = (product: CatalogProduct | null) => {
  const imageGroups = [
    product?.images,
    product?.media,
    product?.catalogProduct?.images,
    product?.catalogProduct?.media,
    product?.rawData?.images,
    product?.rawData?.media,
    product?.allegroProduct?.rawData?.images,
    product?.allegroProduct?.rawData?.media,
  ];

  for (const images of imageGroups) {
    const url = images?.map(imageUrl).find(Boolean);
    if (url) return url;
  }

  return '';
};

const soldStatusValues = new Set(['SOLD', 'PAID', 'SENT', 'DELIVERED', 'FULFILLED', 'COMPLETED']);

const isSoldOnAllegro = (product: CatalogProduct, status?: CatalogSellStatus | null) => {
  const statusValues = [
    product.publicationStatus,
    product.allegroProduct?.publicationStatus,
    status?.status,
    status?.draft?.publicationStatus,
    status?.attempt?.status,
  ]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase());

  return statusValues.some((value) => soldStatusValues.has(value) || value.includes('SOLD'));
};

interface ProductTileProps {
  product: CatalogProduct;
  active: boolean;
  onSelect: (product: CatalogProduct) => void;
}

const ProductTile: React.FC<ProductTileProps> = ({ product, active, onSelect }) => {
  const photoUrl = productImageUrl(product);
  const title = productTitle(product) || 'Untitled product';

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(product)}
      className={`aspect-square rounded-md border bg-white p-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
      }`}
    >
      <div className="h-[72%] overflow-hidden rounded bg-gray-100">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={title}
            className="h-full w-full object-cover"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
            Allegro
          </div>
        )}
      </div>
      <p
        className="mt-2 text-xs font-medium leading-tight text-gray-900"
        style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
      >
        {title}
      </p>
    </button>
  );
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '-';

const buildInitialForm = (product: CatalogProduct | null, status?: CatalogSellStatus | null): DraftForm => {
  const draft = status?.draft;
  return {
    title: String(draft?.title || productTitle(product)),
    description: String(draft?.description || contentPreviewDescription(status?.catalogContentPreview) || productDescription(product)),
    categoryId: String(draft?.categoryId || status?.categoryChoice?.selectedCategoryId || productCategory(product)),
    price: draft?.price !== undefined && draft?.price !== null ? String(draft.price) : productPrice(product),
    quantity: draft?.quantity !== undefined && draft?.quantity !== null ? String(draft.quantity) : productQuantity(product),
    accountId: String(draft?.accountId || status?.accountChoices?.[0]?.id || ''),
    forceNewDraft: false,
  };
};

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusByProduct, setStatusByProduct] = useState<Record<string, CatalogSellStatus>>({});
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({});
  const [previewTokensByProduct, setPreviewTokensByProduct] = useState<Record<string, string>>({});
  const [draftForm, setDraftForm] = useState<DraftForm>(buildInitialForm(null));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountSelectionLoaded, setAccountSelectionLoaded] = useState(false);
  const [hasPublishReadyAccount, setHasPublishReadyAccount] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) || products[0] || null,
    [products, selectedId],
  );
  const selectedStatus = selectedProduct ? statusByProduct[selectedProduct.id] : null;
  const selectedStatusError = selectedProduct ? statusErrors[selectedProduct.id] : null;
  const selectedContentPreview = selectedStatus?.catalogContentPreview || null;
  const selectedContentPreviewDescription = contentPreviewDescription(selectedContentPreview);
  const accountChoices = selectedStatus?.accountChoices || [];
  const sellActionUnavailable = Boolean(selectedStatusError);
  const hasPreparedDraft = Boolean(selectedStatus?.draft?.id);
  const canEditDraft = Boolean(selectedStatus?.canEditDraft && hasPreparedDraft && !sellActionUnavailable);
  const canConfirmPublish = Boolean(selectedStatus?.canConfirmPublish && !sellActionUnavailable);
  const soldProducts = useMemo(
    () => products.filter((product) => isSoldOnAllegro(product, statusByProduct[product.id])),
    [products, statusByProduct],
  );
  const publishableProducts = useMemo(
    () => products.filter((product) => !isSoldOnAllegro(product, statusByProduct[product.id])),
    [products, statusByProduct],
  );

  const applyStatus = useCallback((catalogProductId: string, status: CatalogSellStatus) => {
    setStatusByProduct((prev) => ({
      ...prev,
      [catalogProductId]: {
        ...prev[catalogProductId],
        ...status,
        catalogContentPreview: status.catalogContentPreview ?? prev[catalogProductId]?.catalogContentPreview ?? null,
      },
    }));
  }, []);

  const loadStatus = useCallback(async (catalogProductId: string) => {
    try {
      const res = await catalogSellActionApi.getProductStatus(catalogProductId);
      const status = unwrapData<CatalogSellStatus>(res.data);
      applyStatus(catalogProductId, status);
      setStatusErrors((prev) => {
        const next = { ...prev };
        delete next[catalogProductId];
        return next;
      });
      return status;
    } catch (err) {
      const message = getErrorMessage(err, 'Catalog sell-action status endpoint is not reachable');
      setStatusErrors((prev) => ({ ...prev, [catalogProductId]: message }));
      return null;
    }
  }, [applyStatus]);

  const loadAccountReadiness = useCallback(async () => {
    try {
      const res = await allegroAccountApi.getAccounts();
      const accounts = unwrapData<AllegroAccount[]>(res.data);
      setHasPublishReadyAccount(accounts.some((account) => account.isActive && Boolean(account.oauthStatus?.authorized)));
    } catch (err) {
      console.warn('Failed to load Allegro account readiness', err);
      setHasPublishReadyAccount(false);
    } finally {
      setAccountSelectionLoaded(true);
    }
  }, []);

  const loadProducts = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await catalogProductsApi.getProducts({
        page,
        limit: pagination.limit,
        search: search || undefined,
        includeRaw: true,
      });
      const data = unwrapData<{ items?: CatalogProduct[]; pagination?: Pagination }>(res.data);
      const nextProducts = data.items || [];
      setProducts(nextProducts);
      setPagination(data.pagination || defaultPagination);
      setSelectedId((current) => current && nextProducts.some((product) => product.id === current)
        ? current
        : nextProducts[0]?.id || null);
      await Promise.all(nextProducts.slice(0, 8).map((product) => loadStatus(product.id)));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load catalog products'));
    } finally {
      setLoading(false);
    }
  }, [loadStatus, pagination.limit, search]);

  useEffect(() => {
    loadAccountReadiness();
  }, [loadAccountReadiness]);

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  useEffect(() => {
    setDraftForm(buildInitialForm(selectedProduct, selectedStatus));
  }, [selectedProduct, selectedStatus]);

  const refreshSelectedStatus = async () => {
    if (!selectedProduct) return;
    setStatusLoading(true);
    try {
      await loadStatus(selectedProduct.id);
    } finally {
      setStatusLoading(false);
    }
  };

  const preparePayload = (): PrepareCatalogSellActionPayload | null => {
    if (!selectedProduct) return null;
    return {
      catalogProductId: selectedProduct.id,
      accountId: draftForm.accountId || undefined,
      offerId: selectedStatus?.draft?.id || undefined,
      categoryId: draftForm.categoryId || undefined,
      title: draftForm.title || undefined,
      description: draftForm.description && !(selectedContentPreviewDescription && draftForm.description === selectedContentPreviewDescription && !selectedStatus?.draft?.description)
        ? draftForm.description
        : undefined,
      price: draftForm.price ? Number(draftForm.price) : undefined,
      quantity: draftForm.quantity ? Number(draftForm.quantity) : undefined,
      forceNewDraft: draftForm.forceNewDraft || undefined,
    };
  };

  const handlePrepareDraft = async () => {
    const payload = preparePayload();
    if (!selectedProduct || !payload) return;
    setPreparing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await catalogSellActionApi.prepare(payload);
      const status = unwrapData<CatalogSellStatus>(res.data);
      applyStatus(selectedProduct.id, status);
      if (status.attempt?.previewToken) {
        setPreviewTokensByProduct((prev) => ({ ...prev, [selectedProduct.id]: String(status.attempt?.previewToken) }));
      }
      setStatusErrors((prev) => {
        const next = { ...prev };
        delete next[selectedProduct.id];
        return next;
      });
      setSuccess('Allegro draft prepared locally. Review the draft before confirmation.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to prepare Allegro draft from catalog product'));
    } finally {
      setPreparing(false);
    }
  };

  const handleSaveDraft = async () => {
    const payload = preparePayload();
    if (!selectedProduct || !payload) return;
    setSavingDraft(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await catalogSellActionApi.updateProductDraft(selectedProduct.id, payload);
      const status = unwrapData<CatalogSellStatus>(res.data);
      applyStatus(selectedProduct.id, status);
      setSuccess('Draft fields saved locally. This did not publish to Allegro.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update draft fields'));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirmPublish = async () => {
    if (!selectedProduct || !canConfirmPublish) return;
    const confirmed = window.confirm('Confirm publishing this prepared draft to the guarded Allegro queue? This is the explicit approval step.');
    if (!confirmed) return;
    const previewToken = previewTokensByProduct[selectedProduct.id] || selectedStatus?.attempt?.previewToken;
    if (!previewToken) {
      setError('Prepare the draft again to receive a fresh preview token before confirmation.');
      return;
    }
    setConfirming(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await catalogSellActionApi.confirmProductPublish(selectedProduct.id, previewToken);
      const status = unwrapData<CatalogSellStatus>(res.data);
      applyStatus(selectedProduct.id, status);
      setPreviewTokensByProduct((prev) => {
        const next = { ...prev };
        delete next[selectedProduct.id];
        return next;
      });
      setSuccess('Publish confirmation accepted. The guarded Allegro queue will process the prepared draft.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to confirm Allegro publish'));
    } finally {
      setConfirming(false);
    }
  };

  const applyCatalogPreviewDescription = () => {
    if (!selectedContentPreviewDescription) return;
    setDraftForm((current) => ({ ...current, description: selectedContentPreviewDescription }));
  };

  const selectProduct = async (product: CatalogProduct) => {
    setSelectedId(product.id);
    if (!statusByProduct[product.id] && !statusErrors[product.id]) {
      setStatusLoading(true);
      try {
        await loadStatus(product.id);
      } finally {
        setStatusLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Allegro.alfares catalog</p>
          <h2 className="text-2xl font-semibold text-gray-900">Products to publish on Allegro</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Select a product card, prepare a local Allegro draft, review editable fields, then confirm explicitly. No autonomous publish happens from this screen.
          </p>
        </div>
        <Button variant="secondary" onClick={() => loadProducts(pagination.page)} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh catalog'}
        </Button>
      </div>

      {accountSelectionLoaded && !hasPublishReadyAccount && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">OAuth account readiness is required before publish confirmation.</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Open{' '}
            <Link to="/dashboard/settings" className="font-medium underline">
              Settings & OAuth
            </Link>{' '}
            (<code className="break-all rounded bg-white/70 px-1 py-0.5 text-xs">/dashboard/settings</code>) and click{' '}
            <span className="font-medium">Authorize OAuth</span> on the seller account card. If the card shows{' '}
            <span className="font-medium">Authorized</span> and <span className="font-medium">Revoke OAuth</span>, authorization is already complete.
          </li>
          <li>Select the same authorized account in the <span className="font-medium">Můj účet</span> dropdown in the dashboard header.</li>
          <li>
            On this page, select a product, click <span className="font-medium">Prepare draft</span>, review or save fields, then click{' '}
            <span className="font-medium">Confirm publish</span>.
          </li>
        </ol>
          <p className="mt-2 text-xs">
            The app starts OAuth through{' '}
            <code className="break-all rounded bg-white/70 px-1 py-0.5 text-xs">
              {'/api/allegro/oauth/authorize?accountId=<account id>'}
            </code>{' '}
            and redirects you to Allegro automatically. A pasted raw API URL is not the manual login link.
          </p>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <Input
                label="Search Catalog"
                placeholder="Product name, SKU, brand, EAN"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => loadProducts(1)} disabled={loading}>
              Apply
            </Button>
          </div>

          <div className="mt-5 space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Products that can be published on Allegro</h3>
                <span className="text-xs text-gray-500">{publishableProducts.length} products</span>
              </div>
              {publishableProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {publishableProducts.map((product) => (
                    <ProductTile
                      key={product.id}
                      product={product}
                      active={selectedProduct?.id === product.id}
                      onSelect={(nextProduct) => { void selectProduct(nextProduct); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  {loading ? 'Loading catalog products...' : 'No products ready for publishing'}
                </div>
              )}
            </section>

            <section className="border-t border-gray-200 pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Products sold on Allegro</h3>
                <span className="text-xs text-gray-500">{soldProducts.length} products</span>
              </div>
              {soldProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {soldProducts.map((product) => (
                    <ProductTile
                      key={product.id}
                      product={product}
                      active={selectedProduct?.id === product.id}
                      onSelect={(nextProduct) => { void selectProduct(nextProduct); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  No sold Allegro products found
                </div>
              )}
            </section>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</div>
            <div className="space-x-2">
              <Button variant="secondary" size="small" disabled={pagination.page <= 1 || loading} onClick={() => loadProducts(pagination.page - 1)}>
                Prev
              </Button>
              <Button variant="secondary" size="small" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => loadProducts(pagination.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Selected product">
            {selectedProduct ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{productTitle(selectedProduct)}</div>
                  <div className="text-gray-500">{productSku(selectedProduct)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="font-medium">Brand:</span> {selectedProduct.brand || selectedProduct.catalogProduct?.brand || '-'}</div>
                  <div><span className="font-medium">EAN:</span> {selectedProduct.ean || selectedProduct.catalogProduct?.ean || '-'}</div>
                  <div><span className="font-medium">Catalog category:</span> {productCategory(selectedProduct) || '[MISSING: catalog category]'}</div>
                  <div><span className="font-medium">Updated:</span> {formatDate(selectedProduct.updatedAt)}</div>
                </div>
                <Button variant="secondary" size="small" onClick={refreshSelectedStatus} disabled={statusLoading}>
                  {statusLoading ? 'Checking...' : 'Refresh publish status'}
                </Button>
                {selectedStatusError && (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
                    Draft controls are disabled because the product-scoped Allegro sell-action endpoint is not reachable: {selectedStatusError}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select a Catalog product to prepare an Allegro draft.</div>
            )}
          </Card>

          <Card title="Prepare Allegro draft">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Title" value={draftForm.title} onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })} disabled={!selectedProduct || sellActionUnavailable} />
                <Input label="Category ID" value={draftForm.categoryId} onChange={(event) => setDraftForm({ ...draftForm, categoryId: event.target.value })} disabled={!selectedProduct || sellActionUnavailable} />
                <Input label="Price" type="number" min="0" step="0.01" value={draftForm.price} onChange={(event) => setDraftForm({ ...draftForm, price: event.target.value })} disabled={!selectedProduct || sellActionUnavailable} />
                <Input label="Quantity" type="number" min="0" step="1" value={draftForm.quantity} onChange={(event) => setDraftForm({ ...draftForm, quantity: event.target.value })} disabled={!selectedProduct || sellActionUnavailable} />
              </div>

              {accountChoices.length > 0 && (
                <label className="block text-sm font-medium text-gray-700">
                  Allegro account
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draftForm.accountId}
                    onChange={(event) => setDraftForm({ ...draftForm, accountId: event.target.value })}
                    disabled={!selectedProduct || sellActionUnavailable}
                  >
                    {accountChoices.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || account.id}{account.isActive ? ' (active)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selectedContentPreview && (
                <div className="space-y-2 border-y border-gray-200 py-3 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">Catalog connector preview</div>
                      <div className="text-xs text-gray-500">
                        {(selectedContentPreview.label || 'Allegro')}{selectedContentPreview.format ? ` · ${selectedContentPreview.format}` : ''}{selectedContentPreview.source?.generatedAt ? ` · ${formatDate(selectedContentPreview.source.generatedAt)}` : ''}
                      </div>
                    </div>
                    <Button variant="secondary" size="small" onClick={applyCatalogPreviewDescription} disabled={!selectedContentPreviewDescription || !selectedProduct || sellActionUnavailable}>
                      Use preview
                    </Button>
                  </div>
                  {selectedContentPreview.content?.title && (
                    <div className="font-medium text-gray-900">{selectedContentPreview.content.title}</div>
                  )}
                  {selectedContentPreviewDescription && (
                    <div className="max-h-28 overflow-auto whitespace-pre-line rounded bg-gray-50 p-2 text-gray-700">
                      {selectedContentPreviewDescription}
                    </div>
                  )}
                  <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                    <div><span className="font-medium">Version:</span> {selectedContentPreview.source?.canonicalDocumentVersion || '-'}</div>
                    <div className="break-all"><span className="font-medium">Source hash:</span> {selectedContentPreview.source?.sourceHash || '-'}</div>
                    <div><span className="font-medium">Overrides:</span> {selectedContentPreview.overridesApplied ? 'applied' : 'none'}</div>
                    <div><span className="font-medium">Fallback:</span> {selectedContentPreview.source?.legacyDescriptionFallback ? 'legacy description' : 'canonical content'}</div>
                  </div>
                  {selectedContentPreview.warnings && selectedContentPreview.warnings.length > 0 && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {selectedContentPreview.warnings.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700">
                Description
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={draftForm.description}
                  onChange={(event) => setDraftForm({ ...draftForm, description: event.target.value })}
                  disabled={!selectedProduct || sellActionUnavailable}
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draftForm.forceNewDraft}
                  onChange={(event) => setDraftForm({ ...draftForm, forceNewDraft: event.target.checked })}
                  disabled={!selectedProduct || sellActionUnavailable}
                />
                Prepare a new draft instead of reusing an inactive draft
              </label>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handlePrepareDraft} disabled={!selectedProduct || sellActionUnavailable || preparing}>
                  {preparing ? 'Preparing...' : hasPreparedDraft ? 'Prepare again' : 'Prepare draft'}
                </Button>
                <Button variant="secondary" onClick={handleSaveDraft} disabled={!canEditDraft || savingDraft}>
                  {savingDraft ? 'Saving...' : 'Save draft fields'}
                </Button>
                <Button onClick={handleConfirmPublish} disabled={!canConfirmPublish || confirming}>
                  {confirming ? 'Confirming...' : 'Confirm publish'}
                </Button>
              </div>

              {!canConfirmPublish && (
                <p className="text-sm text-gray-500">
                  Confirm publish unlocks only after a prepared attempt exists and the backend returns `canConfirmPublish`.
                </p>
              )}
            </div>
          </Card>

          <Card title="Draft preview">
            {selectedStatus?.draft ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold text-gray-900">{selectedStatus.draft.title || '-'}</div>
                  <div className="text-gray-500">{selectedStatus.draft.id}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="font-medium">Status:</span> {selectedStatus.status || selectedStatus.draft.publicationStatus || '-'}</div>
                  <div><span className="font-medium">Next:</span> {selectedStatus.nextAction || '-'}</div>
                  <div><span className="font-medium">Price:</span> {selectedStatus.draft.price ?? '-'} {selectedStatus.draft.currency || 'PLN'}</div>
                  <div><span className="font-medium">Quantity:</span> {selectedStatus.draft.quantity ?? '-'}</div>
                  <div><span className="font-medium">Category:</span> {selectedStatus.draft.categoryId || '-'}</div>
                  <div><span className="font-medium">Attempt:</span> {selectedStatus.attempt?.id || '-'}</div>
                </div>
                {selectedStatus.attempt?.blockedReasons && selectedStatus.attempt.blockedReasons.length > 0 && (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
                    {selectedStatus.attempt.blockedReasons.join(', ')}
                  </div>
                )}
                {selectedProduct && previewTokensByProduct[selectedProduct.id] && (
                  <div className="rounded border border-blue-200 bg-blue-50 p-2 text-blue-700">
                    Preview token ready for this prepared attempt.
                  </div>
                )}
                {selectedStatus.catalogContentPreview?.source?.sourceHash && (
                  <div className="break-all text-xs text-gray-500">
                    Catalog preview source: {selectedStatus.catalogContentPreview.source.sourceHash}
                  </div>
                )}
                {selectedStatus.listingUrl && (
                  <a className="text-blue-700 hover:underline" href={selectedStatus.listingUrl} target="_blank" rel="noreferrer">
                    Open Allegro listing
                  </a>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No draft has been prepared for this Catalog product yet.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;

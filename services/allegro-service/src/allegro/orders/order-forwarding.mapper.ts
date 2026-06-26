export interface AllegroForwardingOffer {
  id?: string;
  allegroOfferId: string;
  catalogProductId?: string | null;
  accountId?: string | null;
  title?: string | null;
}

export interface ForwardedOrderItem {
  productId: string;
  sku: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ForwardedOrderPayload {
  externalOrderId: string;
  channel: "allegro";
  channelAccountId?: string;
  customer: {
    email?: string;
    login?: string;
  };
  items: ForwardedOrderItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  currency: string;
  paymentStatus?: string;
  orderedAt: Date;
}

export interface OrderForwardingBuildResult {
  orderData: ForwardedOrderPayload | null;
  blockedReasons: string[];
  missingOfferIds: string[];
  missingCatalogOfferIds: string[];
  lineOfferIds: string[];
}

export function getAllegroLineOfferIds(lineItems: any[] = []): string[] {
  return Array.from(new Set(
    lineItems
      .map((item) => String(item?.offer?.id || "").trim())
      .filter((offerId) => offerId.length > 0),
  ));
}

export function buildOrderForwardingPayload(
  allegroOrder: any,
  offersByAllegroOfferId: Map<string, AllegroForwardingOffer>,
): OrderForwardingBuildResult {
  const lineItems = allegroOrder?.lineItems || [];
  const blockedReasons: string[] = [];
  const missingOfferIds: string[] = [];
  const missingCatalogOfferIds: string[] = [];
  const lineOfferIds = getAllegroLineOfferIds(lineItems);

  if (lineItems.length === 0) {
    blockedReasons.push("missing_line_items");
  }

  const items: ForwardedOrderItem[] = [];

  for (const [index, item] of lineItems.entries()) {
    const allegroOfferId = String(item?.offer?.id || "").trim();

    if (!allegroOfferId) {
      blockedReasons.push(`missing_offer:line_${index}_missing_offer_id`);
      continue;
    }

    const offer = offersByAllegroOfferId.get(allegroOfferId);
    if (!offer) {
      blockedReasons.push(`missing_offer:line_${index}_missing_offer_mapping`);
      missingOfferIds.push(allegroOfferId);
      continue;
    }

    if (!offer.catalogProductId) {
      blockedReasons.push(`missing_catalog_product:line_${index}_missing_catalog_product_id`);
      missingCatalogOfferIds.push(allegroOfferId);
      continue;
    }

    const quantity = item?.quantity || 1;
    const unitPrice = parseFloat(item?.price?.amount || "0");

    items.push({
      productId: offer.catalogProductId,
      sku: null,
      title: item?.offer?.name || offer.title || "Product",
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    });
  }

  if (blockedReasons.length > 0) {
    return {
      orderData: null,
      blockedReasons,
      missingOfferIds: Array.from(new Set(missingOfferIds)),
      missingCatalogOfferIds: Array.from(new Set(missingCatalogOfferIds)),
      lineOfferIds,
    };
  }

  const firstMappedOffer = lineItems
    .map((item: any) => offersByAllegroOfferId.get(String(item?.offer?.id || "").trim()))
    .find((offer: AllegroForwardingOffer | undefined) => !!offer);

  return {
    orderData: {
      externalOrderId: allegroOrder.id,
      channel: "allegro",
      channelAccountId: firstMappedOffer?.accountId || undefined,
      customer: {
        email: allegroOrder?.buyer?.email,
        login: allegroOrder?.buyer?.login,
      },
      items,
      subtotal: parseFloat(allegroOrder?.totalPrice?.amount || "0"),
      shippingCost: 0,
      taxAmount: 0,
      total: parseFloat(allegroOrder?.totalPrice?.amount || "0"),
      currency: allegroOrder?.totalPrice?.currency || "PLN",
      paymentStatus: allegroOrder?.payment?.status,
      orderedAt: new Date(allegroOrder?.createdAt || Date.now()),
    },
    blockedReasons: [],
    missingOfferIds: [],
    missingCatalogOfferIds: [],
    lineOfferIds,
  };
}

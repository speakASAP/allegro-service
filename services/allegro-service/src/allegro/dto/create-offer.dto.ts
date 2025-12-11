/**
 * Create Offer DTO
 */

export class CreateOfferDto {
  productId?: string;
  allegroProductId?: string; // Link to existing AllegroProduct
  allegroOfferId?: string; // For local-only offers
  title: string;
  description?: string;
  categoryId?: string;
  price?: number;
  quantity?: number;
  currency?: string;
  status?: string;
  publicationStatus?: string;
  images?: string[];
  ean?: string;
  parameters?: Array<{
    id: string;
    values: string[];
  }>;
  deliveryOptions?: any;
  paymentOptions?: any;
  rawData?: any;
  syncToAllegro?: boolean; // If false, create local-only offer without syncing to Allegro API
}


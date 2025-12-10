/**
 * Update Offer DTO
 */

export interface AttributeUpdate {
  id: string;
  values: string[];
}

export class UpdateOfferDto {
  title?: string;
  description?: string;
  categoryId?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  stockQuantity?: number;
  images?: string[];
  status?: string;
  publicationStatus?: string;
  deliveryOptions?: any;
  paymentOptions?: any;
  attributes?: AttributeUpdate[];
}


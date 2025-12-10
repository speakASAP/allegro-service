# Data Extraction Fix - Comprehensive Field Extraction

## Summary

Fixed data extraction to ensure **ALL** fields from Allegro API responses are correctly extracted, separated from raw data, and saved in the database.

## Problem

Previously, data extraction was done manually in each import function, leading to:

- Inconsistent field extraction across different import methods
- Missing fields (deliveryOptions, paymentOptions, allegroListingId)
- Duplicated extraction logic
- Risk of data loss during import

## Solution

Created a centralized `extractOfferData()` function that:

1. Extracts ALL fields from Allegro API response
2. Normalizes data types (strings to numbers, etc.)
3. Handles missing/null values gracefully
4. Separates structured data from raw payload

## Extracted Fields

The `extractOfferData()` function extracts the following fields:

| Database Field | Source in Allegro API | Notes |
|---------------|----------------------|-------|
| `allegroOfferId` | `allegroOffer.id` | Required, unique identifier |
| `allegroListingId` | `allegroOffer.listing?.id` or `allegroOffer.external?.id` | Optional listing ID |
| `title` | `allegroOffer.name` | Offer title/name |
| `description` | `allegroOffer.description` | HTML description |
| `categoryId` | `allegroOffer.category?.id` | Category identifier |
| `price` | `allegroOffer.sellingMode?.price?.amount` | Parsed to float |
| `currency` | `allegroOffer.sellingMode?.price?.currency` | Defaults to CZK if missing |
| `quantity` | `allegroOffer.stock?.available` | Stock quantity |
| `stockQuantity` | `allegroOffer.stock?.available` | Same as quantity |
| `status` | `allegroOffer.publication?.status` | Publication status |
| `publicationStatus` | `allegroOffer.publication?.status` | Same as status |
| `images` | `allegroOffer.images` | Extracted via `extractImages()` |
| `deliveryOptions` | `allegroOffer.delivery` or `allegroOffer.deliveryOptions` | Delivery methods |
| `paymentOptions` | `allegroOffer.payments` or `allegroOffer.paymentOptions` | Payment methods |
| `rawData` | `allegroOffer` (full object) | Complete raw payload |

## Updated Import Locations

All import functions now use `extractOfferData()`:

1. ✅ `importAllOffers()` - Main import from Allegro API
2. ✅ `importApprovedOffers()` - Import approved offers from preview
3. ✅ `importApprovedOffersFromSalesCenter()` - Import from Sales Center
4. ✅ `previewOffersFromAllegro()` - Preview offers (for consistency)
5. ✅ `previewOffersFromSalesCenter()` - Preview from Sales Center

## Benefits

1. **Consistency**: All imports use the same extraction logic
2. **Completeness**: All fields are extracted, nothing is lost
3. **Maintainability**: Single source of truth for extraction logic
4. **Reliability**: Proper handling of missing/null values
5. **Separation**: Structured data separated from raw payload

## Code Structure

```typescript
private extractOfferData(allegroOffer: any): any {
  const images = this.extractImages(allegroOffer);
  const stockAvailable = allegroOffer.stock?.available || 0;
  const publicationStatus = allegroOffer.publication?.status || 'INACTIVE';
  const priceAmount = allegroOffer.sellingMode?.price?.amount || '0';
  const currency = allegroOffer.sellingMode?.price?.currency || this.getDefaultCurrency();

  return {
    allegroOfferId: allegroOffer.id,
    allegroListingId: allegroOffer.listing?.id || allegroOffer.external?.id || null,
    title: allegroOffer.name || '',
    description: allegroOffer.description || null,
    categoryId: allegroOffer.category?.id || '',
    price: parseFloat(priceAmount),
    currency: currency,
    quantity: stockAvailable,
    stockQuantity: stockAvailable,
    status: publicationStatus,
    publicationStatus: publicationStatus,
    images: images,
    deliveryOptions: allegroOffer.delivery || allegroOffer.deliveryOptions || null,
    paymentOptions: allegroOffer.payments || allegroOffer.paymentOptions || null,
    rawData: allegroOffer as any,
  };
}
```

## Testing

After this fix:

- All imported offers should have complete data in database fields
- `deliveryOptions` and `paymentOptions` should be populated
- `allegroListingId` should be captured if present
- `rawData` should contain the complete payload
- Validation should pass for offers with complete data

## Status

✅ **Complete** - All import locations updated, all fields extracted, no linter errors.

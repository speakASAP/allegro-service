# TASK-005 Validation Evidence

## Synthetic request fixture

```json
{
  "contractVersion": "2026-06-20.ai-offer-optimization.v1",
  "correlationId": "corr-task005-001",
  "channel": "allegro",
  "accountId": "11111111-1111-4111-8111-111111111111",
  "catalogProductId": "22222222-2222-4222-8222-222222222222",
  "offerId": "33333333-3333-4333-8333-333333333333",
  "snapshotHash": "sha256:synthetic-task005-request",
  "requestedSuggestionTypes": ["title", "description", "images", "pricing"],
  "offerContext": {
    "title": "Synthetic hiking backpack 40L",
    "descriptionSections": ["lightweight nylon", "water resistant"],
    "categoryId": "12345",
    "attributes": [{"id": "capacity", "value": "40L"}],
    "images": ["https://example.invalid/backpack-front.jpg"],
    "price": {"amount": "199.99", "currency": "PLN"},
    "stock": {"available": 12, "status": "IN_STOCK"},
    "qualitySignals": {"missingAttributes": 1, "imageCount": 1, "validationStatus": "WARNINGS"}
  },
  "policyContext": {
    "publishReadiness": "WARN",
    "blockers": [],
    "warnings": ["image-count-low"],
    "recommendations": ["add-lifestyle-image"],
    "reviewRequired": true
  },
  "performanceContext": {
    "window": "30d",
    "views": 240,
    "conversions": 4,
    "returnRate": 0,
    "marginStatus": "UNKNOWN"
  },
  "constraints": {
    "draftOnly": true,
    "currency": "PLN",
    "forbiddenMutations": ["direct_publish", "direct_price_apply"]
  }
}
```

## Synthetic response fixture

```json
{
  "contractVersion": "2026-06-20.ai-offer-optimization.v1",
  "correlationId": "corr-task005-001",
  "generatedAt": "2026-06-20T07:21:37Z",
  "snapshotHash": "sha256:synthetic-task005-request",
  "model": {
    "provider": "[MISSING: provider name]",
    "model": "[MISSING: model id]",
    "version": "[MISSING: provider version metadata]"
  },
  "suggestions": [
    {
      "suggestionId": "sg-001",
      "type": "title",
      "targetField": "title",
      "status": "DRAFT_REVIEW",
      "proposedValue": "Synthetic ultralight hiking backpack 40L",
      "confidence": 0.82,
      "expectedImpact": "higher click-through on outdoor keyword search",
      "evidence": ["title length improved", "high-intent keyword added"],
      "policyBlockers": [],
      "rollbackNotes": ["restore previous title if CTR falls after approved experiment window"],
      "requiresHumanReview": true
    }
  ],
  "summary": {
    "overallStatus": "ADVISORY_ONLY",
    "reviewState": "PENDING_OPERATOR_REVIEW",
    "nextAction": "review_suggestions",
    "blockedApplyReasons": ["direct_publish_forbidden", "manual_mapping_to_lifecycle_required"]
  },
  "redactionReport": {
    "profile": "allegro-offer-suggestion-v1",
    "removedFields": ["authorizationHeader", "customerRecords", "paymentDetails"]
  }
}
```

## Synthetic local record fixture

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "contractVersion": "2026-06-20.ai-offer-optimization.v1",
  "correlationId": "corr-task005-001",
  "snapshotHash": "sha256:synthetic-task005-request",
  "accountId": "11111111-1111-4111-8111-111111111111",
  "catalogProductId": "22222222-2222-4222-8222-222222222222",
  "offerId": "33333333-3333-4333-8333-333333333333",
  "suggestionType": "title",
  "reviewStatus": "DRAFT_REVIEW",
  "modelMetadata": {
    "provider": "[MISSING: provider name]",
    "model": "[MISSING: model id]"
  },
  "policySnapshot": {
    "warnings": ["image-count-low"],
    "blockers": []
  },
  "proposedValue": "Synthetic ultralight hiking backpack 40L",
  "expectedImpact": "higher click-through on outdoor keyword search",
  "rollbackNotes": ["restore previous title if CTR falls after approved experiment window"]
}
```

## Redaction review checklist

- No OAuth tokens or Authorization headers.
- No raw customer or order records.
- No payment or supplier secrets.
- No production log excerpts.
- All URLs use `example.invalid` or synthetic placeholders.

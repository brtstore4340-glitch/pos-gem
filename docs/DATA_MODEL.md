# Data Model (Draft)

## Firestore Collections (planned)
- stores/{storeId}
  - name, address, timezone, settings
- users/{userId}
  - role, storeIds[], isActive
- products/{productId}
  - sku, name, category, price, is_active, barcode[], images[]
- orders/{orderId}
  - storeId, cashierId, items[], totals, payment, status, createdAt
- reports/{reportId}
  - storeId, type(daily/cashier), aggregates, createdAt

## Notes
- Use server timestamps
- Index by storeId + createdAt for orders/reports

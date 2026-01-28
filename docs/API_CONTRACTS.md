# API Contracts (Draft)

## productService
- listProducts({ storeId, q, category, limit, cursor })
- getProductByBarcode(barcode)
- upsertProduct(product)

## posService
- addToCart(productId, qty)
- checkout({ paymentMethod, receivedAmount? })
- printReceipt(orderId)

## reportService
- getDailyReport({ storeId, date })

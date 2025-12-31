// src/services/promotionEngine.js

/**
 * DEPRECATED: Logic moved to Server Side (Cloud Functions).
 * This file is kept only for reference or minor client-side display utils if absolutely needed,
 * but core calculation should now happen in `functions/src/services/cartService.js`.
 * 
 * Future Cleanup: Delete this file once we confirm server-side calculation covers all edge cases.
 */

export const getPromotionBadge = (item) => {
  // This is now purely for display if we have the data locally, 
  // but ideally we just use `badgeText` returned from server.
  if (item.badgeText) return item.badgeText;
  return null;
};

export const calculateLine = (item) => {
  console.warn("Using deprecated client-side calculateLine. Please rely on server calculation.");
  return {
    finalTotal: item.calculatedTotal || (item.price * item.qty),
    discountAmount: item.promoDiscount || 0,
    badgeText: item.badgeText || null
  };
};
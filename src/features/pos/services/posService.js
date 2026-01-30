export const posService = {
  async checkout({ items, paymentMethod }) {
    // TODO: create order + payment record (Cloud Function preferred)
    return { ok: true, orderId: "order_demo", items, paymentMethod };
  }
};

import * as React from "react";
import { toast } from "sonner";

import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableRoot, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

import { useCart } from "@/features/pos/hooks/useCart";
import { useScanListener } from "@/features/pos/hooks/useScanListener";
import { productService } from "@/features/products/services/productService";
import { ProductLookupModal } from "@/features/pos/components/ProductLookupModal";
import { ReceiptDialog } from "@/features/pos/components/ReceiptDialog";
import { calcTotals } from "@/features/pos/services/posCalc";
import { posOrderService } from "@/features/pos/services/posOrderService";

export function PosPage() {
  const cart = useCart();

  const [discountType, setDiscountType] = React.useState("percent"); // percent | amount
  const [discountValue, setDiscountValue] = React.useState(0);
  const discount = React.useMemo(() => ({ type: discountType, value: Number(discountValue) || 0 }), [discountType, discountValue]);

  const totals = React.useMemo(() => calcTotals(cart.items, discount), [cart.items, discount]);

  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState("cash"); // cash | transfer | card (future)
  const [received, setReceived] = React.useState("");
  const [lastOrder, setLastOrder] = React.useState(null);
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  // Scan -> lookup product by barcode -> add to cart
  useScanListener(async (code) => {
    const p = await productService.getProductByBarcode(code);
    if (!p) {
      toast.error("Product not found", { description: code });
      return;
    }
    cart.addItem(p, 1);
    toast.success("Added", { description: p.name });
  });

  function onPickProduct(p) {
    cart.addItem(p, 1);
    toast.success("Added", { description: p.name });
  }

  async function checkoutConfirm() {
    if (!cart.items.length) {
      toast.error("Cart is empty");
      return;
    }

    const rec = Number(received) || 0;
    if (paymentMethod === "cash" && rec < totals.total) {
      toast.error("Insufficient cash", { description: `Need ฿${totals.total}` });
      return;
    }

    const order = await posOrderService.createOrder({
      paymentMethod,
      receivedAmount: paymentMethod === "cash" ? rec : null,
      change: paymentMethod === "cash" ? Math.max(0, rec - totals.total) : null,
      discount,
      totals,
      items: cart.items
    });

    setLastOrder(order);
    setReceiptOpen(true);
    setCheckoutOpen(false);
    cart.clear();
    setReceived("");
    toast.success("Order created", { description: order.id });
  }

  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>POS v1</CardTitle>
              <CardDescription>
                Scan barcode / lookup products / discount / checkout / receipt (localStorage).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Items: {cart.items.reduce((s, it) => s + (it.qty || 0), 0)}</Badge>
              <Badge variant="outline">Subtotal: ฿{totals.subtotal}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <ProductLookupModal onPick={onPickProduct} />
            <Button onClick={() => cart.addItem({ id: "demo", name: "Demo item", category: "Demo", price: 99 }, 1)}>
              Add Demo
            </Button>

            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!cart.items.length}>Checkout</Button>
              </DialogTrigger>

              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Checkout</DialogTitle>
                  <DialogDescription>Confirm payment and create order.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>฿{totals.subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>- ฿{totals.discountValue}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>฿{totals.total}</span>
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="text-xs text-muted-foreground">Payment method</div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={paymentMethod === "cash" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("cash")}
                      >
                        Cash
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "transfer" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("transfer")}
                      >
                        Transfer
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === "card" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("card")}
                      >
                        Card
                      </Button>
                    </div>
                  </div>

                  {paymentMethod === "cash" && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Received amount</div>
                      <Input
                        id="received"
                        inputMode="numeric"
                        placeholder={`>= ${totals.total}`}
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Change: ฿{Math.max(0, (Number(received) || 0) - totals.total)}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                  <Button onClick={checkoutConfirm}>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="destructive" onClick={() => { cart.clear(); toast("Cart cleared"); }} disabled={!cart.items.length}>
              Clear Cart
            </Button>
          </div>

          {/* Discount controls */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Discount</div>
              <Badge variant="muted">
                - ฿{totals.discountValue} ({discountType === "percent" ? `${discountValue}%` : `฿${discountValue}`})
              </Badge>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-48"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                aria-label="Discount type"
              >
                <option value="percent">Percent (%)</option>
                <option value="amount">Amount (฿)</option>
              </select>

              <Input
                id="discount"
                inputMode="numeric"
                placeholder={discountType === "percent" ? "0 - 100" : "Amount"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />

              <Button
                variant="outline"
                onClick={() => { setDiscountValue(0); toast("Discount reset"); }}
              >
                Reset
              </Button>

              <div className="ml-auto text-sm font-semibold flex items-center">
                Total: ฿{totals.total}
              </div>
            </div>
          </div>

          {/* Cart table */}
          <Table className="border rounded-lg">
            <TableRoot>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Price</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{it.name}</span>
                        {it.sku && <Badge variant="muted">{it.sku}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{it.category || ""}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => cart.dec(it.id)}>-</Button>
                        <span className="min-w-6 text-center">{it.qty}</span>
                        <Button size="sm" variant="outline" onClick={() => cart.inc(it.id)}>+</Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">฿{it.price}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => cart.removeItem(it.id)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}

                {!cart.items.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Scan a barcode or use lookup. Demo barcodes:
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["8850000000001","8850000000002","8850000000003"].map((b) => (
                          <Button key={b} size="sm" variant="outline" onClick={() => window.__emitScan?.(b)}>{b}</Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </TableRoot>
          </Table>
        </CardContent>
      </Card>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} order={lastOrder} />
    </Container>
  );
}

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableRoot, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function ReceiptDialog({ open, onOpenChange, order }) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription>Order ID: <span className="font-medium">{order.id}</span></DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment</span>
            <Badge variant="secondary">{order.paymentMethod}</Badge>
          </div>
        </div>

        <Table className="border rounded-lg">
          <TableRoot>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-right">{it.qty}</TableCell>
                  <TableCell className="text-right">฿{it.price}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableRoot>
        </Table>

        <div className="text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>฿{order.totals.subtotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>- ฿{order.totals.discountValue}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>฿{order.totals.total}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>Print (stub)</Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

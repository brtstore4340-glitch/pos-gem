import * as React from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableRoot, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { productService } from "@/features/products/services/productService";

export function ProductLookupModal({ onPick, triggerLabel = "Add Product" }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("All");
  const [categories, setCategories] = React.useState(["All"]);
  const [items, setItems] = React.useState([]);

  async function load() {
    const cats = await productService.listCategories();
    setCategories(cats);
    const res = await productService.listProducts({ q, category });
    setItems(res.items);
  }

  React.useEffect(() => {
    if (!open) return;
    load();
     
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(), 150);
    return () => clearTimeout(t);
     
  }, [q, category]);

  function pick(p) {
    onPick?.(p);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Item Search</DialogTitle>
          <DialogDescription>Search and add products to cart.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-3">
          <Input
            id="product-search"
            placeholder="Search name or SKU..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <Table className="border rounded-lg">
          <TableRoot>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-24 text-right">Price</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      <Badge variant="muted">{p.sku}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Barcode: {p.barcode?.[0] || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="text-right">฿{p.price}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => pick(p)}>Add</Button>
                  </TableCell>
                </TableRow>
              ))}

              {!items.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableRoot>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

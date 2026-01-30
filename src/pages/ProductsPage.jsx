import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { productService } from "@/features/products/services/productService";

export function ProductsPage() {
  const [items, setItems] = React.useState([]);

  async function load() {
    const res = await productService.listProducts({ q: "" });
    setItems(res.items);
  }

  React.useEffect(() => { load(); }, []);

  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Products (Skeleton)</CardTitle>
          <CardDescription>Service adapter stub in place. Replace with Firestore later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={load}>Reload</Button>
            <Button variant="outline" onClick={() => alert("Next: import products + categories")}>Next Step</Button>
          </div>

          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id} className="border rounded-md px-3 py-2">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category} • ฿{p.price}</div>
              </li>
            ))}
          </ul>

          {!items.length && (
            <div className="text-sm text-muted-foreground">No products yet (stub returns demo data).</div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}

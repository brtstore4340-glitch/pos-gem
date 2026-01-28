import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Baseline Ready ✅</CardTitle>
          <CardDescription>Modules created: auth, pos, products, orders, reports, settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Next: implement Auth + Products import + POS cart flow.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => location.assign("/pos")}>Go to POS</Button>
            <Button variant="outline" onClick={() => location.assign("/products")}>Products</Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}


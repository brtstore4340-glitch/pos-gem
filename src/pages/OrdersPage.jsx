import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function OrdersPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Orders (Skeleton)</CardTitle>
          <CardDescription>Next: order history, refunds, status.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}

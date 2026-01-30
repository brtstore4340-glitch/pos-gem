import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function ReportsPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Reports (Skeleton)</CardTitle>
          <CardDescription>Next: daily report + cashier report.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}

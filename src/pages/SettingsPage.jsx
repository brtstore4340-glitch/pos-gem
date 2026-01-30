import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Settings (Skeleton)</CardTitle>
          <CardDescription>Next: store profile, devices, printers.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}

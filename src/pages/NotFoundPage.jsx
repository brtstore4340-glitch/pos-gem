import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>404</CardTitle>
          <CardDescription>Page not found.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => location.assign("/")}>Go Home</Button>
        </CardContent>
      </Card>
    </Container>
  );
}

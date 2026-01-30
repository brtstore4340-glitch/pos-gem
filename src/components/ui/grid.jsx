import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const gridVariants = cva("grid", {
  variants: {
    cols: {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
    },
    gap: {
      none: "gap-0",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8"
    }
  },
  defaultVariants: {
    cols: 3,
    gap: "md"
  }
});

function Grid({ className, cols, gap, ...props }) {
  return <div className={cn(gridVariants({ cols, gap }), className)} {...props} />;
}

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-full"
    }
  },
  defaultVariants: {
    size: "xl"
  }
});

function Container({ className, size, ...props }) {
  return <div className={cn(containerVariants({ size }), className)} {...props} />;
}

export { Grid, Container };

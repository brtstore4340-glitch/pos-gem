import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(function Input({ className, error, id, ...props }, ref) {
  const describedBy = error && id ? `${id}-error` : undefined;

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
            "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
            "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...props}
      />
      {error && id && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export { Input };

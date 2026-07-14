"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** App-wide toast host. Mount once in the root layout. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border bg-card text-card-foreground shadow-overlay",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}

export { toast };

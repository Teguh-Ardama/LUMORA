"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Page-level toolbar: title + description on the left, actions on the
 * right. Collapses gracefully on small screens.
 */
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Toolbar({ title, description, actions, className, ...props }: ToolbarProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between", className)}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

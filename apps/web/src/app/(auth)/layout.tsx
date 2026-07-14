import { Aperture } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Aperture className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">LUMORA</span>
        </div>
        {children}
      </div>
    </main>
  );
}

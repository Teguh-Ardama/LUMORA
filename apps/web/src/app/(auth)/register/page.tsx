"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@lumora/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  toast,
} from "@lumora/ui";
import { useRegister } from "@/lib/hooks/use-auth";
import { ApiClientError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", organizationName: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Registration failed");
    }
  });

  const err = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>Start running professional photobooth events in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input id="organizationName" placeholder="Aurora Wedding Co." {...form.register("organizationName")} />
            {err.organizationName ? <p className="text-xs text-destructive">{err.organizationName.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" {...form.register("name")} />
            {err.name ? <p className="text-xs text-destructive">{err.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            {err.email ? <p className="text-xs text-destructive">{err.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            {err.password ? <p className="text-xs text-destructive">{err.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" loading={register.isPending}>
            Create organization
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

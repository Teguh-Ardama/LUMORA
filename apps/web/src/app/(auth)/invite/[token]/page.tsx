"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordSchema } from "@lumora/contracts";
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
import { useAcceptInvite } from "@/lib/hooks/use-auth";
import { ApiClientError } from "@/lib/api";

const formSchema = z.object({
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
});
type FormValues = z.infer<typeof formSchema>;

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const accept = useAcceptInvite();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await accept.mutateAsync({ token, ...values });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not accept the invite");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join your team</CardTitle>
        <CardDescription>Set up your account to accept the invitation.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" loading={accept.isPending}>
            Accept invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
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
  LoadingState,
  Toolbar,
  toast,
} from "@lumora/ui";
import { useOrganization, useUpdateOrganization } from "@/lib/hooks/use-admin";
import { useMe } from "@/lib/hooks/use-auth";
import { apiClient, ApiClientError } from "@/lib/api";

const orgFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  supportEmail: z.string().trim().email().max(255).or(z.literal("")),
});
type OrgFormValues = z.infer<typeof orgFormSchema>;

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: passwordSchema,
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function OrgSettingsCard() {
  const { data, isLoading } = useOrganization();
  const update = useUpdateOrganization();

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema),
    values: data
      ? { name: data.organization.name, supportEmail: data.organization.supportEmail ?? "" }
      : undefined,
  });

  if (isLoading) return <LoadingState />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ name: values.name, supportEmail: values.supportEmail || null });
      toast.success("Organization updated");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Update failed");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organization</CardTitle>
        <CardDescription>Shown to guests on delivery pages and emails.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-email">Support email</Label>
            <Input id="org-email" type="email" placeholder="support@studio.com" {...form.register("supportEmail")} />
            {form.formState.errors.supportEmail ? (
              <p className="text-xs text-destructive">{form.formState.errors.supportEmail.message}</p>
            ) : null}
          </div>
          <Button type="submit" loading={update.isPending}>
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { data: me } = useMe();
  const [name, setName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const value = name ?? me?.user.name ?? "";

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch("/api/auth/me", { name: value.trim() });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Your display name across the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input id="profile-name" value={value} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={me?.user.email ?? ""} disabled />
        </div>
        <Button onClick={save} loading={saving} disabled={value.trim().length < 2}>
          Save profile
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const [saving, setSaving] = React.useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await apiClient.post("/api/auth/me/password", values);
      toast.success("Password changed — other sessions were signed out");
      form.reset();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Change failed");
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Password</CardTitle>
        <CardDescription>Changing your password revokes every other active session.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
            {form.formState.errors.currentPassword ? (
              <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" {...form.register("newPassword")} />
            {form.formState.errors.newPassword ? (
              <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: me } = useMe();
  const canManageOrg = me?.user.role === "OWNER" || me?.user.role === "ADMIN";

  return (
    <div>
      <Toolbar title="Settings" description="Organization and personal preferences." />
      <div className="space-y-6">
        {canManageOrg ? <OrgSettingsCard /> : null}
        <ProfileCard />
        <PasswordCard />
      </div>
    </div>
  );
}

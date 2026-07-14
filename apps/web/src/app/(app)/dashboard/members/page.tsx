"use client";

import * as React from "react";
import { format } from "date-fns";
import { Copy, MailPlus, ShieldCheck, Trash2, UserX, Users } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
  toast,
} from "@lumora/ui";
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMember,
} from "@/lib/hooks/use-admin";
import { useMe } from "@/lib/hooks/use-auth";
import { ApiClientError } from "@/lib/api";

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const invite = useInviteMember();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("OPERATOR");
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);

  const submit = async () => {
    try {
      const result = await invite.mutateAsync({ email: email.trim().toLowerCase(), role });
      setInviteUrl(result.inviteUrl);
      toast.success("Invitation created");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not send the invite");
    }
  };

  const close = () => {
    onOpenChange(false);
    setEmail("");
    setInviteUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>They will join your organization with the selected role.</DialogDescription>
        </DialogHeader>
        {inviteUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link with them (it is also emailed when SMTP is configured). Valid for 7 days.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 text-xs">{inviteUrl}</code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy invite link"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl);
                  toast.success("Invite link copied");
                }}
              >
                <Copy />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="operator@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin — full management access</SelectItem>
                    <SelectItem value="OPERATOR">Operator — booth console only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button onClick={submit} loading={invite.isPending} disabled={!email.includes("@")}>
                <MailPlus /> Send invite
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MembersPage() {
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useMembers();
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const revokeInvite = useRevokeInvite();
  const [inviteOpen, setInviteOpen] = React.useState(false);

  if (isLoading) return <LoadingState label="Loading members…" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div>
      <Toolbar
        title="Members & Roles"
        description="Who can manage events, and who can operate the booth."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <MailPlus /> Invite member
          </Button>
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.members.map((m) => {
            const isSelf = m.userId === me?.user.id;
            const isOwner = m.role === "OWNER";
            return (
              <TableRow key={m.membershipId}>
                <TableCell>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </TableCell>
                <TableCell>
                  {isOwner || isSelf ? (
                    <Badge variant={isOwner ? "default" : "secondary"}>{m.role}</Badge>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={(role) =>
                        updateMember.mutate(
                          { userId: m.userId, role },
                          {
                            onSuccess: () => toast.success("Role updated"),
                            onError: () => toast.error("Could not update role"),
                          },
                        )
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={m.isActive ? "success" : "muted"}>{m.isActive ? "Active" : "Suspended"}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {m.lastLoginAt ? format(new Date(m.lastLoginAt), "d MMM, HH:mm") : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  {!isOwner && !isSelf ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={m.isActive ? "Suspend" : "Reactivate"}
                        onClick={() =>
                          updateMember.mutate(
                            { userId: m.userId, isActive: !m.isActive },
                            { onSuccess: () => toast.success(m.isActive ? "Member suspended" : "Member reactivated") },
                          )
                        }
                      >
                        {m.isActive ? <UserX /> : <ShieldCheck />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove member"
                        onClick={() =>
                          removeMember.mutate(m.userId, {
                            onSuccess: () => toast.success("Member removed"),
                            onError: () => toast.error("Could not remove member"),
                          })
                        }
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {data.invites.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" /> Pending invitations
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{inv.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(inv.expiresAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Revoke invite"
                      onClick={() =>
                        revokeInvite.mutate(inv.id, { onSuccess: () => toast.success("Invite revoked") })
                      }
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

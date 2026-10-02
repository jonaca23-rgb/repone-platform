import type { Metadata } from "next";
import Link from "next/link";
import { Route as RouteIcon } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createCircuit, deleteCircuit } from "@/lib/actions/circuits";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Circuits" };

export default async function CircuitsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: circuits } = await supabase
    .from("circuits")
    .select("id, name, description, starts_on, ends_on")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("starts_on", { ascending: false, nullsFirst: false });

  const { data: eventCounts } = await supabase
    .from("events")
    .select("circuit_id")
    .eq("organization_id", ctx?.organizationId ?? "")
    .not("circuit_id", "is", null);

  const countByCircuit = new Map<string, number>();
  for (const row of eventCounts ?? []) {
    if (!row.circuit_id) continue;
    countByCircuit.set(row.circuit_id, (countByCircuit.get(row.circuit_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Circuits"
        description="A circuit groups several events into one season so a competitor's placement at each stop rolls up into a single cumulative leaderboard. You can also start one from the New event form on the Events page; this page is for managing one directly, or adding an existing standalone event to it."
      />

      <Card>
        <CardContent>
          <form action={createCircuit} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="circuit-name">Circuit name</Label>
              <Input
                id="circuit-name"
                name="name"
                required
                placeholder="MSTRS League PR"
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="circuit-description">Description (optional)</Label>
              <Input id="circuit-description" name="description" className="w-64 text-base" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="circuit-starts">Season starts</Label>
              <Input id="circuit-starts" name="starts_on" type="date" className="text-base" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="circuit-ends">Season ends</Label>
              <Input id="circuit-ends" name="ends_on" type="date" className="text-base" />
            </div>
            <Button type="submit">Create circuit</Button>
          </form>
        </CardContent>
      </Card>

      {circuits?.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="No circuits yet"
          description="Create one above, or start one from the New event form on the Events page."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(circuits ?? []).map((c) => {
            const count = countByCircuit.get(c.id) ?? 0;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
              >
                <Link
                  href={`/admin/circuits/${c.id}`}
                  className="flex flex-1 flex-wrap items-center gap-3"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {count} event{count === 1 ? "" : "s"}
                  </span>
                  {(c.starts_on || c.ends_on) && (
                    <span className="text-xs text-muted-foreground">
                      {c.starts_on ?? "—"}{" "}
                      {c.ends_on && c.ends_on !== c.starts_on ? `→ ${c.ends_on}` : ""}
                    </span>
                  )}
                </Link>
                <ConfirmAction
                  trigger="Delete circuit"
                  title={`Delete ${c.name}?`}
                  description="The circuit and its cumulative leaderboard go away. Its events stay, as standalone events with their own results."
                  confirmLabel="Delete circuit"
                  onConfirm={deleteCircuit.bind(null, c.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

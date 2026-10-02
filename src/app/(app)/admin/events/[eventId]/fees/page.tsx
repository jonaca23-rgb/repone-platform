import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { createFeeSchedule, toggleFeeScheduleActive, deleteFeeSchedule } from "@/lib/actions/fees";
import type { CompetitorEntryType } from "@/lib/db/database.types";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

const ENTRY_TYPE_LABELS: Record<CompetitorEntryType, string> = {
  individual: "Individual",
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Fees · ${event.name}` : "Fees" };
}

export default async function EventFeesPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [event, { data: divisions }, { data: feeSchedules }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("fee_schedules")
      .select("id, name, description, division_id, entry_type, amount_cents, is_addon, active")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  const divisionName = (id: string | null) =>
    id ? divisions?.find((d) => d.id === id)?.name : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Registration fees"
        description="What this event charges: the price menu the Payments page uses to record who owes what. No online payment is taken here and nothing talks to a payment processor; fees are recorded by hand. Leave Division or Entry type on Any to apply a fee broadly."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Fees" })} />}
      />

      <Card>
        <CardContent>
          <form
            action={createFeeSchedule.bind(null, eventId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="fee-name">Fee name</Label>
              <Input
                id="fee-name"
                name="name"
                required
                placeholder="Individual Registration"
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee-amount">Amount (USD)</Label>
              <Input
                id="fee-amount"
                name="amount_dollars"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="75.00"
                className="w-28 text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee-division">Division</Label>
              <Select name="division_id" defaultValue={NONE}>
                <SelectTrigger id="fee-division" className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any division</SelectItem>
                  {(divisions ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee-entry">Entry type</Label>
              <Select name="entry_type" defaultValue={NONE}>
                <SelectTrigger id="fee-entry" className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any entry type</SelectItem>
                  {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee-description">Description</Label>
              <Input
                id="fee-description"
                name="description"
                placeholder="Optional"
                className="text-base"
              />
            </div>
            <div className="flex h-9 items-center gap-2">
              <Checkbox id="fee-addon" name="is_addon" />
              <Label htmlFor="fee-addon">Optional add-on (not a base registration fee)</Label>
            </div>
            <Button type="submit">Add fee</Button>
          </form>
        </CardContent>
      </Card>

      {feeSchedules?.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No fees set up yet"
          description="Add one above, then apply it to registrations from Payments."
          action={
            <Button asChild variant="outline">
              <Link href={`/admin/events/${eventId}/payments`}>Go to Payments</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(feeSchedules ?? []).map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {f.name} <span className="text-brand-text">{formatMoney(f.amount_cents)}</span>
                  {f.is_addon ? (
                    <Badge variant="secondary" className="uppercase">
                      Add-on
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {divisionName(f.division_id) ?? "Any division"} ·{" "}
                  {f.entry_type
                    ? ENTRY_TYPE_LABELS[f.entry_type as CompetitorEntryType]
                    : "Any entry type"}
                </p>
                {f.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <ActionSwitch
                  checked={f.active}
                  action={toggleFeeScheduleActive.bind(null, eventId, f.id)}
                  label={`${f.name} active`}
                />
                <ConfirmAction
                  trigger="Delete"
                  title={`Delete ${f.name}?`}
                  description="The fee comes off this event's price menu. Payments already recorded keep their amounts."
                  confirmLabel="Delete fee"
                  onConfirm={deleteFeeSchedule.bind(null, eventId, f.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

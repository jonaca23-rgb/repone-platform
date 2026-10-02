import type { Metadata } from "next";
import { BadgeDollarSign } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createSponsor, toggleSponsorActive } from "@/lib/actions/sponsors";
import type { SponsorTier } from "@/lib/db/database.types";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
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

export const metadata: Metadata = { title: "Sponsors" };

const TIER_LABELS: Record<SponsorTier, string> = {
  logo_sponsor: "Logo Sponsor — $50/event",
  brand_mention: "Brand Mention — $75/event",
  commercial_30: "Commercial 30 — $90 (3x :30)",
  commercial_30_plus: "Commercial 30 Plus — $150 (6x :30)",
  wod_sponsor: "WOD Sponsor — $200",
  presenting_sponsor: "Presenting Sponsor — $450",
};

export default async function SponsorsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const [{ data: sponsors }, { data: events }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, business_name, tier, category, category_exclusive, active, event_id")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, name")
      .eq("organization_id", ctx?.organizationId ?? ""),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        description='Current RepOneLive inventory tiers are pre-loaded below. Category-exclusive sponsors (e.g. "Official Physical Therapy Partner") are enforced at the database level per event.'
      />

      <Card>
        <CardContent>
          <form action={createSponsor} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="sponsor-name">Business name</Label>
              <Input id="sponsor-name" name="business_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sponsor-tier">Tier</Label>
              <Select name="tier" defaultValue="logo_sponsor">
                <SelectTrigger id="sponsor-tier" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sponsor-event">Event</Label>
              <Select name="event_id" defaultValue={NONE}>
                <SelectTrigger id="sponsor-event" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All events</SelectItem>
                  {(events ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sponsor-category">Category</Label>
              <Input id="sponsor-category" name="category" placeholder="Physical Therapy" />
            </div>
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox id="sponsor-exclusive" name="category_exclusive" />
              <Label htmlFor="sponsor-exclusive">Category exclusive</Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sponsor-website">Website</Label>
              <Input id="sponsor-website" name="website" />
            </div>
            <Button type="submit" className="w-fit sm:col-span-3">
              Add sponsor
            </Button>
          </form>
        </CardContent>
      </Card>

      {sponsors?.length === 0 ? (
        <EmptyState
          icon={BadgeDollarSign}
          title="No sponsors yet"
          description="Add your first sponsor with the form above."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(sponsors ?? []).map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.business_name}
                  {s.category_exclusive ? (
                    <Badge variant="outline" className="uppercase text-brand-text">
                      Exclusive · {s.category}
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {TIER_LABELS[s.tier as SponsorTier]}
                </p>
              </div>
              <ActionSwitch
                checked={s.active}
                action={toggleSponsorActive.bind(null, s.id)}
                label={`${s.business_name} active`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

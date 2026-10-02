import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ImageOff } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { bootstrapOrganization } from "@/lib/actions/org";
import { createEvent, uploadEventCoverPhoto, removeEventCoverPhoto } from "@/lib/actions/events";
import { DeleteEventButton } from "@/app/(app)/admin/DeleteEventButton";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export const metadata: Metadata = { title: "Events" };

function formatDateRange(startsOn: string | null, endsOn: string | null) {
  if (!startsOn) return "Date TBD";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (!endsOn || endsOn === startsOn) return fmt(startsOn);
  return `${fmt(startsOn)} — ${fmt(endsOn)}`;
}

export default async function AdminHomePage() {
  const ctx = await getSessionContext();

  if (!ctx?.organizationId) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <PageHeader
          title="Set up your organization"
          description="This is a one-time step for a brand new RepOne Platform account."
        />
        <form action={bootstrapOrganization} className="flex flex-col gap-3">
          <div className="grid gap-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              name="name"
              required
              placeholder="e.g. RepOneLive"
              className="text-base"
            />
          </div>
          <Button type="submit" size="lg" className="w-fit">
            Create organization
          </Button>
        </form>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: events }, { data: circuits }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, status, starts_on, ends_on, circuit_id, cover_image_url")
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("circuits")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .order("name"),
  ]);

  const circuitById = new Map((circuits ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Every competition your organization runs. Open one to set up divisions, heats, staff and payments."
      />

      <Card>
        <CardContent>
          <form action={createEvent} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event name</Label>
              <Input
                id="event-name"
                name="name"
                required
                placeholder="Aprieta Entry Level"
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-starts">Starts</Label>
              <Input id="event-starts" name="starts_on" type="date" className="text-base" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-ends">Ends</Label>
              <Input id="event-ends" name="ends_on" type="date" className="text-base" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-circuit">Single event or circuit?</Label>
              <Select name="circuit_choice" defaultValue={NONE}>
                <SelectTrigger id="event-circuit" className="min-w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Single event (standalone)</SelectItem>
                  <SelectItem value="new">Start a new circuit…</SelectItem>
                  {(circuits ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Add to circuit: {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-new-circuit">New circuit name</Label>
              <Input
                id="event-new-circuit"
                name="new_circuit_name"
                placeholder="Only for a new circuit"
                className="text-base"
              />
            </div>
            <Button type="submit">New event</Button>
          </form>
        </CardContent>
      </Card>

      {events?.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create your first event with the form above."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(events ?? []).map((e) => (
            <Card key={e.id} className="gap-0 overflow-hidden py-0 hover:ring-primary/60">
              <Link
                href={`/admin/events/${e.id}`}
                className="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                <div className="relative aspect-video w-full bg-muted">
                  {e.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                    <img
                      src={e.cover_image_url}
                      alt={e.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImageOff aria-hidden className="size-6" />
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        No cover photo
                      </span>
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute left-2 top-2 uppercase">
                    {e.status}
                  </Badge>
                  {e.circuit_id && circuitById.has(e.circuit_id) && (
                    <Badge className="absolute right-2 top-2 uppercase">
                      {circuitById.get(e.circuit_id)}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatDateRange(e.starts_on, e.ends_on)}
                  </p>
                  <p className="mt-0.5 text-lg font-bold">{e.name}</p>
                </div>
              </Link>

              <div className="flex items-start justify-between gap-2 border-t border-border px-4 py-2.5">
                <details className="text-sm">
                  <summary className="cursor-pointer py-1.5 font-semibold text-brand-text">
                    {e.cover_image_url ? "Change photo" : "Upload photo"}
                  </summary>
                  <form
                    action={uploadEventCoverPhoto.bind(null, e.id)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <Input
                      type="file"
                      name="cover_photo"
                      accept="image/*"
                      required
                      aria-label={`Cover photo for ${e.name}`}
                      className="max-w-[200px] text-base"
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                  {e.cover_image_url && (
                    <div className="mt-2">
                      <ConfirmAction
                        trigger="Remove photo"
                        title={`Remove the cover photo from ${e.name}?`}
                        description="The event card and event page go back to having no cover photo. You can upload a new one any time."
                        confirmLabel="Remove photo"
                        onConfirm={removeEventCoverPhoto.bind(null, e.id)}
                      />
                    </div>
                  )}
                </details>
                <DeleteEventButton eventId={e.id} eventName={e.name} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Running a season across multiple events?{" "}
        <Link href="/admin/circuits" className="text-brand-text hover:underline">
          Manage circuits and cross-event standings
        </Link>
      </p>
    </div>
  );
}

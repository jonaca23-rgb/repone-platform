import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { createDivision, deleteDivision } from "@/lib/actions/divisions";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Divisions · ${event.name}` : "Divisions" };
}

export default async function DivisionsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: divisions }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Divisions"
        description="The competitive categories athletes and teams register into."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Divisions" })} />}
      />

      <form action={createDivision.bind(null, eventId)} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="division-name">Division name</Label>
          <Input id="division-name" name="name" required placeholder="Intermediate Female" />
        </div>
        <Button type="submit">Add division</Button>
      </form>

      {divisions?.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No divisions yet"
          description="Add the first division with the form above."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(divisions ?? []).map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="font-semibold">{d.name}</span>
              <ConfirmAction
                trigger="Remove"
                title={`Remove ${d.name}?`}
                description="The division is deleted with its registrations, heats and results. This cannot be undone."
                confirmLabel="Remove division"
                onConfirm={deleteDivision.bind(null, eventId, d.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

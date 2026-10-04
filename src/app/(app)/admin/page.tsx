import type { Metadata } from "next";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { EventStatus } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { BootstrapOrgForm } from "./BootstrapOrgForm";
import { type EventRow, EventsTable } from "./EventsTable";

export const metadata: Metadata = { title: "Events" };

export default async function AdminHomePage() {
  const ctx = await getSessionContext();

  if (!ctx?.organizationId) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <PageHeader
          title="Set up your organization"
          description="This is a one-time step for a brand new RepOne Platform account."
        />
        <BootstrapOrgForm />
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

  const rows: EventRow[] = (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status as EventStatus,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
    circuitId: e.circuit_id,
    circuitName: e.circuit_id ? (circuitById.get(e.circuit_id) ?? null) : null,
    coverUrl: e.cover_image_url,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Every competition your organization runs. Open one to set up divisions, heats, staff and payments."
      />
      <EventsTable rows={rows} circuits={circuits ?? []} />
      <p className="text-sm text-muted-foreground">
        Running a season across multiple events?{" "}
        <Link href="/admin/circuits" className="text-brand-text hover:underline">
          Manage circuits and cross-event standings
        </Link>
      </p>
    </div>
  );
}

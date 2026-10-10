import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { pickTab } from "@/lib/tabs";
import { LinkTabs } from "@/components/app/LinkTabs";
import { PageHeader } from "@/components/app/PageHeader";
import { type PackageRow, PackagesTable } from "./PackagesTable";
import { type SponsorRow, SponsorsTable } from "./SponsorsTable";

export const metadata: Metadata = { title: "Sponsors" };

const TABS = [
  { value: "sponsors", label: "Sponsors" },
  { value: "packages", label: "Packages" },
] as const;

type Props = { searchParams: Promise<{ tab?: string }> };

/**
 * The organization's sponsors and the packages they can buy. Which sponsors
 * are at an event, and on which package, is set on the event's Sponsors page.
 */
export default async function SponsorsPage({ searchParams }: Props) {
  const tab = pickTab(TABS, (await searchParams).tab);
  const ctx = await getSessionContext();
  const orgId = ctx?.organizationId ?? "";
  const supabase = await createClient();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsors"
        description="Sponsors are added once and buy a package at each event."
      />
      <LinkTabs tabs={TABS} current={tab} label="Sponsor sections">
        {tab === "sponsors" ? (
          <SponsorsTable rows={await sponsorRows(supabase, orgId)} />
        ) : (
          <PackagesTable rows={await packageRows(supabase, orgId)} />
        )}
      </LinkTabs>
    </div>
  );
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function sponsorRows(supabase: Db, orgId: string): Promise<SponsorRow[]> {
  const { data, error } = await supabase
    .from("sponsors")
    .select(
      "id, business_name, category, website, notes, logo_url, active, sponsor_creatives(id, public_url, active, created_at)",
    )
    .eq("organization_id", orgId)
    .order("business_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    business_name: s.business_name,
    category: s.category,
    website: s.website,
    notes: s.notes,
    logo_url: s.logo_url,
    active: s.active,
    creatives: [...s.sponsor_creatives]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((c) => ({ id: c.id, url: c.public_url, active: c.active })),
  }));
}

async function packageRows(supabase: Db, orgId: string): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from("sponsor_packages")
    .select(
      "id, name, display_enabled, display_duration_seconds, display_weight, sort_order, active",
    )
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

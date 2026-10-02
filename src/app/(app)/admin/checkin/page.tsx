import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Check-In" };

// Search-and-jump picker in front of /admin/checkin/[athleteId] — a
// volunteer without a QR code to scan (lost wristband, phone camera acting
// up) can find the athlete by name or box instead.
export default async function CheckInPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const ctx = await getSessionContext();
  const supabase = await createClient();

  let athletesQuery = supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, photo_url")
    .eq("organization_id", ctx?.organizationId ?? "")
    .order("last_name")
    .limit(50);

  if (query) {
    athletesQuery = athletesQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,affiliate.ilike.%${query}%`,
    );
  }

  const { data: athletes } = await athletesQuery;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Check-In"
        description="Scan an athlete's QR code from their profile, or find them here by name or box to see their payment status at the registration desk."
      />

      <form className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="checkin-q">Search by name or box</Label>
          <Input
            id="checkin-q"
            name="q"
            defaultValue={query}
            placeholder="e.g. Rivera or CrossFit San Juan"
          />
        </div>
        <Button type="submit" size="touch">
          <Search aria-hidden />
          Search
        </Button>
      </form>

      {athletes?.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query ? `No athletes match "${query}"` : "No athletes yet"}
          description={query ? "Try part of a name or the box name." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(athletes ?? []).map((a) => (
            <Link
              key={a.id}
              href={`/admin/checkin/${a.id}`}
              className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/60"
            >
              {a.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
                <img
                  src={a.photo_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-border object-cover object-top"
                />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-full border border-border bg-muted" />
              )}
              <span>
                <span className="font-semibold">
                  {a.first_name} {a.last_name}
                </span>
                {a.affiliate ? (
                  <span className="ml-2 text-sm text-muted-foreground">{a.affiliate}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

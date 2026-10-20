import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getEventSponsors } from "@/lib/db/sponsors";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { producerEventTitle } from "../producerEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Sponsors") };
}

// Read-only list of this event's sponsors and what each bought. A producer
// triggers sponsor graphics from the Production tab; sponsors and their
// packages are managed by the org's admins (/admin/events/[id]/sponsors).
export default async function ProducerEventSponsorsPage({ params }: Props) {
  const { eventId } = await params;
  const rows = await getEventSponsors(eventId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Sponsors" />
      <p className="text-sm text-muted-foreground">
        To trigger a sponsor graphic on the broadcast, use the graphic controls on the{" "}
        <Link
          href={`/producer/events/${eventId}/production`}
          className="rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Production
        </Link>{" "}
        tab.
      </p>
      {rows.length > 0 ? (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Package</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.sponsorshipId}>
                  <TableCell className="font-semibold whitespace-normal">
                    {s.businessName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.packageName}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="No active sponsors for this event" />
      )}
    </div>
  );
}

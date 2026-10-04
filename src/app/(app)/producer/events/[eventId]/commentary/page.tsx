import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MicOff } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { getDisplayNamesByUserId } from "@/lib/db/people";
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
import { Button } from "@/components/ui/button";
import { producerEventTitle } from "../producerEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await producerEventTitle((await params).eventId, "Commentary") };
}

// Read view of who's assigned to commentate this event — "View commentator
// dashboard" + visibility into commentator access per spec. Assigning/
// removing commentators stays admin-only (that event's Staff tab in
// /admin), per "Commentator access management for that event if admin
// allows it" — not exposed here yet.
//
// Name resolution goes through getDisplayNamesByUserId rather than a local
// profiles-only lookup: since the Staff page can invite an athlete account
// as a commentator (lib/auth/invite.ts), a profiles-only
// query here would show "Unnamed staff account" for any commentator who is
// actually an athlete.
export default async function ProducerEventCommentaryPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("event_commentator_assignments")
    .select("id, commentator_user_id, role_label")
    .eq("event_id", eventId)
    .eq("status", "active");

  const userIds = (assignments ?? []).map((a) => a.commentator_user_id);
  const nameById = await getDisplayNamesByUserId(userIds);

  const rows = assignments ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Commentary"
        actions={
          <Button asChild size="touch" className="gap-2">
            <Link href={`/commentator/events/${eventId}/dashboard`}>
              View commentator dashboard
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      {rows.length > 0 ? (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commentator</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold whitespace-normal">
                    {nameById.get(a.commentator_user_id) ?? "Unknown account"}
                  </TableCell>
                  <TableCell>
                    {a.role_label ? (
                      <Badge variant="outline" className="uppercase">
                        {a.role_label.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={MicOff}
          title="No commentators assigned to this event yet"
          description="An admin assigns commentators from the event's Staff tab."
        />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { addFloor } from "@/lib/actions/venues";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Venues · ${event.name}` : "Venues" };
}

export default async function VenuesPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: venues }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase
      .from("venues")
      .select("id, name, floors(id, name, sort_order)")
      .eq("event_id", eventId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Venues & floors"
        description="Every event gets a default venue and Floor A automatically. Add more floors here to run simultaneous competition floors or platforms."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Venues" })} />}
      />

      <div className="flex flex-col gap-6">
        {(venues ?? []).map((v) => (
          <Card key={v.id}>
            <CardHeader>
              <CardTitle>{v.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(v.floors ?? [])
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((f) => (
                    <Badge key={f.id} variant="secondary" className="h-7 px-3 text-sm">
                      {f.name}
                    </Badge>
                  ))}
              </div>
              <form
                action={addFloor.bind(null, eventId, v.id)}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="grid gap-2">
                  <Label htmlFor={`floor-${v.id}`}>New floor name</Label>
                  <Input id={`floor-${v.id}`} name="name" required placeholder="Floor B" />
                </div>
                <Button type="submit" variant="outline">
                  Add floor
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

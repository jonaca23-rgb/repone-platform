import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getAthletePrivateDetails } from "@/lib/db/athletePrivate";
import { createClient } from "@/lib/db/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  deleteAthleteBenchmark,
  removeAthletePhoto,
  saveAthleteLifts,
  updateAthleteProfile,
  uploadAthletePhoto,
  upsertAthleteBenchmark,
} from "@/lib/actions/athletes";
import { AGE_CATEGORY_LABELS, computeAgeCategory, type Gender } from "@/lib/scoring/ageCategory";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { formatClock } from "@/lib/timer/compute";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Props = { params: Promise<{ athleteId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { athleteId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("athletes")
    .select("first_name, last_name")
    .eq("id", athleteId)
    .eq("organization_id", ctx?.organizationId ?? "")
    .maybeSingle();
  return { title: data ? `${data.first_name} ${data.last_name}` : "Athlete" };
}

export default async function AthleteDetailPage({ params }: Props) {
  const { athleteId } = await params;
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: athleteRow } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate, gender, photo_url, auth_user_id")
    .eq("id", athleteId)
    .eq("organization_id", ctx?.organizationId ?? "")
    .maybeSingle();

  if (!athleteRow) notFound();
  const contact = (await getAthletePrivateDetails(supabase, [athleteId])).get(athleteId);
  const athlete = {
    ...athleteRow,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    date_of_birth: contact?.dateOfBirth ?? null,
  };

  const [{ data: lifts }, { data: benchmarks }, { data: standingsRows }] = await Promise.all([
    supabase
      .from("athlete_lifts")
      .select("lift, weight_lbs, time_seconds")
      .eq("athlete_id", athleteId),
    supabase
      .from("athlete_benchmarks")
      .select("id, name, result_display")
      .eq("athlete_id", athleteId)
      .order("name"),
    supabase
      .from("standings")
      .select("event_id, division_id, wod_id, placement, points")
      .eq("athlete_id", athleteId),
  ]);

  const liftByName = new Map(
    (lifts ?? []).map((l) => [
      l.lift as LiftName,
      { weight_lbs: l.weight_lbs as number | null, time_seconds: l.time_seconds as number | null },
    ]),
  );
  const category = computeAgeCategory(
    athlete.date_of_birth,
    athlete.gender as Gender | null,
    new Date(),
  );

  // Competition history: standings rows for this athlete, grouped by event.
  // standings.wod_id is null for the event/division "overall" row and set
  // for each individual WOD's placement (see 0008_circuits.sql / the scoring
  // engine) — standings.event_id lives directly on the row, so no join
  // through divisions is needed to know which event a row belongs to.
  const eventIds = [...new Set((standingsRows ?? []).map((r) => r.event_id))];
  const divisionIds = [...new Set((standingsRows ?? []).map((r) => r.division_id))];
  const wodIds = [...new Set((standingsRows ?? []).flatMap((r) => (r.wod_id ? [r.wod_id] : [])))];

  const [{ data: historyEvents }, { data: historyDivisions }, { data: historyWods }] =
    await Promise.all([
      eventIds.length
        ? supabase.from("events").select("id, name, starts_on").in("id", eventIds)
        : Promise.resolve({ data: [] as { id: string; name: string; starts_on: string | null }[] }),
      divisionIds.length
        ? supabase.from("divisions").select("id, name").in("id", divisionIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      wodIds.length
        ? supabase.from("wods").select("id, name, sort_order").in("id", wodIds)
        : Promise.resolve({ data: [] as { id: string; name: string; sort_order: number }[] }),
    ]);

  const eventById = new Map((historyEvents ?? []).map((e) => [e.id, e]));
  const divisionById = new Map((historyDivisions ?? []).map((d) => [d.id, d]));
  const wodById = new Map((historyWods ?? []).map((w) => [w.id, w]));

  type HistoryGroup = {
    eventId: string;
    eventName: string;
    startsOn: string | null;
    divisionName: string;
    overall: { placement: number | null; points: number | null } | null;
    wods: { wodId: string; name: string; sortOrder: number; placement: number | null }[];
  };
  const historyByEvent = new Map<string, HistoryGroup>();
  for (const row of standingsRows ?? []) {
    const event = eventById.get(row.event_id);
    if (!event) continue;
    const group: HistoryGroup = historyByEvent.get(row.event_id) ?? {
      eventId: row.event_id,
      eventName: event.name,
      startsOn: event.starts_on,
      divisionName: divisionById.get(row.division_id)?.name ?? "—",
      overall: null,
      wods: [],
    };
    if (row.wod_id === null) {
      group.overall = { placement: row.placement, points: row.points };
    } else {
      const wod = wodById.get(row.wod_id);
      group.wods.push({
        wodId: row.wod_id,
        name: wod?.name ?? "WOD",
        sortOrder: wod?.sort_order ?? 0,
        placement: row.placement,
      });
    }
    historyByEvent.set(row.event_id, group);
  }
  const history = [...historyByEvent.values()]
    .map((g) => ({ ...g, wods: g.wods.sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""));

  // Check-in QR code: an absolute URL to this athlete's Check-In screen
  // (green/red payment status), built from the request's own host header so
  // it works on localhost, a preview deploy, or production with no env var
  // to keep in sync. Rendered as an embedded data: URI PNG — generated with
  // a pure-JS library and no external QR-API network call — matching this
  // app's convention of avoiding runtime network dependencies.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const checkinUrl = `${protocol}://${host}/admin/checkin/${athleteId}`;
  const checkinQrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 220, margin: 1 });

  const name = `${athlete.first_name} ${athlete.last_name}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={name}
        breadcrumb={
          <AdminBreadcrumb
            items={[{ label: "Athletes", href: "/admin/athletes" }, { label: name }]}
          />
        }
      />
      <div className="flex items-center gap-4">
        {athlete.photo_url ? (
          <a
            href={athlete.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full-size photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset */}
            <img
              src={athlete.photo_url}
              alt={name}
              className="h-20 w-20 rounded-full border border-border object-cover object-top"
            />
          </a>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
            No photo
          </div>
        )}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-text">
            {category
              ? `${AGE_CATEGORY_LABELS[category]} (as of today)`
              : "No competitive age category (as of today)"}
          </p>
          {athlete.auth_user_id ? (
            <Link
              href={`/admin/messages/${athlete.auth_user_id}`}
              className="mt-2 inline-block text-sm font-semibold text-brand-text underline"
            >
              Message {athlete.first_name}
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Hasn&apos;t created a RepOne account yet, so can&apos;t be messaged.
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URI PNG, not a static/optimizable asset */}
          <img
            src={checkinQrDataUrl}
            alt="Check-in QR code"
            className="h-32 w-32 shrink-0 rounded-md border border-border"
          />
          <div>
            <h2 className="font-semibold">Check-In QR code</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Scan this at event-day registration to pull up {athlete.first_name}&apos;s payment
              status.
            </p>
            <Link
              href={`/admin/checkin/${athleteId}`}
              className="mt-2 inline-block text-sm font-semibold text-brand-text underline"
            >
              Open Check-In screen
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={uploadAthletePhoto.bind(null, athleteId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="athlete-photo">Upload a photo</Label>
              <Input
                id="athlete-photo"
                type="file"
                name="photo"
                accept="image/*"
                required
                className="text-base"
              />
            </div>
            <Button type="submit">Upload</Button>
          </form>
          {athlete.photo_url && (
            <div>
              <ConfirmAction
                trigger="Remove current photo"
                title={`Remove ${name}'s photo?`}
                description="Their profile goes back to having no photo. You can upload a new one any time."
                confirmLabel="Remove photo"
                onConfirm={removeAthletePhoto.bind(null, athleteId)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={updateAthleteProfile.bind(null, athleteId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="profile-first">First name</Label>
              <Input
                id="profile-first"
                name="first_name"
                required
                defaultValue={athlete.first_name}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-last">Last name</Label>
              <Input
                id="profile-last"
                name="last_name"
                required
                defaultValue={athlete.last_name}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-affiliate">Box / affiliate</Label>
              <Input
                id="profile-affiliate"
                name="affiliate"
                defaultValue={athlete.affiliate ?? ""}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                name="email"
                required
                defaultValue={athlete.email ?? ""}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                name="phone"
                defaultValue={athlete.phone ?? ""}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-dob">Date of birth</Label>
              <Input
                id="profile-dob"
                type="date"
                name="date_of_birth"
                defaultValue={athlete.date_of_birth ?? ""}
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-gender">Gender</Label>
              <Select name="gender" defaultValue={athlete.gender ?? NONE}>
                <SelectTrigger id="profile-gender" className="min-w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic lifts &amp; run times</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={saveAthleteLifts.bind(null, athleteId)}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {LIFT_NAMES.map((lift) => {
              const existing = liftByName.get(lift);
              const timeLift = isTimeLift(lift);
              const id = `lift-${lift}`;
              return (
                <div key={lift} className="grid gap-2">
                  <Label htmlFor={id}>
                    {LIFT_LABELS[lift]} {timeLift ? "(mm:ss)" : "(lbs)"}
                  </Label>
                  {timeLift ? (
                    <Input
                      id={id}
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                      placeholder="21:30"
                      name={lift}
                      defaultValue={
                        existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""
                      }
                      className="text-base"
                    />
                  ) : (
                    <Input
                      id={id}
                      type="number"
                      step="0.5"
                      min="0"
                      name={lift}
                      defaultValue={existing?.weight_lbs ?? ""}
                      className="text-base"
                    />
                  )}
                </div>
              );
            })}
            <Button type="submit" className="col-span-full mt-2 w-fit">
              Save lifts
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benchmark workouts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            action={upsertAthleteBenchmark.bind(null, athleteId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="benchmark-name">Benchmark</Label>
              <Input
                id="benchmark-name"
                name="name"
                required
                placeholder="Fran"
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="benchmark-result">Result</Label>
              <Input
                id="benchmark-result"
                name="result_display"
                required
                placeholder="3:45"
                className="text-base"
              />
            </div>
            <Button type="submit">Save</Button>
          </form>

          <div className="flex flex-col gap-2">
            {(benchmarks ?? []).map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
              >
                <span>
                  <span className="font-semibold">{b.name}</span>{" "}
                  <span className="text-muted-foreground">{b.result_display}</span>
                </span>
                <ConfirmAction
                  trigger="Remove"
                  title={`Remove ${b.name}?`}
                  description={`${name}'s ${b.name} time (${b.result_display}) is deleted from their benchmarks.`}
                  confirmLabel="Remove benchmark"
                  onConfirm={deleteAthleteBenchmark.bind(null, athleteId, b.id)}
                />
              </div>
            ))}
            {benchmarks?.length === 0 && (
              <p className="text-muted-foreground">No benchmark times logged yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competition history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground">No competition results recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((h) => (
                <div key={h.eventId} className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">{h.eventName}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {h.divisionName}
                      </p>
                    </div>
                    {h.overall && (
                      <p className="text-sm font-bold text-brand-text">
                        Overall: {h.overall.placement ? `#${h.overall.placement}` : "—"}
                        {h.overall.points !== null ? ` (${h.overall.points} pts)` : ""}
                      </p>
                    )}
                  </div>
                  {h.wods.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {h.wods.map((w) => (
                        <Badge key={w.wodId} variant="secondary">
                          {w.name}: {w.placement ? `#${w.placement}` : "—"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

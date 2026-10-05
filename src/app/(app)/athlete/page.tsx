import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/db/server";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteCurrentStanding, getRecentActivity } from "@/lib/db/social";
import { getAthleteCompetitionHistory } from "@/lib/db/messages";
import { deleteMyBenchmark } from "@/lib/actions/myLifts";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { formatClock } from "@/lib/timer/compute";
import type { PaymentStatus } from "@/lib/db/database.types";
import { Check, Clock, Heart, History, Mail, Medal, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/time";
import { LinkTabs } from "@/components/app/LinkTabs";
import { pickTab } from "@/lib/tabs";
import { BenchmarkForm } from "./BenchmarkForm";
import { LiftsForm } from "./LiftsForm";

export const metadata: Metadata = { title: "Athlete" };

// Same "good to go" rule as the staff check-in screen
// (/admin/checkin/[athleteId]) — paid or waived reads as good, anything
// else (including no payment row yet) reads as pending.
const GOOD_STATUSES = new Set<PaymentStatus>(["paid", "waived"]);

type MyRegistrationRow = {
  id: string;
  event_id: string;
  bib_number: string | null;
  events: { name: string; status: string } | null;
  divisions: { name: string } | null;
  payments: { status: PaymentStatus } | null;
};

/**
 * Athlete's personal dashboard — current leaderboard status, a combined
 * activity feed of likes/messages received, the lifts and run times they've
 * entered (editable right here — see 0022_athlete_self_lift_edit.sql), the
 * check-in QR code they'll use the day of the competition plus their own
 * paid/pending status per event (see 0023_athlete_read_own_registrations_
 * and_payments.sql), and their results from every past RepOne-managed
 * event, as Jonathan asked for. The directory + messaging feature this
 * builds on was added in 0016_messaging.sql; likes/lift visibility in
 * 0017_athlete_likes_and_roster_add.sql.
 */
const TABS = [
  { value: "checkin", label: "Check-in" },
  { value: "stats", label: "Stats" },
  { value: "history", label: "History" },
] as const;

export default async function AthleteDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const supabase = await createClient();
  const [
    standing,
    activity,
    history,
    { data: liftRows },
    { data: benchmarks },
    { data: registrations },
  ] = await Promise.all([
    getAthleteCurrentStanding(ctx.athleteId),
    getRecentActivity(ctx.athleteId, ctx.userId, ctx.organizationId ?? ""),
    getAthleteCompetitionHistory(ctx.athleteId),
    supabase
      .from("athlete_lifts")
      .select("lift, weight_lbs, time_seconds")
      .eq("athlete_id", ctx.athleteId),
    supabase
      .from("athlete_benchmarks")
      .select("id, name, result_display")
      .eq("athlete_id", ctx.athleteId)
      .order("name"),
    supabase
      .from("registrations")
      .select("id, event_id, bib_number, events(name, status), divisions(name), payments(status)")
      .eq("athlete_id", ctx.athleteId),
  ]);

  const liftByName = new Map(
    (liftRows ?? []).map((l) => [
      l.lift as LiftName,
      { weight_lbs: l.weight_lbs as number | null, time_seconds: l.time_seconds as number | null },
    ]),
  );

  // See lib/db/queries.ts header comment on this codebase's convention:
  // cast a many-to-one embed (one payment row per registration) back to a
  // single object instead of fighting the query builder's inferred array type.
  const myRegistrations = (registrations ?? []) as unknown as MyRegistrationRow[];

  // Same QR code the admin athlete detail page already generates — an
  // absolute URL to this athlete's staff Check-In screen (built from the
  // request's own host header so it works on localhost, a preview deploy,
  // or production with no env var to keep in sync), rendered as an
  // embedded data: URI PNG with no external QR-API network call. Showing it
  // here too means the athlete can pull it up on their own phone at the
  // registration desk instead of needing a staff member to look them up
  // first — a volunteer scans it (or types their name into the Check-In
  // picker if the phone camera is acting up) and gets the same green/red
  // paid/pending banner either way.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const tab = pickTab(TABS, (await searchParams).tab);
  const liftFields = LIFT_NAMES.map((lift) => {
    const existing = liftByName.get(lift);
    const timeLift = isTimeLift(lift);
    return {
      lift,
      label: LIFT_LABELS[lift],
      timeLift,
      defaultValue: timeLift
        ? existing?.time_seconds != null
          ? formatClock(existing.time_seconds)
          : ""
        : String(existing?.weight_lbs ?? ""),
    };
  });
  const checkinUrl = `${protocol}://${host}/admin/checkin/${ctx.athleteId}`;
  const checkinQrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 220, margin: 1 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome${ctx.firstName ? `, ${ctx.firstName}` : ""}`}
        description="Here's what's new."
      />

      <LinkTabs tabs={TABS} current={tab} label="Your dashboard">
        {tab === "checkin" ? (
          <div className="flex flex-col gap-6">
            {/* First on the page: this is what an athlete opens the app for at the desk. */}
            <Card>
              <CardHeader>
                <CardTitle>My Check-In Code</CardTitle>
                <CardDescription>
                  Show this at the registration desk the day of the competition — staff scan it to
                  check you in and see your payment status below.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not an optimizable asset */}
                <img
                  src={checkinQrDataUrl}
                  alt="Your check-in QR code"
                  width={176}
                  height={176}
                  // ui-guard-ignore: QR needs a white quiet zone
                  className="size-44 shrink-0 self-center rounded-lg bg-white p-2 sm:self-start"
                />
                <div className="min-w-0 flex-1">
                  {myRegistrations.length === 0 ? (
                    <p className="text-muted-foreground">
                      You&apos;re not registered for an upcoming event yet — this code will be ready
                      to use once you are.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {myRegistrations.map((r) => {
                        const status: PaymentStatus = r.payments?.status ?? "unpaid";
                        const goodToGo = GOOD_STATUSES.has(status);
                        return (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{r.events?.name ?? "Event"}</p>
                              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                {r.divisions?.name ?? "—"}
                                {r.bib_number ? ` · Bib #${r.bib_number}` : ""}
                              </p>
                            </div>
                            {goodToGo ? (
                              <Badge
                                variant="outline"
                                className="border-success/40 bg-success/10 text-success-text uppercase"
                              >
                                <Check aria-hidden />
                                Paid
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-warning/40 bg-warning/10 text-warning-text uppercase"
                              >
                                <Clock aria-hidden />
                                Pending
                              </Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Current Leaderboard Status</CardTitle>
              </CardHeader>
              <CardContent>
                {standing ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">{standing.eventName}</p>
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        {standing.divisionName}
                      </p>
                    </div>
                    <p className="font-display text-2xl font-bold text-brand-text">
                      {standing.placement ? `#${standing.placement}` : "Not yet scored"}
                      {standing.points !== null ? ` (${standing.points} pts)` : ""}
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    icon={Trophy}
                    title="No standing yet"
                    description="You're not registered for an event yet, or no results have been posted."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : tab === "stats" ? (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>My Lifts &amp; Run Times</CardTitle>
                <CardDescription>
                  Enter or update your own PRs and times — no need to wait on staff. Blank fields
                  are left as-is.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LiftsForm lifts={liftFields} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>My Benchmark Workouts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <BenchmarkForm />
                {(benchmarks ?? []).length === 0 ? (
                  <EmptyState icon={Medal} title="No benchmark times logged yet" />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(benchmarks ?? []).map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border py-1 pr-1 pl-4"
                      >
                        <span className="min-w-0 text-sm">
                          <span className="font-semibold">{b.name}</span>{" "}
                          <span className="text-muted-foreground">{b.result_display}</span>
                        </span>
                        <ConfirmAction
                          trigger="Remove"
                          triggerClassName="min-h-11 text-muted-foreground hover:text-destructive"
                          title={`Remove ${b.name}?`}
                          description={`Your ${b.name} time (${b.result_display}) comes off your profile. You can log it again later.`}
                          confirmLabel="Remove benchmark"
                          onConfirm={deleteMyBenchmark.bind(null, b.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <EmptyState icon={Heart} title="No likes or messages yet" />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {activity.map((item) => {
                      const Icon = item.type === "like" ? Heart : Mail;
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-lg border border-border px-4 py-3"
                        >
                          <Icon className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-sm break-words">
                              <span className="font-semibold">{item.actorName}</span>{" "}
                              {item.type === "like"
                                ? item.description
                                : `sent you a message: "${item.description}"`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>My Competition History</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <EmptyState icon={History} title="No results from a RepOne-managed event yet" />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {history.map((h) => (
                      <li key={h.eventId} className="rounded-lg border border-border p-4">
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <p className="font-semibold">{h.eventName}</p>
                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
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
                              <Badge key={w.wodId} variant="secondary" className="h-6 px-3">
                                {w.name}: {w.placement ? `#${w.placement}` : "—"}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </LinkTabs>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/db/server";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteCurrentStanding, getRecentActivity } from "@/lib/db/social";
import { getAthleteCompetitionHistory } from "@/lib/db/messages";
import { deleteMyBenchmark, saveMyLifts, upsertMyBenchmark } from "@/lib/actions/myLifts";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { formatClock } from "@/lib/timer/compute";
import type { PaymentStatus } from "@/lib/db/database.types";

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
export default async function AthleteDashboardPage() {
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/athlete/login");
  if (!ctx.athleteId) redirect("/athlete/onboarding");

  const supabase = await createClient();
  const [standing, activity, history, { data: liftRows }, { data: benchmarks }, { data: registrations }] = await Promise.all([
    getAthleteCurrentStanding(ctx.athleteId),
    getRecentActivity(ctx.athleteId, ctx.userId, ctx.organizationId ?? ""),
    getAthleteCompetitionHistory(ctx.athleteId),
    supabase.from("athlete_lifts").select("lift, weight_lbs, time_seconds").eq("athlete_id", ctx.athleteId),
    supabase.from("athlete_benchmarks").select("id, name, result_display").eq("athlete_id", ctx.athleteId).order("name"),
    supabase
      .from("registrations")
      .select("id, event_id, bib_number, events(name, status), divisions(name), payments(status)")
      .eq("athlete_id", ctx.athleteId),
  ]);

  const liftByName = new Map(
    (liftRows ?? []).map((l) => [l.lift as LiftName, { weight_lbs: l.weight_lbs as number | null, time_seconds: l.time_seconds as number | null }])
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
  const protocol = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const checkinUrl = `${protocol}://${host}/admin/checkin/${ctx.athleteId}`;
  const checkinQrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 220, margin: 1 });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">
        Welcome{ctx.firstName ? `, ${ctx.firstName}` : ""}
      </h1>
      <p className="mb-6 max-w-xl text-sm text-white/60">Here&apos;s what&apos;s new.</p>

      <div className="mb-8 flex flex-wrap gap-4">
        <Link href="/athlete/directory" className="control-btn control-btn-red px-6 py-3 text-sm">
          Browse Athletes
        </Link>
        <Link
          href="/athlete/messages"
          className="control-btn control-btn-outline border-white/30 !bg-transparent !text-white px-6 py-3 text-sm"
        >
          Messages
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-1 font-semibold text-white">My Check-In Code</h2>
        <p className="mb-4 text-xs text-white/50">
          Show this at the registration desk the day of the competition — staff scan it to check you in and see
          your payment status below.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not an optimizable asset */}
          <img
            src={checkinQrDataUrl}
            alt="Your check-in QR code"
            className="h-[140px] w-[140px] rounded-lg bg-white p-2"
          />
          <div className="flex-1">
            {myRegistrations.length === 0 ? (
              <p className="text-white/50">
                You&apos;re not registered for an upcoming event yet — this code will be ready to use once you are.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {myRegistrations.map((r) => {
                  const status: PaymentStatus = r.payments?.status ?? "unpaid";
                  const goodToGo = GOOD_STATUSES.has(status);
                  return (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-white">{r.events?.name ?? "Event"}</p>
                        <p className="text-xs uppercase tracking-wide text-white/50">
                          {r.divisions?.name ?? "—"}
                          {r.bib_number ? ` · Bib #${r.bib_number}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          goodToGo ? "bg-green-600/20 text-green-400" : "bg-repone-red/20 text-repone-red"
                        }`}
                      >
                        {goodToGo ? "✓ Paid" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">Current Leaderboard Status</h2>
        {standing ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{standing.eventName}</p>
              <p className="text-xs uppercase tracking-wide text-white/50">{standing.divisionName}</p>
            </div>
            <p className="text-lg font-bold text-repone-red">
              {standing.placement ? `#${standing.placement}` : "Not yet scored"}
              {standing.points !== null ? ` (${standing.points} pts)` : ""}
            </p>
          </div>
        ) : (
          <p className="text-white/50">You&apos;re not registered for an event yet, or no results have been posted.</p>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-white/50">No likes or messages yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border border-white/10 px-4 py-3">
                <span aria-hidden className="mt-0.5 text-lg">
                  {item.type === "like" ? "♥" : "✉"}
                </span>
                <div>
                  <p className="text-sm text-white">
                    <span className="font-semibold">{item.actorName}</span>{" "}
                    {item.type === "like" ? item.description : `sent you a message: "${item.description}"`}
                  </p>
                  <p className="text-xs text-white/40">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-1 font-semibold text-white">My Lifts &amp; Run Times</h2>
        <p className="mb-3 text-xs text-white/50">
          Enter or update your own PRs and times — no need to wait on staff. Blank fields are left as-is.
        </p>
        <form action={saveMyLifts} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LIFT_NAMES.map((lift) => {
            const existing = liftByName.get(lift);
            const timeLift = isTimeLift(lift);
            return (
              <label key={lift} className="flex flex-col gap-1 text-sm text-white/80">
                {LIFT_LABELS[lift]} {timeLift ? "(mm:ss)" : "(lbs)"}
                {timeLift ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                    placeholder="21:30"
                    name={lift}
                    defaultValue={existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""}
                    className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
                  />
                ) : (
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    name={lift}
                    defaultValue={existing?.weight_lbs ?? ""}
                    className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
                  />
                )}
              </label>
            );
          })}
          <button className="control-btn control-btn-red col-span-full mt-2 w-fit px-6 py-3 text-sm">
            Save Lifts
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">My Benchmark Workouts</h2>
        <form action={upsertMyBenchmark} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-white/80">
            Benchmark
            <input
              name="name"
              required
              placeholder="Fran"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-white/80">
            Result
            <input
              name="result_display"
              required
              placeholder="3:45"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
            />
          </label>
          <button className="control-btn control-btn-red px-6 py-3 text-sm">Save</button>
        </form>
        <div className="flex flex-col gap-2">
          {(benchmarks ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2.5">
              <span className="text-sm text-white">
                <span className="font-semibold">{b.name}</span> <span className="text-white/50">{b.result_display}</span>
              </span>
              <form action={deleteMyBenchmark.bind(null, b.id)}>
                <button className="text-sm text-white/40 hover:text-repone-red">Remove</button>
              </form>
            </div>
          ))}
          {(benchmarks ?? []).length === 0 && <p className="text-white/50">No benchmark times logged yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">My Competition History</h2>
        {history.length === 0 ? (
          <p className="text-white/50">No results from a RepOne-managed event yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((h) => (
              <div key={h.eventId} className="rounded-lg border border-white/10 p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{h.eventName}</p>
                    <p className="text-xs uppercase tracking-wide text-white/50">{h.divisionName}</p>
                  </div>
                  {h.overall && (
                    <p className="text-sm font-bold text-repone-red">
                      Overall: {h.overall.placement ? `#${h.overall.placement}` : "—"}
                      {h.overall.points !== null ? ` (${h.overall.points} pts)` : ""}
                    </p>
                  )}
                </div>
                {h.wods.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {h.wods.map((w) => (
                      <span key={w.wodId} className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/70">
                        {w.name}: {w.placement ? `#${w.placement}` : "—"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

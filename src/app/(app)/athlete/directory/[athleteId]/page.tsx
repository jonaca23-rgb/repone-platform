import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteCompetitionHistory, getAthleteProfile } from "@/lib/db/messages";
import { getAthleteLiftsAndBenchmarks, getStandingLikes } from "@/lib/db/social";
import { AGE_CATEGORY_LABELS } from "@/lib/scoring/ageCategory";
import { LikeButton } from "@/components/LikeButton";

export default async function AthleteDirectoryProfilePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const athlete = await getAthleteProfile(athleteId, ctx.organizationId ?? "");
  if (!athlete) notFound();

  const isSelf = athlete.id === ctx.athleteId;
  const viewerUserId = isSelf ? null : ctx.userId; // never render like buttons as "liking yourself"

  const [history, { lifts, benchmarks }] = await Promise.all([
    getAthleteCompetitionHistory(athleteId),
    getAthleteLiftsAndBenchmarks(athleteId, viewerUserId),
  ]);

  const standingIds = history.flatMap((h) => [
    ...(h.overall ? [h.overall.standingId] : []),
    ...h.wods.map((w) => w.standingId),
  ]);
  const standingLikes = await getStandingLikes(standingIds, viewerUserId);

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href="/athlete/directory" className="text-repone-red underline">
          ← Athletes
        </Link>
      </p>

      <div className="mb-6 flex items-center gap-4">
        {athlete.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
          <img
            src={athlete.photoUrl}
            alt=""
            className="h-20 w-20 rounded-full object-cover object-top"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/40 text-xs text-white/40">
            No photo
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {athlete.firstName} {athlete.lastName}
          </h1>
          {athlete.affiliate ? <p className="text-sm text-white/60">{athlete.affiliate}</p> : null}
          {athlete.ageCategory ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-repone-red">
              {AGE_CATEGORY_LABELS[athlete.ageCategory]}
            </p>
          ) : null}
        </div>
      </div>

      {!isSelf &&
        (athlete.authUserId ? (
          <Link
            href={`/athlete/messages/${athlete.authUserId}`}
            className="control-btn control-btn-red mb-8 inline-block px-6 py-3 text-sm"
          >
            Message {athlete.firstName}
          </Link>
        ) : (
          <p className="mb-8 text-sm text-white/40">
            {athlete.firstName} hasn&apos;t created a RepOne account yet — no way to message them.
          </p>
        ))}

      <section className="mb-6 rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">Lifts &amp; Benchmarks</h2>
        {lifts.length === 0 && benchmarks.length === 0 ? (
          <p className="text-white/50">No lifts or benchmarks recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lifts.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{l.label}</p>
                  <p className="text-xs text-white/50">{l.valueDisplay}</p>
                </div>
                {!isSelf && (
                  <LikeButton
                    athleteId={athlete.id}
                    targetType="lift"
                    targetId={l.id}
                    count={l.like.count}
                    likedByMe={l.like.likedByMe}
                  />
                )}
              </div>
            ))}
            {benchmarks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{b.name}</p>
                  <p className="text-xs text-white/50">{b.resultDisplay}</p>
                </div>
                {!isSelf && (
                  <LikeButton
                    athleteId={athlete.id}
                    targetType="benchmark"
                    targetId={b.id}
                    count={b.like.count}
                    likedByMe={b.like.likedByMe}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-repone-gray p-4">
        <h2 className="mb-3 font-semibold text-white">Competition History</h2>
        {history.length === 0 ? (
          <p className="text-white/50">No competition results recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((h) => (
              <div key={h.eventId} className="rounded-lg border border-white/10 p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{h.eventName}</p>
                    <p className="text-xs uppercase tracking-wide text-white/50">
                      {h.divisionName}
                    </p>
                  </div>
                  {h.overall && (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-repone-red">
                        Overall: {h.overall.placement ? `#${h.overall.placement}` : "—"}
                        {h.overall.points !== null ? ` (${h.overall.points} pts)` : ""}
                      </p>
                      {!isSelf && (
                        <LikeButton
                          athleteId={athlete.id}
                          targetType="standing"
                          targetId={h.overall.standingId}
                          count={standingLikes.get(h.overall.standingId)?.count ?? 0}
                          likedByMe={standingLikes.get(h.overall.standingId)?.likedByMe ?? false}
                        />
                      )}
                    </div>
                  )}
                </div>
                {h.wods.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {h.wods.map((w) => (
                      <span
                        key={w.wodId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/70"
                      >
                        {w.name}: {w.placement ? `#${w.placement}` : "—"}
                        {!isSelf && (
                          <LikeButton
                            athleteId={athlete.id}
                            targetType="standing"
                            targetId={w.standingId}
                            count={standingLikes.get(w.standingId)?.count ?? 0}
                            likedByMe={standingLikes.get(w.standingId)?.likedByMe ?? false}
                          />
                        )}
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

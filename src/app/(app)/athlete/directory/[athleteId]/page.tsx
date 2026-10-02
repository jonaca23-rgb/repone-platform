import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { ChevronLeft, Dumbbell, History, MessageSquare } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getAthleteCompetitionHistory, getAthleteProfile } from "@/lib/db/messages";
import { getAthleteLiftsAndBenchmarks, getStandingLikes } from "@/lib/db/social";
import { AGE_CATEGORY_LABELS } from "@/lib/scoring/ageCategory";
import { LikeButton } from "@/components/LikeButton";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Read once per request: the page and its title share them.
const sessionContext = cache(getAthleteSessionContext);
const athleteProfile = cache(getAthleteProfile);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}): Promise<Metadata> {
  const { athleteId } = await params;
  const ctx = await sessionContext();
  if (!ctx?.athleteId) return { title: "Athletes" };
  const athlete = await athleteProfile(athleteId, ctx.organizationId ?? "");
  return { title: athlete ? `${athlete.firstName} ${athlete.lastName}` : "Athletes" };
}

export default async function AthleteDirectoryProfilePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const ctx = await sessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const athlete = await athleteProfile(athleteId, ctx.organizationId ?? "");
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          className="-ml-3 min-h-11 gap-2 self-start text-muted-foreground"
        >
          <Link href="/athlete/directory">
            <ChevronLeft aria-hidden />
            Athletes
          </Link>
        </Button>

        <div className="flex items-center gap-4">
          {athlete.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset
            <img
              src={athlete.photoUrl}
              alt=""
              className="size-20 shrink-0 rounded-full object-cover object-top"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted font-display text-2xl font-bold text-muted-foreground"
            >
              {athlete.firstName.charAt(0)}
              {athlete.lastName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-wide text-balance uppercase">
              {athlete.firstName} {athlete.lastName}
            </h1>
            {athlete.affiliate ? (
              <p className="text-sm text-muted-foreground">{athlete.affiliate}</p>
            ) : null}
            {athlete.ageCategory ? (
              <p className="text-xs font-semibold tracking-wide text-brand-text uppercase">
                {AGE_CATEGORY_LABELS[athlete.ageCategory]}
              </p>
            ) : null}
          </div>
        </div>

        {!isSelf &&
          (athlete.authUserId ? (
            <Button asChild size="touch" className="gap-2 sm:self-start">
              <Link href={`/athlete/messages/${athlete.authUserId}`}>
                <MessageSquare aria-hidden />
                Message {athlete.firstName}
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {athlete.firstName} hasn&apos;t created a RepOne account yet — no way to message them.
            </p>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifts &amp; Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          {lifts.length === 0 && benchmarks.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No lifts or benchmarks recorded yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {lifts.map((l) => (
                <li
                  key={l.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border py-1.5 pr-1.5 pl-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{l.label}</p>
                    <p className="text-xs text-muted-foreground">{l.valueDisplay}</p>
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
                </li>
              ))}
              {benchmarks.map((b) => (
                <li
                  key={b.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border py-1.5 pr-1.5 pl-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.resultDisplay}</p>
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competition History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={History} title="No competition results recorded yet" />
          ) : (
            <ul className="flex flex-col gap-3">
              {history.map((h) => (
                <li key={h.eventId} className="rounded-lg border border-border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{h.eventName}</p>
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        {h.divisionName}
                      </p>
                    </div>
                    {h.overall && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-text">
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
                    <ul className="flex flex-wrap gap-2">
                      {h.wods.map((w) => (
                        <li key={w.wodId} className="flex items-center gap-1">
                          <Badge variant="secondary" className="h-6 px-3">
                            {w.name}: {w.placement ? `#${w.placement}` : "—"}
                          </Badge>
                          {!isSelf && (
                            <LikeButton
                              athleteId={athlete.id}
                              targetType="standing"
                              targetId={w.standingId}
                              count={standingLikes.get(w.standingId)?.count ?? 0}
                              likedByMe={standingLikes.get(w.standingId)?.likedByMe ?? false}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

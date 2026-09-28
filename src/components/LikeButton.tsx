import { toggleLike } from "@/lib/actions/social";
import type { LikeTargetType } from "@/lib/db/database.types";

/**
 * A like toggle on another athlete's lift, benchmark, or standing. Plain
 * server-action form (no client JS needed) — same progressive-enhancement
 * pattern as the message-send form. Self-likes are allowed by RLS (org
 * membership is the only gate) but the directory profile never renders this
 * on the viewer's own page, so in practice this only ever likes someone
 * else's result.
 */
export function LikeButton({
  athleteId,
  targetType,
  targetId,
  count,
  likedByMe,
}: {
  athleteId: string;
  targetType: LikeTargetType;
  targetId: string;
  count: number;
  likedByMe: boolean;
}) {
  return (
    <form action={toggleLike.bind(null, athleteId, targetType, targetId)} className="inline-block">
      <button
        type="submit"
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          likedByMe
            ? "border-repone-red/60 bg-repone-red/20 text-repone-red"
            : "border-white/15 bg-black/30 text-white/60 hover:border-white/30 hover:text-white"
        }`}
      >
        <span aria-hidden>{likedByMe ? "♥" : "♡"}</span>
        {count > 0 ? count : ""}
      </button>
    </form>
  );
}

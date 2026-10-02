import { Heart } from "lucide-react";
import { toggleLike } from "@/lib/actions/social";
import type { LikeTargetType } from "@/lib/db/database.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A like toggle on another athlete's lift, benchmark, or standing. Plain
 * server-action form (no client JS needed) — same progressive-enhancement
 * pattern as the message-send form. Self-likes are allowed by RLS (org
 * membership is the only gate) but the directory profile never renders this
 * on the viewer's own page, so in practice this only ever likes someone
 * else's result. Touch-sized (44px), since athletes use this on a phone.
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
    <form action={toggleLike.bind(null, athleteId, targetType, targetId)} className="inline-flex">
      <Button
        type="submit"
        variant="outline"
        aria-pressed={likedByMe}
        aria-label={`Like${count > 0 ? `, ${count} so far` : ""}`}
        className={cn(
          "min-h-11 min-w-11 gap-1 rounded-full px-3 text-xs font-semibold",
          likedByMe
            ? "border-brand-text/60 bg-primary/20 text-brand-text hover:bg-primary/30 hover:text-brand-text"
            : "border-border text-muted-foreground",
        )}
      >
        <Heart className={cn("size-4", likedByMe && "fill-current")} aria-hidden />
        {count > 0 ? <span aria-hidden>{count}</span> : null}
      </Button>
    </form>
  );
}

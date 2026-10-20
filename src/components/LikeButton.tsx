"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleLike } from "@/lib/actions/social";
import type { LikeTargetType } from "@/lib/db/database.types";
import { useServerAction } from "@/lib/use-server-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A like toggle on another athlete's lift, benchmark, or standing. Flips at
 * once and puts itself back if the server says no. Self-likes are allowed by
 * RLS (org membership is the only gate) but the directory profile never
 * renders this on the viewer's own page. Touch-sized (44px), since athletes
 * use this on a phone.
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
  // The optimistic value holds only while the server's props are the ones it
  // was taken from: once the refresh brings new props, they win, with no flash.
  const [optimistic, setOptimistic] = useState<{
    from: string;
    liked: boolean;
    count: number;
  } | null>(null);
  const propsKey = `${likedByMe}:${count}`;
  const current = optimistic?.from === propsKey ? optimistic : null;
  const liked = current?.liked ?? likedByMe;
  const shown = current?.count ?? count;
  const toggle = useServerAction(() => toggleLike(athleteId, targetType, targetId), {
    onError: () => setOptimistic(null),
  });

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={liked}
      aria-label={`Like${shown > 0 ? `, ${shown} so far` : ""}`}
      disabled={toggle.isPending}
      onClick={() => {
        setOptimistic({ from: propsKey, liked: !liked, count: shown + (liked ? -1 : 1) });
        toggle.mutate(undefined);
      }}
      className={cn(
        "min-h-11 min-w-11 gap-1 rounded-full px-3 text-xs font-semibold",
        liked
          ? "border-brand-text/60 bg-primary/20 text-brand-text hover:bg-primary/30 hover:text-brand-text"
          : "border-border text-muted-foreground",
      )}
    >
      <Heart className={cn("size-4", liked && "fill-current")} aria-hidden />
      {shown > 0 ? <span aria-hidden>{shown}</span> : null}
    </Button>
  );
}

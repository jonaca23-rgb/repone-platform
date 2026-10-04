"use client";

import { ListOrdered } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { COMPACT_QUERY } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LeaderboardRow {
  placement: number | null;
  points: number | null;
  name: string;
}

/** This heat's WOD/division standings, a tap away from the finish bar. */
export function LeaderboardSheet({ title, rows }: { title: string; rows: LeaderboardRow[] }) {
  const compact = useMediaQuery(COMPACT_QUERY);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="touch" className="gap-2 px-3 sm:px-4">
          <ListOrdered aria-hidden />
          {/* Icon-only on a phone, so Finish heat fits beside it. */}
          <span className="max-sm:sr-only">Leaderboard</span>
        </Button>
      </SheetTrigger>
      <SheetContent side={compact ? "bottom" : "right"} className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {rows.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">No scores yet.</p>
        ) : (
          <div className="px-4 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Place</TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.name}-${i}`}>
                    <TableCell className="font-bold text-brand-text tabular-nums">
                      {r.placement ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.points ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

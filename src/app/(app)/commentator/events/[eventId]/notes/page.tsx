import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { commentatorEventTitle } from "../commentatorEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Notes") };
}

// Placeholder — commentator_notes (interview prompts, storyline notes,
// sponsor talking points) is planned for a later phase per
// architecture/rbac-audit-and-plan.md ("Phase 3: commentator notes if
// appropriate"), not built yet. The route stays; its tab is left out of the
// event tabs until it is built.
export default function CommentatorEventNotesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Notes" />
      <EmptyState
        icon={NotebookPen}
        title="Commentator notes aren't built yet"
        description="Storylines, interview prompts and sponsor talking points are planned for a follow-up."
      />
    </div>
  );
}

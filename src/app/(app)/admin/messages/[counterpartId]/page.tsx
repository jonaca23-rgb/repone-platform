import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgManager } from "@/lib/auth/guards";
import { getThread, markThreadRead, resolveCounterparts } from "@/lib/db/messages";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { MessageThread } from "@/components/messages/MessageThread";
import { ThreadLiveRefresh } from "@/components/messages/ThreadLiveRefresh";

type Props = { params: Promise<{ counterpartId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { counterpartId } = await params;
  const { organizationId } = await requireOrgManager();
  const labels = await resolveCounterparts([counterpartId], organizationId);
  return { title: labels.get(counterpartId)?.name ?? "Messages" };
}

export default async function AdminThreadPage({ params }: Props) {
  const { counterpartId } = await params;
  const { ctx, organizationId } = await requireOrgManager();

  const labels = await resolveCounterparts([counterpartId], organizationId);
  const counterpart = labels.get(counterpartId);
  if (!counterpart) notFound();

  await markThreadRead(ctx.userId, counterpartId);
  const thread = await getThread(ctx.userId, counterpartId);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={counterpart.name}
        description={counterpart.sublabel ?? undefined}
        breadcrumb={
          <AdminBreadcrumb
            items={[{ label: "Messages", href: "/admin/messages" }, { label: counterpart.name }]}
          />
        }
      />

      <MessageThread messages={thread} counterpartName={counterpart.name} />

      <div className="sticky bottom-0 rounded-t-xl border border-b-0 border-border bg-background px-4 py-3">
        <MessageComposer recipientId={counterpartId} recipientName={counterpart.name} />
      </div>
      <ThreadLiveRefresh myUserId={ctx.userId} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { getThread, markThreadRead, resolveCounterparts } from "@/lib/db/messages";
import { sendMessage } from "@/lib/actions/messages";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { params: Promise<{ counterpartId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { counterpartId } = await params;
  const ctx = await getSessionContext();
  const labels = await resolveCounterparts([counterpartId], ctx?.organizationId ?? "");
  return { title: labels.get(counterpartId)?.name ?? "Messages" };
}

export default async function AdminThreadPage({ params }: Props) {
  const { counterpartId } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const labels = await resolveCounterparts([counterpartId], ctx.organizationId ?? "");
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

      <div className="flex flex-col gap-3">
        {thread.map((m) => (
          <div
            key={m.id}
            className={`max-w-md rounded-lg px-4 py-2 ${m.fromMe ? "ml-auto bg-primary text-primary-foreground" : "border border-border bg-card"}`}
          >
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            <p
              className={`mt-1 text-xs ${m.fromMe ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {new Date(m.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
        {thread.length === 0 && (
          <p className="text-muted-foreground">No messages yet. Say hello.</p>
        )}
      </div>

      <form action={sendMessage.bind(null, counterpartId)} className="flex items-end gap-3">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="message-body" className="sr-only">
            Message
          </Label>
          <Textarea
            id="message-body"
            name="body"
            required
            rows={2}
            placeholder="Write a message…"
          />
        </div>
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}

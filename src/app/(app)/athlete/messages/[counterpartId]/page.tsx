import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAthleteSessionContext } from "@/lib/auth/session";
import { getThread, markThreadRead, resolveCounterparts } from "@/lib/db/messages";
import { sendMessage } from "@/lib/actions/messages";

export default async function AthleteThreadPage({
  params,
}: {
  params: Promise<{ counterpartId: string }>;
}) {
  const { counterpartId } = await params;
  const ctx = await getAthleteSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.athleteId) redirect("/");

  const labels = await resolveCounterparts([counterpartId], ctx.organizationId ?? "");
  const counterpart = labels.get(counterpartId);
  if (!counterpart) notFound();

  // Viewing the thread is what marks it read — there's no separate "mark as
  // read" click in this UI.
  await markThreadRead(ctx.userId, counterpartId);
  const thread = await getThread(ctx.userId, counterpartId);

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href="/athlete/messages" className="text-repone-red underline">
          ← Messages
        </Link>
      </p>
      <h1 className="mb-1 text-xl font-bold text-white">{counterpart.name}</h1>
      {counterpart.sublabel ? (
        <p className="mb-6 text-sm text-white/50">{counterpart.sublabel}</p>
      ) : null}

      <div className="mb-6 flex flex-col gap-3">
        {thread.map((m) => (
          <div
            key={m.id}
            className={`max-w-md rounded-lg px-4 py-2 ${m.fromMe ? "ml-auto bg-repone-red text-white" : "bg-repone-gray text-white"}`}
          >
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            <p className="mt-1 text-xs opacity-60">{new Date(m.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {thread.length === 0 && <p className="text-white/50">No messages yet — say hello.</p>}
      </div>

      <form action={sendMessage.bind(null, counterpartId)} className="flex items-end gap-3">
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Write a message…"
          className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
        />
        <button className="control-btn control-btn-red px-6 py-3 text-sm">Send</button>
      </form>
    </div>
  );
}

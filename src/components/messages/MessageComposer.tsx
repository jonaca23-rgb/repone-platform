"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { sendMessage } from "@/lib/actions/messages";
import { useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Write and send a message. Enter sends, Shift+Enter adds a line; a failure keeps the text. */
export function MessageComposer({
  recipientId,
  recipientName,
}: {
  recipientId: string;
  recipientName: string;
}) {
  const [body, setBody] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const send = useServerAction((fd: FormData) => sendMessage(recipientId, fd), {
    toastErrors: false,
    // Clear only what was sent: anything typed while it was sending stays.
    onSuccess: (_data, fd) => {
      const sent = String(fd.get("body") ?? "");
      setBody((now) => (now.startsWith(sent) ? now.slice(sent.length).trimStart() : now));
    },
  });
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        send.mutate(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-2"
    >
      <FormAlert error={send.error} />
      <div className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1">
          <Label htmlFor="message-body" className="sr-only">
            Message to {recipientName}
          </Label>
          <Textarea
            id="message-body"
            name="body"
            required
            rows={2}
            maxLength={2000}
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            className="max-h-40 min-h-11"
          />
        </div>
        <Button type="submit" size="touch" className="gap-2 px-4" disabled={send.isPending}>
          <Send aria-hidden />
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

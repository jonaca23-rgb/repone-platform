"use client";

import { useEffect, useRef } from "react";
import { formatDateTime } from "@/lib/time";

export interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
}

/** A conversation, oldest first, opening at the newest message and following new ones. */
export function MessageThread({
  messages,
  counterpartName,
}: {
  messages: ThreadMessage[];
  counterpartName: string;
}) {
  const newest = messages.at(-1)?.id;
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (newest) endRef.current?.scrollIntoView({ block: "end" });
  }, [newest]);

  return (
    <ol className="flex flex-col gap-3" aria-label={`Conversation with ${counterpartName}`}>
      {messages.map((m) => (
        <li
          key={m.id}
          ref={m.id === newest ? endRef : undefined}
          className={`max-w-[85%] rounded-lg px-4 py-2 sm:max-w-md ${
            m.fromMe
              ? "ml-auto bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground"
          }`}
        >
          <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
          <p
            className={`mt-1 text-xs ${m.fromMe ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            <span className="sr-only">{m.fromMe ? "You, " : `${counterpartName}, `}</span>
            {formatDateTime(m.createdAt)}
          </p>
        </li>
      ))}
      {messages.length === 0 && (
        <li className="text-muted-foreground">No messages yet. Say hello.</li>
      )}
    </ol>
  );
}

# Athlete Portal and Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The athlete home gets Check-in, Stats and History tabs.
- Every portal and messaging action returns `ActionResult`, and its form shows errors inline.
- Athletes and staff share one thread and one composer. The thread scrolls to the newest message and refreshes when a reply arrives.

**Architecture:**
- **Actions.** Each action moves to `safeAction` in its own task, next to the client form that calls it: a server `<form action>` can't take a function that returns a result.
- **New client components:**
  - `LiftsForm` and `BenchmarkForm` (athlete home);
  - `NewAthleteForm` and `LikeButton` (directory);
  - `MessageThread`, `MessageComposer` and `ThreadLiveRefresh` (messages, in `src/components/messages/`).

**Tech Stack:** Next.js 16, React 19, TanStack Query (`useServerAction`), Supabase realtime (`useRefreshOnChanges`), shadcn and Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-athlete-messages-design.md`

## Global Constraints

**Branch and commits**
- Work on `feat/athlete-messages`. The PR targets `staging`.
- Commit with `pnpm check && git commit …` (never commit on a failed check).
- Stage files by name.
- Commit message: a title that is a plain sentence, then a body explaining why, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Actions**
- No action throws a literal message, and none calls `redirect()`.
- Guards and `parseForm` keep throwing; `safeAction` converts them.
- Database errors still `throw new Error(error.message)`.

**Interface**
- Every target is at least 44px.

**Copy (English, exact)**
- `Enter at least one lift or time to save.`
- `Lifts saved.`
- `Benchmark saved.`
- `You can't message this person.`
- `That item doesn't exist, or isn't this athlete's.`
- `No messages yet. Say hello.`
- `Sending…`

**Tests**
- jsdom tests start with `// @vitest-environment jsdom`.
- They mock `next/navigation` (`useRouter`) and `sonner` the way `FormDialog.test.tsx` does.

## Review Focus

1. **A failed form keeps what was typed.** In every converted form (lifts, benchmark, new athlete, onboarding, composer), the typed values stay after a failure. Pinned in Tasks 1, 2, 3 and 4.
2. **A double-tapped Send sends once.** `useServerAction` guards in-flight calls. Pinned in Task 4: the button is disabled while pending.
3. **A reply arriving while typing doesn't wipe the draft.** The page refresh re-renders the server parts; the composer is a client component with its own state, so the draft survives. Checked in the Task 5 browser run.
4. **The like toggle fails.** The optimistic state reverts. Pinned in Task 2.
5. **Lifts with every field blank.** The form shows the message instead of silently doing nothing. Pinned in Task 1.

---

### Task 1: Lifts and benchmarks on `ActionResult`, and the athlete home tabs

**Files:**
- Modify: `src/lib/actions/myLifts.ts`
- Create: `src/app/(app)/athlete/LiftsForm.tsx`
- Create: `src/app/(app)/athlete/BenchmarkForm.tsx`
- Modify: `src/app/(app)/athlete/page.tsx` (tabs; use the new forms)
- Modify: `src/lib/design/uiGuard.ts` (add `myLifts.ts`)
- Test: `src/lib/actions/myLifts.test.ts`
- Test: `src/app/(app)/athlete/LiftsForm.test.tsx`

**Interfaces:**
- Produces: `saveMyLifts(fd): Promise<ActionResult>`, `upsertMyBenchmark(fd): Promise<ActionResult>`, `deleteMyBenchmark(id): Promise<ActionResult>`.
- Produces: `LiftsForm({ lifts: Array<{ lift: LiftName; label: string; timeLift: boolean; defaultValue: string }> })`.
- Produces: `BenchmarkForm()`.

- [ ] **Step 1: Write the failing action test** `myLifts.test.ts`:
  - Mock `server-only`, `@/lib/db/server` (via `fakeSupabase`), `next/cache`, and `@/lib/auth/guards`'s `requireOwnAthleteId`.
  - If `requireOwnAthleteId` is defined in `myLifts.ts` itself rather than in guards, read the file first and mock whatever it calls (`getAthleteSessionContext`) so that it resolves to `"a-1"`.
  - Cases:
    - a `FormData` with every lift blank returns `{ ok: false, message: "Enter at least one lift or time to save." }`;
    - one valid lift (`back_squat=225`, or whichever key `LIFT_NAMES` uses for a weight lift) returns `{ ok: true }` and calls `athlete_lifts.upsert`;
    - `upsertMyBenchmark` with a name and a result returns `{ ok: true }`.

- [ ] **Step 2: Run it and confirm it fails.** `pnpm vitest run src/lib/actions/myLifts.test.ts` must FAIL, because today the actions return `undefined`.

- [ ] **Step 3: Migrate the three actions.**
  - Wrap each body in `return safeAction(async () => { … return ok(); })`.
  - In `saveMyLifts`, replace `if (rows.length === 0) return;` with `if (rows.length === 0) return fail("Enter at least one lift or time to save.");`.
  - Import `type ActionResult, fail, ok` and `safeAction`.
  - Add `"src/lib/actions/myLifts.ts",` to `ACTION_RESULT_FILES`.

- [ ] **Step 4: Write the failing form test** `LiftsForm.test.tsx`:
  - Render `<LiftsForm lifts=[…two lifts…] />` inside a `QueryClientProvider`, with `@/lib/actions/myLifts` mocked so that `saveMyLifts` resolves to `{ ok: false, message: "Enter at least one lift or time to save." }`.
  - Click "Save Lifts".
  - Expect the message text to be on screen.
  - Type `225` into the first input before saving and expect it to still be there afterwards (Review Focus 1).

- [ ] **Step 5: Implement `LiftsForm.tsx`.**

```tsx
"use client";

import type { LiftName } from "@/lib/db/database.types";
import { saveMyLifts } from "@/lib/actions/myLifts";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The athlete's own PRs and run times; blank fields are left as they are. */
export function LiftsForm({
  lifts,
}: {
  lifts: Array<{ lift: LiftName; label: string; timeLift: boolean; defaultValue: string }>;
}) {
  const save = useServerAction(saveMyLifts, { success: "Lifts saved.", toastErrors: false });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {lifts.map((l) => (
        <FormField
          key={l.lift}
          label={`${l.label} ${l.timeLift ? "(mm:ss)" : "(lbs)"}`}
          name={l.lift}
          errors={errors?.[l.lift]}
        >
          {(control) =>
            l.timeLift ? (
              <Input
                {...control}
                type="text"
                // Text keypad: a phone's decimal keypad has no colon.
                inputMode="text"
                placeholder="21:30"
                defaultValue={l.defaultValue}
                className="h-11"
              />
            ) : (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                defaultValue={l.defaultValue}
                className="h-11"
              />
            )
          }
        </FormField>
      ))}
      <div className="col-span-full flex flex-col gap-2">
        <FormAlert error={save.error} />
        <Button type="submit" size="touch" disabled={save.isPending} className="mt-2 w-full sm:w-fit">
          {save.isPending ? "Saving…" : "Save Lifts"}
        </Button>
      </div>
    </form>
  );
}
```

  Check the actual type name for a lift (`LiftName`) and where it is exported; `page.tsx` already imports `LIFT_NAMES`, `LIFT_LABELS` and `isTimeLift`, so follow those imports.

- [ ] **Step 6: Implement `BenchmarkForm.tsx`.** Same pattern:
  - `useServerAction(upsertMyBenchmark, { success: "Benchmark saved.", toastErrors: false, onSuccess: () => formRef.current?.reset() })`.
  - Today's grid (`grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]`).
  - A `FormField` for `name` (label "Benchmark", placeholder "Fran") and one for `result_display` (label "Result", placeholder "3:45"), both `h-11`, `required`, `autoComplete="off"`.
  - `FormAlert`, spanning the full width under the grid.
  - A Save button: `size="touch" className="w-full sm:w-auto"`, with "Saving…" while pending.

- [ ] **Step 7: Put the athlete home into tabs.** In `page.tsx`:
  1. Add `searchParams: Promise<{ tab?: string }>` to the page props.
  2. Add `const TABS = [{ value: "checkin", label: "Check-in" }, { value: "stats", label: "Stats" }, { value: "history", label: "History" }] as const;` and `const tab = pickTab(TABS, (await searchParams).tab);`.
     - Check the `LinkTabs` and `pickTab` APIs as `admin/events/[eventId]/heats/[heatId]/page.tsx` uses them: `pickTab(TABS, value)` and `<LinkTabs tabs={TABS} current={tab} label="…">children</LinkTabs>`.
  3. Under the `PageHeader`, wrap the cards in `<LinkTabs tabs={TABS} current={tab} label="Your dashboard">` and branch on the tab:
     - **checkin:** the Check-In card, then the Current Leaderboard Status card.
     - **stats:** the Lifts card (its `<form>` replaced by `<LiftsForm lifts={…} />`), then the Benchmarks card (its `<form>` replaced by `<BenchmarkForm />`).
     - **history:** the Recent Activity card, then the Competition History card.
  4. Build `lifts` for `LiftsForm` from `LIFT_NAMES`:
     ```ts
     LIFT_NAMES.map((lift) => {
       const existing = liftByName.get(lift);
       const timeLift = isTimeLift(lift);
       return {
         lift,
         label: LIFT_LABELS[lift],
         timeLift,
         defaultValue: timeLift
           ? existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""
           : String(existing?.weight_lbs ?? ""),
       };
     })
     ```
  5. Remove the now-unused imports (`saveMyLifts`, `upsertMyBenchmark`, `Label` if it's unused).
  6. Keep `ConfirmAction` Remove with `onConfirm={deleteMyBenchmark.bind(null, b.id)}`. It now returns `ActionResult`, which `ConfirmAction` already handles.

- [ ] **Step 8: Run the tests and the check.** `pnpm vitest run src/lib/actions/myLifts.test.ts "src/app/(app)/athlete" && pnpm check` must PASS.

- [ ] **Step 9: Commit.** Use the title "The athlete home is Check-in, Stats and History, and its forms say what went wrong". The body says why: the QR stays first and is never under forms; lifts and benchmarks return ActionResult with inline errors; all-blank lifts say so.

---

### Task 2: Directory, `toggleLike` and `createAthleteFromPortal` on `ActionResult`

**Files:**
- Modify: `src/lib/actions/social.ts`
- Rewrite: `src/components/LikeButton.tsx` (client)
- Create: `src/app/(app)/athlete/directory/new/NewAthleteForm.tsx`
- Modify: `src/app/(app)/athlete/directory/new/page.tsx`
- Modify: `uiGuard.ts` (add `social.ts`)
- Test: `src/lib/actions/social.test.ts`
- Test: `src/components/LikeButton.test.tsx`

**Interfaces:**
- Produces: `toggleLike(...): Promise<ActionResult>` and `createAthleteFromPortal(fd): Promise<ActionResult<{ href: string }>>`.
- Produces: `LikeButton` with the same props.

- [ ] **Step 1: Write the failing action test** `social.test.ts`:
  - `toggleLike` with a target row whose `athlete_id` differs returns `{ ok: false, message: "That item doesn't exist, or isn't this athlete's." }`.
  - `createAthleteFromPortal` with a mocked `getAthleteSessionContext` (`athleteId`, `organizationId`) and an `athletes` insert that returns `{ data: { id: "new-1" } }` returns `{ ok: true, data: { href: "/athlete/directory/new-1" } }`.

  Check `ok(data)`'s exact shape in `src/lib/action-result.ts` and assert that shape.

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Migrate both actions.**
  - Wrap each in `safeAction`.
  - `toggleLike`:
    - Replace the `throw new ValidationError(…)` with `return fail(parsed.error.issues[0]?.message ?? "That like isn't valid.")`.
    - Replace the `throw new NotAuthorizedError("That item…")` with `return fail("That item doesn't exist, or isn't this athlete's.")`.
    - End with `return ok();`.
  - `createAthleteFromPortal`:
    - The not-onboarded case becomes `return fail("Complete your own athlete profile before adding others.")`.
    - `if (error) return fail(friendlyAthleteWriteError(error));`
    - Replace `redirect(...)` with `return ok({ href: \`/athlete/directory/${created.id}\` });`.
    - Remove the `redirect` import, and the `NotAuthorizedError`/`ValidationError` imports if they become unused.
  - Add `"src/lib/actions/social.ts",` to `ACTION_RESULT_FILES`.

- [ ] **Step 4: Write the failing LikeButton test.**
  - Mock `@/lib/actions/social` so that `toggleLike` resolves to `{ ok: false, message: "nope" }`.
  - Render with `likedByMe={false} count={2}`.
  - Click the button and expect `aria-pressed="true"` immediately.
  - After the rejection settles, expect `aria-pressed="false"` and the count back to 2.

- [ ] **Step 5: Rewrite `LikeButton.tsx` as a client component.**

```tsx
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
 * once and puts itself back if the server says no. Touch-sized (44px), since
 * athletes use this on a phone.
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
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);
  const liked = optimistic?.liked ?? likedByMe;
  const shown = optimistic?.count ?? count;
  const toggle = useServerAction(() => toggleLike(athleteId, targetType, targetId), {
    onError: () => setOptimistic(null),
    onSettled: () => setOptimistic(null),
  });
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={liked}
      aria-label={`Like${shown > 0 ? `, ${shown} so far` : ""}`}
      disabled={toggle.isPending}
      onClick={() => {
        setOptimistic({ liked: !liked, count: shown + (liked ? -1 : 1) });
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
```

  `onSettled` clears the optimistic state once the refresh brings the server's truth. On success, `useServerAction` refreshes and the props update. If clearing on success shows a flash of the old value before the refresh lands, clear only in `onError` and reset `optimistic` when the props change (store the props the optimistic state was taken from). Record that choice in the ledger.

- [ ] **Step 6: Write `NewAthleteForm.tsx`.**
  - `useServerAction(createAthleteFromPortal, { toastErrors: false, success: "Athlete added.", onSuccess: (data) => router.push(data.href) })`.
  - Use the same five fields as today, each through `FormField` (`h-11`, `autoComplete="off"`, the same labels, required where they are today), then `FormAlert` and a full-width `size="touch"` "Add Athlete" button with "Adding…" while pending.
  - In `page.tsx`, replace the `<form>…</form>` inside `CardContent` with `<NewAthleteForm />` and remove the unused imports.

- [ ] **Step 7: Run the tests and the check, then commit.** Title: "Likes and adding an athlete answer in place instead of an error screen".

---

### Task 3: Onboarding on `ActionResult`

**Files:**
- Create: `src/lib/actions/onboarding.ts` (moved from `src/app/(app)/athlete/actions.ts`)
- Delete: `src/app/(app)/athlete/actions.ts`, if nothing else stays in it
- Modify: `src/app/(app)/athlete/onboarding/OnboardingForm.tsx`
- Modify: `uiGuard.ts` (add `onboarding.ts`)
- Test: `src/lib/actions/onboarding.test.ts`

- [ ] **Step 1: Write the failing test.**
  - `completeAthleteOnboarding(fd)` with the `bootstrap_athlete` RPC erroring returns a failure whose message is `friendlyAthleteWriteError`'s.
  - With the RPC succeeding, it returns `{ ok: true, data: { href: "/athlete" } }`.
  - Give the fake client an `rpc` mock, as `broadcast.test.ts` does.

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Move and migrate the action.**
  - Move it to `src/lib/actions/onboarding.ts`, keeping `"use server"`, the schema and the doc comment.
  - New signature: `completeAthleteOnboarding(formData: FormData): Promise<ActionResult<{ href: string }>>`, with the body in `safeAction`.
  - Drop the try/catch around `parseForm`, since `safeAction` converts `ValidationError`.
  - `if (error) return fail(friendlyAthleteWriteError(error));`
  - `revalidatePath("/athlete"); return ok({ href: "/athlete" });`
  - Run `grep -rn "athlete/actions\|from \"../actions\"" src` to find other importers. If `actions.ts` exports anything else, move that too.
  - Delete the old file.
  - Add `"src/lib/actions/onboarding.ts",` to `ACTION_RESULT_FILES`.

- [ ] **Step 4: Switch `OnboardingForm` to `useServerAction`.**
  - Replace `useActionState` with `const save = useServerAction(completeAthleteOnboarding, { toastErrors: false, onSuccess: (data) => router.push(data.href) })`.
  - `onSubmit`: `save.mutate(new FormData(e.currentTarget))`.
  - Render each input through `FormField`, so its field error shows under it, and the form-level error through `FormAlert` (replacing the `state.error` paragraph).
  - Add `autoComplete="organization"` on affiliate, `"email"`, `"tel"` and `"bday"`. `given-name` and `family-name` already exist.
  - The submit button shows the pending state from `save.isPending`.

- [ ] **Step 5: Run the tests and the check, then commit.** Title: "Onboarding answers like every other form and lives with the other actions".

---

### Task 4: One thread and composer for athletes and staff

**Files:**
- Modify: `src/lib/actions/messages.ts`
- Create: `src/components/messages/MessageThread.tsx`
- Create: `src/components/messages/MessageComposer.tsx`
- Create: `src/components/messages/ThreadLiveRefresh.tsx`
- Modify: `src/app/(app)/athlete/messages/[counterpartId]/page.tsx`
- Modify: `src/app/(app)/admin/messages/[counterpartId]/page.tsx`
- Modify: `src/app/(app)/admin/messages/page.tsx` (rows `min-h-14`)
- Modify: `uiGuard.ts` (add `messages.ts`)
- Test: `src/lib/actions/messages.test.ts`
- Test: `src/components/messages/MessageComposer.test.tsx`
- Test: `src/components/messages/MessageThread.test.tsx`

- [ ] **Step 1: Write the failing tests.**
  - **`messages.test.ts`:** an insert error with `code: "42501"` returns `{ ok: false, message: "You can't message this person." }`, and success returns `{ ok: true }`. Mock `requireSignedIn`.
  - **`MessageComposer.test.tsx`:**
    - Typing "Hi" and clicking Send calls `sendMessage("u-2", fd)` with `fd.get("body") === "Hi"`, shows "Sending…" while pending (resolve the promise later), and clears the textarea after `{ ok: true }`.
    - On `{ ok: false, message: "You can't message this person." }`, the text stays and the message shows.
    - Enter sends; Shift+Enter doesn't send.
  - **`MessageThread.test.tsx`:**
    - Stub `Element.prototype.scrollIntoView = vi.fn()`.
    - Render two messages and expect one call. Rerender with a third and expect a second call. Rerender with the same three and expect no new call.
    - With no messages, "No messages yet. Say hello." shows.

- [ ] **Step 2: Run them and confirm they fail.**

- [ ] **Step 3: Migrate `sendMessage`.**
  - Wrap it in `safeAction`.
  - `if (error) { if (error.code === "42501") return fail("You can't message this person."); throw new Error(error.message); }`
  - Keep the revalidations, then `return ok();`.
  - Drop the `NotAuthorizedError` import.
  - Add `"src/lib/actions/messages.ts",` to the guard list.

- [ ] **Step 4: Implement the components.**

`MessageThread.tsx`:

```tsx
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
          <p className={`mt-1 text-xs ${m.fromMe ? "text-primary-foreground" : "text-muted-foreground"}`}>
            <span className="sr-only">{m.fromMe ? "You, " : `${counterpartName}, `}</span>
            {formatDateTime(m.createdAt)}
          </p>
        </li>
      ))}
      {messages.length === 0 && <li className="text-muted-foreground">No messages yet. Say hello.</li>}
    </ol>
  );
}
```

  Check `formatDateTime`'s import path. The athlete thread page already imports it, so follow that import.

`MessageComposer.tsx`:

```tsx
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
    onSuccess: () => setBody(""),
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
```

  jsdom may not implement `requestSubmit`. If the Enter test fails for that reason, stub it in the test with `HTMLFormElement.prototype.requestSubmit = function () { this.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); };`.

`ThreadLiveRefresh.tsx`:

```tsx
"use client";

import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";

/**
 * Re-renders the open thread when a message to this user arrives: the server
 * renders the new message and marks it read, and the thread scrolls to it.
 */
export function ThreadLiveRefresh({ myUserId }: { myUserId: string }) {
  useRefreshOnChanges([{ table: "messages", filter: `recipient_id=eq.${myUserId}` }]);
  return null;
}
```

  Check the `TableWatch` shape in `useRefreshOnChanges.ts` (`table` and `filter`) and match it. If `table` is a typed union that doesn't include `"messages"`, add it there.

- [ ] **Step 5: Use the components in both thread pages.**
  - **Athlete thread:**
    - Replace the `<ol>…</ol>` with `<MessageThread messages={thread} counterpartName={counterpart.name} />`.
    - Keep today's sticky `<form …>` container classes on a `<div>` wrapping `<MessageComposer recipientId={counterpartId} recipientName={counterpart.name} />`.
    - Add `<ThreadLiveRefresh myUserId={ctx.userId} />`.
    - Remove the unused imports (`sendMessage`, `Textarea`, `Label`, `Send`, `formatDateTime`).
  - **Admin thread:**
    - Replace the bubbles `div` with `MessageThread`, and the form with `<div className="sticky bottom-0 -mx-4 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6"><MessageComposer … /></div>`.
    - Add `<ThreadLiveRefresh myUserId={ctx.userId} />`.
    - Remove the unused imports.
  - **Admin list:** add `min-h-14` to each conversation `Link`'s class.

- [ ] **Step 6: Run the tests and the check, then commit.** Title: "Athletes and staff share one chat that opens at the newest message and shows replies as they arrive".

---

### Task 5: Browser verification, final review and PR

- [ ] **Step 1: Browser run.** Follow spec §6 (screenshots in `.verify/athlete/`), with these specifics:
  - Use two isolated contexts: the athlete at 390 and the admin at 1440.
  - Type a draft on the athlete thread before the admin replies. Check that the draft survives the refresh (Review Focus 3).
  - Lighthouse on `/athlete` and on the athlete thread, mobile.
- [ ] **Step 2: Clean up.** Delete the test messages between the athlete and admin, the test benchmarks and lifts (restore the original values if any existed), likes, and any athlete created. Close the browser pages.
- [ ] **Step 3: Final review.** One whole-branch review on the most capable model. Fix every Critical and Important finding, each with a test that fails first, then run `pnpm check` and commit, chained.
- [ ] **Step 4: PR.** `gh pr create --base staging`, with a body covering what changed, why, and how it was verified, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Stop at the PR link.

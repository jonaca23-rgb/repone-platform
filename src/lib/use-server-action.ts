"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AnyActionResult, FieldErrors } from "@/lib/action-result";

/** A failed action, as TanStack Query sees it: the message plus its field errors. */
export class ActionError extends Error {
  readonly fieldErrors: FieldErrors;
  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

export function fieldErrorsOf(error: unknown): FieldErrors | undefined {
  return error instanceof ActionError ? error.fieldErrors : undefined;
}

/** What a successful result carries: its `data`, or nothing. */
type Data<R> = Extract<R, { ok: true }> extends { data: infer D } ? D : undefined;

type Options<TInput, R> = Omit<UseMutationOptions<Data<R>, ActionError, TInput>, "mutationFn"> & {
  /** Toast on success. Omit to use the server's own words, if it sent any. */
  success?: string | ((data: Data<R>, input: TInput) => string);
  /** Re-render server components after success (default true). */
  refresh?: boolean;
  /** Toast failures (default true). A form showing errors inline passes false. */
  toastErrors?: boolean;
};

/**
 * Runs a server action as a TanStack Query mutation. The one place that knows
 * a failure arrives as `{ ok: false }`: it becomes an ActionError so
 * isPending, error and mutateAsync behave as callers expect. A second call
 * while one is in flight is ignored.
 */
export function useServerAction<TInput, R extends AnyActionResult>(
  action: (input: TInput) => Promise<R>,
  {
    success,
    refresh = true,
    toastErrors = true,
    onSuccess,
    onError,
    onSettled,
    ...options
  }: Options<TInput, R> = {},
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);
  // The server's own success words ("Invitation sent."), used when the caller sets no `success`.
  const serverMessage = useRef<string | undefined>(undefined);
  // A form can close mid-save (a drawer swiped down). Its inline error would
  // then never show, so a failure that lands after unmount is toasted instead.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutation = useMutation<Data<R>, ActionError, TInput>({
    ...options,
    mutationFn: async (input) => {
      const result = await action(input);
      if (!result.ok) throw new ActionError(result.message, result.fieldErrors);
      serverMessage.current = result.message;
      return ("data" in result ? result.data : undefined) as Data<R>;
    },
    onSuccess: async (data, input, ...rest) => {
      const words = success
        ? typeof success === "function"
          ? success(data, input)
          : success
        : serverMessage.current;
      if (words) toast.success(words);
      await onSuccess?.(data, input, ...rest);
      if (refresh) startTransition(() => router.refresh());
    },
    onError: (error, input, ...rest) => {
      if (toastErrors || !mounted.current) toast.error(error.message);
      return onError?.(error, input, ...rest);
    },
    onSettled: (...args) => {
      inFlight.current = false;
      return onSettled?.(...args);
    },
  });

  const mutate: typeof mutation.mutate = (...args) => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(...args);
  };

  return { ...mutation, mutate };
}

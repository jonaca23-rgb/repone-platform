import { vi } from "vitest";

type Response = { data?: unknown; error?: { message: string; code?: string } | null };

/**
 * A chainable stand-in for the Supabase query builder, for action tests. Each
 * awaited query resolves to the next response queued for its table, in call
 * order:
 *   fakeSupabase({ sponsors: [{ error: { message: "… sponsors_category_exclusive_uidx …" } }] })
 * A table with nothing queued resolves to { data: null, error: null }.
 * `calls` records [table, method, args] for assertions.
 */
export function fakeSupabase(responses: Record<string, Response[]>) {
  const calls: Array<[string, string, unknown[]]> = [];
  const queues = new Map(Object.entries(responses).map(([t, r]) => [t, [...r]]));

  function builder(table: string): unknown {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") {
            const r = queues.get(table)?.shift() ?? {};
            return (resolve: (v: unknown) => void) =>
              resolve({ data: r.data ?? null, error: r.error ?? null });
          }
          return (...args: unknown[]) => {
            calls.push([table, prop, args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  return { client: { from: vi.fn((table: string) => builder(table)) }, calls };
}

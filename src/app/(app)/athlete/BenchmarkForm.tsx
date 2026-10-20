"use client";

import { useRef } from "react";
import { upsertMyBenchmark } from "@/lib/actions/myLifts";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Log or update one benchmark time; clears once it's saved. */
export function BenchmarkForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useServerAction(upsertMyBenchmark, {
    success: "Benchmark saved.",
    toastErrors: false,
    onSuccess: () => formRef.current?.reset(),
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-2"
    >
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <FormField label="Benchmark" name="name" errors={errors?.name}>
          {(control) => (
            <Input {...control} required placeholder="Fran" autoComplete="off" className="h-11" />
          )}
        </FormField>
        <FormField label="Result" name="result_display" errors={errors?.result_display}>
          {(control) => (
            <Input {...control} required placeholder="3:45" autoComplete="off" className="h-11" />
          )}
        </FormField>
        <Button type="submit" size="touch" disabled={save.isPending} className="w-full sm:w-auto">
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <FormAlert error={save.error} />
    </form>
  );
}

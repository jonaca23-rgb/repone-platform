"use client";

import { Plus, Trophy } from "lucide-react";
import { deleteAthleteBenchmark, upsertAthleteBenchmark } from "@/lib/actions/athletes";
import { dataTableColumns } from "@/lib/data-table";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { DataTable } from "@/components/app/data-table/DataTable";
import { createTableContext } from "@/components/app/data-table/tableContext";
import { EmptyState } from "@/components/app/EmptyState";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { FormField } from "@/components/app/FormField";
import { RowActions, useEntityDialogs } from "@/components/app/RowActions";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BenchmarkRow = { id: string; name: string; result: string };

const [BenchmarksProvider, useBenchmarks] = createTableContext<{
  athleteId: string;
  athleteName: string;
}>("BenchmarksTable");

function BenchmarkForm({ athleteId, close }: { athleteId: string; close: () => void }) {
  const save = useServerAction((fd: FormData) => upsertAthleteBenchmark(athleteId, fd), {
    success: "Benchmark saved",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField
        label="Benchmark"
        name="name"
        errors={errors?.name}
        description="Saving one that already exists replaces its result."
      >
        {(c) => <Input {...c} required placeholder="Fran" />}
      </FormField>
      <FormField label="Result" name="result_display" errors={errors?.result_display}>
        {(c) => <Input {...c} required placeholder="3:45" />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        Save benchmark
      </SubmitButton>
    </form>
  );
}

function BenchmarkActions({ b }: { b: BenchmarkRow }) {
  const { athleteId, athleteName } = useBenchmarks();
  const dialogs = useEntityDialogs<"remove">();
  return (
    <>
      <RowActions
        label={`Actions for ${b.name}`}
        destructive={[{ label: "Remove benchmark", onSelect: dialogs.show("remove") }]}
      />
      <ConfirmAction
        {...dialogs.props("remove")}
        title={`Remove ${b.name}?`}
        description={`${athleteName}'s ${b.name} time (${b.result}) is deleted from their benchmarks.`}
        confirmLabel="Remove benchmark"
        onConfirm={() => deleteAthleteBenchmark(athleteId, b.id)}
      />
    </>
  );
}

const col = dataTableColumns<BenchmarkRow>();
const columns = [
  col.accessor("name", {
    header: "Benchmark",
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>,
  }),
  col.accessor("result", {
    header: "Result",
    enableSorting: false,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { rowActions: true },
    cell: ({ row }) => <BenchmarkActions b={row.original} />,
  }),
];

export function BenchmarksTable({
  athleteId,
  athleteName,
  rows,
}: {
  athleteId: string;
  athleteName: string;
  rows: BenchmarkRow[];
}) {
  const add = (
    <FormDialog
      title="Add benchmark"
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Add benchmark
        </Button>
      }
    >
      {(close) => <BenchmarkForm athleteId={athleteId} close={close} />}
    </FormDialog>
  );
  return (
    <BenchmarksProvider value={{ athleteId, athleteName }}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        toolbar={add}
        empty={<EmptyState icon={Trophy} title="No benchmark workouts yet" action={add} />}
      />
    </BenchmarksProvider>
  );
}

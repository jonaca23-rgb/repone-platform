/** The row above a table: search and filters on the left, the primary action on the right; stacks on a phone. */
export function TableToolbar({
  children,
  actions,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center">
        {children}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

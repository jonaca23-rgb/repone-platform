import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createTeam, deleteTeam, addTeamMember, removeTeamMember } from "@/lib/actions/teams";
import type { EntryFormat } from "@/lib/db/database.types";

const ENTRY_FORMAT_LABELS: Record<EntryFormat, string> = {
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

export default async function TeamsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [{ data: teams }, { data: athletes }, { data: members }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, affiliate, entry_format, team_size")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("name"),
    supabase
      .from("athletes")
      .select("id, first_name, last_name, affiliate")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("last_name"),
    supabase
      .from("team_members")
      .select("id, team_id, athletes(id, first_name, last_name, affiliate)"),
  ]);

  const typedMembers = (members ?? []) as unknown as Array<{
    id: string;
    team_id: string;
    athletes: {
      id: string;
      first_name: string;
      last_name: string;
      affiliate: string | null;
    } | null;
  }>;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Teams</h1>
      <p className="mb-6 text-sm text-black/50">
        Your organization&apos;s team pool — pairs, teams, or any custom competitor format built
        from athletes on your roster. Register a team into a division from that event&apos;s
        Athletes &amp; Registrations page. Entry format and headcount here are for display and
        fee-matching only — no roster size is ever enforced.
      </p>

      <form
        action={createTeam}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Team name
          <input
            name="name"
            required
            placeholder="Box Wolves"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Box / affiliate
          <input name="affiliate" className="rounded-md border border-black/20 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Entry format
          <select
            name="entry_format"
            defaultValue="team"
            className="rounded-md border border-black/20 px-3 py-2"
          >
            {Object.entries(ENTRY_FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Headcount (optional)
          <input
            name="team_size"
            type="number"
            min={1}
            placeholder="e.g. 4"
            className="w-28 rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        <button className="control-btn control-btn-red px-6 py-3 text-base">Add Team</button>
      </form>

      <div className="flex flex-col gap-4">
        {(teams ?? []).map((t) => {
          const roster = typedMembers.filter((m) => m.team_id === t.id);
          const rosterAthleteIds = new Set(roster.map((m) => m.athletes?.id));
          const available = (athletes ?? []).filter((a) => !rosterAthleteIds.has(a.id));

          return (
            <div key={t.id} className="rounded-lg border border-black/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {t.name}
                    {t.affiliate ? (
                      <span className="ml-2 text-sm font-normal text-black/40">{t.affiliate}</span>
                    ) : null}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-black/50">
                    {ENTRY_FORMAT_LABELS[t.entry_format as EntryFormat]}
                    {t.team_size ? ` · ${t.team_size} roster spots` : ""} · {roster.length} on
                    roster now
                  </p>
                </div>
                <form action={deleteTeam.bind(null, t.id)}>
                  <button className="text-sm text-black/40 hover:text-repone-red">
                    Delete team
                  </button>
                </form>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {roster.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-sm"
                  >
                    {m.athletes?.first_name} {m.athletes?.last_name}
                    <form action={removeTeamMember.bind(null, m.id)}>
                      <button
                        className="text-black/40 hover:text-repone-red"
                        aria-label="Remove from roster"
                      >
                        ×
                      </button>
                    </form>
                  </span>
                ))}
                {roster.length === 0 && (
                  <span className="text-sm text-black/40">No roster members yet.</span>
                )}
              </div>

              {available.length > 0 && (
                <form action={addTeamMember.bind(null, t.id)} className="flex items-end gap-2">
                  <select
                    name="athlete_id"
                    className="rounded-md border border-black/20 px-3 py-2 text-sm"
                  >
                    {available.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.first_name} {a.last_name} {a.affiliate ? `(${a.affiliate})` : ""}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-black/20 px-3 py-2 text-sm hover:border-repone-red">
                    Add to roster
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {teams?.length === 0 && <p className="text-black/50">No teams yet — create one above.</p>}
      </div>
    </div>
  );
}

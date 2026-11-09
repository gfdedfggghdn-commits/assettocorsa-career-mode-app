import { useState } from "react";
import {
  constructorStandings,
  driverStandings,
  seasonTrackInfo,
  type StandingRow,
} from "@/lib/career/engine";
import { Flag, countryCode } from "@/lib/career/flags";
import { PLAYER_DRIVER_ID, PLAYER_TEAM_ID, type CareerData, type SeasonRecord } from "@/lib/career/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isDriverCareer, transferPlayer } from "@/lib/career/driver";

type Props = {
  data: CareerData;
  /** when given, clicking a driver in the current season lets you change their team */
  update?: (fn: (d: CareerData) => void) => void;
  /** pin to a season (used by the season summary) */
  seasonIndex?: number;
};

export function StandingsPanel({ data, update, seasonIndex }: Props) {
  const seasons = data.seasons;
  const [index, setIndex] = useState(seasonIndex ?? Math.max(0, seasons.length - 1));
  const [view, setView] = useState<"drivers" | "constructors">("drivers");
  const [editing, setEditing] = useState<StandingRow | null>(null);
  const [transferTeam, setTransferTeam] = useState<string | null>(null);
  const [cellW, setCellW] = useState(32);
  const season = seasons[Math.min(index, seasons.length - 1)];

  if (!season) return <p className="text-sm text-muted-foreground">No season has started yet.</p>;

  const isCurrent = index === seasons.length - 1;
  const canEdit = !!update && isCurrent && !season.completed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {seasonIndex == null ? (
          <div className="flex items-center gap-3">
            <button className="disabled:opacity-30" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous season">
              <ChevronLeft className="size-5" />
            </button>
            <span className="headline text-2xl">Season {season.number}</span>
            <button
              className="disabled:opacity-30"
              disabled={index >= seasons.length - 1}
              onClick={() => setIndex(index + 1)}
              aria-label="Next season"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 label-caps">
          Race column width
          <input type="range" min={18} max={60} value={cellW} onChange={(e) => setCellW(Number(e.target.value))} className="w-32 accent-[var(--primary)]" />
        </label>
        <div className="flex gap-1 rounded-md bg-surface-2 p-1">
          {(["drivers", "constructors"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`label-caps rounded px-3 py-1.5 ${view === v ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
            >
              {v === "drivers" ? "Drivers" : "Constructors"}
            </button>
          ))}
        </div>
      </div>

      {view === "drivers" ? (
        <DriverTable cellW={cellW} data={data} season={season} onPick={canEdit ? setEditing : undefined} />
      ) : (
        <ConstructorTable cellW={cellW} data={data} season={season} />
      )}
      {canEdit && view === "drivers" && (
        <p className="text-xs text-muted-foreground">Click a driver to change the team they race for.</p>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="headline text-2xl">Where does {editing?.label} drive now?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {[
              ...(!isDriverCareer(data) ? [{ id: PLAYER_TEAM_ID, name: data.team.name || "My Team", colour: data.team.colour || "#e10600" }] : []),
              ...data.db.teams.filter((t) => t.active !== false),
              ...(editing?.id !== PLAYER_DRIVER_ID ? [{ id: "", name: "Free Agent", colour: "transparent" }] : []),
            ].map((t) => (
              <Button
                key={t.id || "free"}
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  if (!editing || !update) return;
                  const id = editing.id;
                  if (id === PLAYER_DRIVER_ID) { setTransferTeam(t.id); return; }
                  update((next) => {
                    const sea = next.seasons[next.seasons.length - 1];
                    if (!sea) return;
                    const playerTeam = sea.playerTeamId ?? PLAYER_TEAM_ID;
                    if (sea.teamMateId === id && t.id !== playerTeam) sea.teamMateId = null;
                    if (t.id === playerTeam) sea.teamMateId = id;
                    const prevTeam = sea.driverTeams[id] ?? "";
                    for (const r of sea.results) {
                      if (r.positions[id] == null) continue;
                      r.teams ??= {};
                      // races run as a free agent go to the new team; races already run for a team stay with that team
                      if (!(id in r.teams)) r.teams[id] = prevTeam;
                      if (!r.teams[id]) r.teams[id] = t.id;
                    }
                    if (t.id) sea.driverTeams[id] = t.id;
                    else delete sea.driverTeams[id];
                  });
                  setEditing(null);
                }}
              >
                <span className="mr-2 h-4 w-1.5 rounded-sm" style={{ background: t.colour }} />
                {t.name || "Unnamed"}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={transferTeam !== null} onOpenChange={o => { if (!o) setTransferTeam(null); }}><DialogContent><DialogHeader><DialogTitle>Confirm mid-season transfer?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This resets your team-mate head-to-head and rivalry. You must choose a new rival before the next race.</p><div className="flex gap-2"><Button variant="secondary" onClick={() => setTransferTeam(null)}>Go back</Button><Button onClick={() => { if (!update || transferTeam === null) return; update(next => { const sea = next.seasons.at(-1); if (sea) transferPlayer(next, sea, transferTeam); }); setTransferTeam(null); setEditing(null); }}>Confirm transfer</Button></div></DialogContent></Dialog>
    </div>
  );
}

function RoundHeaders({ data, season, cellW }: { data: CareerData; season: SeasonRecord; cellW: number }) {
  return (
    <>
      {season.calendar.map((id, i) => {
        const t = seasonTrackInfo(data, season, id);
        const code = countryCode(t.country);
        return (
          <th key={i} style={{ minWidth: cellW, width: cellW }} className="px-0 py-2 text-center" title={`R${i + 1} ${t.country}`}>
            <span className="flex flex-col items-center gap-0.5">
              <Flag nationality={t.country} />
              <span className="font-mono text-[10px] text-muted-foreground">{code ?? `R${i + 1}`}</span>
            </span>
          </th>
        );
      })}
    </>
  );
}

function cellClass(pos: number | null) {
  if (pos === 1) return "bg-[var(--gold,#d4af37)]/30 font-bold";
  if (pos === 2) return "bg-muted-foreground/25 font-bold";
  if (pos === 3) return "bg-accent/25 font-bold";
  return "";
}

function DriverTable({
  data,
  season,
  onPick,
  cellW,
}: {
  cellW: number;
  data: CareerData;
  season: SeasonRecord;
  onPick?: ((r: StandingRow) => void) | undefined;
}) {
  const rows = driverStandings(data, season);
  const leader = rows[0]?.total ?? 0;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="label-caps sticky z-10 bg-surface left-0 w-10 min-w-10 px-2 py-2 text-right">#</th>
            <th className="label-caps sticky z-10 bg-surface left-10 w-44 min-w-44 px-3 py-2 text-left">Driver</th>
            <th className="label-caps sticky z-10 bg-surface left-54 w-40 min-w-40 border-r border-border px-3 py-2 text-left">Team</th>
            <RoundHeaders cellW={cellW} data={data} season={season} />
            <th className="label-caps sticky z-10 bg-surface right-16 w-16 min-w-16 border-l border-border px-3 py-2 text-right">Pts</th>
            <th className="label-caps sticky z-10 bg-surface right-0 w-16 min-w-16 px-3 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rank) => {
            const clickable = !!onPick && (r.id !== PLAYER_DRIVER_ID || isDriverCareer(data));
            return (
              <tr
                key={r.id}
                className={`[&>td]:border-t [&>td]:border-border/60 ${clickable ? "cursor-pointer hover:bg-surface-2" : ""} ${
                  r.id === PLAYER_DRIVER_ID ? "bg-primary/10" : ""
                }`}
                onClick={() => { if (clickable && onPick) onPick(r); }}
              >
                <td className="sticky z-10 bg-surface left-0 w-10 min-w-10 px-2 py-1 text-right font-mono text-muted-foreground">{rank + 1}</td>
                <td className="sticky z-10 bg-surface left-10 w-44 min-w-44 max-w-44 truncate whitespace-nowrap px-3 py-1">
                  <span className="flex items-center gap-2">
                    <Flag nationality={r.nationality} />
                    {r.label}
                  </span>
                </td>
                <td className="sticky z-10 bg-surface left-54 w-40 min-w-40 max-w-40 truncate whitespace-nowrap border-r border-border px-3 py-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-4 w-1 rounded-sm" style={{ background: r.colour }} aria-hidden />
                    {r.teamName}
                  </span>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} style={{ minWidth: cellW, width: cellW }} className={`px-0 py-1 text-center font-mono ${cellClass(c)}`}>
                    {c ?? ""}
                  </td>
                ))}
                <td className="sticky z-10 bg-surface right-16 w-16 min-w-16 border-l border-border px-3 py-1 text-right font-mono font-bold">{r.total}</td>
                <td className="sticky z-10 bg-surface right-0 w-16 min-w-16 px-3 py-1 text-right font-mono text-muted-foreground">
                  {rank === 0 ? "—" : r.total - leader}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConstructorTable({ data, season, cellW }: { data: CareerData; season: SeasonRecord; cellW: number }) {
  const rows = constructorStandings(data, season);
  const leader = rows[0]?.total ?? 0;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="label-caps sticky z-10 bg-surface left-0 w-10 min-w-10 px-2 py-2 text-right">#</th>
            <th className="label-caps sticky z-10 bg-surface left-10 w-52 min-w-52 border-r border-border px-3 py-2 text-left">Team</th>
            <RoundHeaders cellW={cellW} data={data} season={season} />
            <th className="label-caps sticky z-10 bg-surface right-16 w-16 min-w-16 border-l border-border px-3 py-2 text-right">Pts</th>
            <th className="label-caps sticky z-10 bg-surface right-0 w-16 min-w-16 px-3 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rank) => (
            <tr key={r.id} className="[&>td]:border-t [&>td]:border-border/60">
              <td className="sticky z-10 bg-surface left-0 w-10 min-w-10 px-2 py-1 text-right font-mono text-muted-foreground">{rank + 1}</td>
              <td className="sticky z-10 bg-surface left-10 w-52 min-w-52 max-w-52 truncate whitespace-nowrap border-r border-border px-3 py-1">
                <span className="flex items-center gap-2">
                  <Flag nationality={r.nationality} />
                  <span className="h-4 w-1 rounded-sm" style={{ background: r.colour }} aria-hidden />
                  {r.label}
                </span>
              </td>
              {r.cells.map((c, i) => (
                <td key={i} style={{ minWidth: cellW, width: cellW }} className="px-0 py-1 text-center font-mono">
                  {c ?? ""}
                </td>
              ))}
              <td className="sticky z-10 bg-surface right-16 w-16 min-w-16 border-l border-border px-3 py-1 text-right font-mono font-bold">{r.total}</td>
              <td className="sticky z-10 bg-surface right-0 w-16 min-w-16 px-3 py-1 text-right font-mono text-muted-foreground">
                {rank === 0 ? "—" : r.total - leader}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

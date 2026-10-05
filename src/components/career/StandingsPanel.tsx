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
        <DriverTable data={data} season={season} onPick={canEdit ? setEditing : undefined} />
      ) : (
        <ConstructorTable data={data} season={season} />
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
              { id: PLAYER_TEAM_ID, name: data.team.name || "My Team", colour: data.team.colour || "#e10600" },
              ...data.db.teams,
              { id: "", name: "Free Agent", colour: "transparent" },
            ].map((t) => (
              <Button
                key={t.id || "free"}
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  const id = editing!.id;
                  update!((next) => {
                    const sea = next.seasons[next.seasons.length - 1];
                    if (!sea) return;
                    if (sea.teamMateId === id && t.id !== PLAYER_TEAM_ID) sea.teamMateId = null;
                    if (t.id === PLAYER_TEAM_ID) sea.teamMateId = id;
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
    </div>
  );
}

function RoundHeaders({ data, season }: { data: CareerData; season: SeasonRecord }) {
  return (
    <>
      {season.calendar.map((id, i) => {
        const t = seasonTrackInfo(data, season, id);
        const code = countryCode(t.country);
        return (
          <th key={i} className="px-1 py-2 text-center" title={`R${i + 1} ${t.country}`}>
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
}: {
  data: CareerData;
  season: SeasonRecord;
  onPick?: ((r: StandingRow) => void) | undefined;
}) {
  const rows = driverStandings(data, season);
  const leader = rows[0]?.total ?? 0;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="label-caps px-2 py-2 text-right">#</th>
            <th className="label-caps sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left">Driver</th>
            <th className="label-caps px-3 py-2 text-left">Team</th>
            <RoundHeaders data={data} season={season} />
            <th className="label-caps px-3 py-2 text-right">Pts</th>
            <th className="label-caps px-3 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rank) => {
            const clickable = !!onPick && r.id !== PLAYER_DRIVER_ID;
            return (
              <tr
                key={r.id}
                className={`border-t border-border/60 ${clickable ? "cursor-pointer hover:bg-surface-2" : ""} ${
                  r.id === PLAYER_DRIVER_ID ? "bg-primary/10" : ""
                }`}
                onClick={() => clickable && onPick!(r)}
              >
                <td className="px-2 py-1 text-right font-mono text-muted-foreground">{rank + 1}</td>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-1 px-3 py-1">
                  <span className="flex items-center gap-2">
                    <Flag nationality={r.nationality} />
                    {r.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-4 w-1 rounded-sm" style={{ background: r.colour }} aria-hidden />
                    {r.teamName}
                  </span>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className={`px-1 py-1 text-center font-mono ${cellClass(c)}`}>
                    {c ?? ""}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-mono font-bold">{r.total}</td>
                <td className="px-3 py-1 text-right font-mono text-muted-foreground">
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

function ConstructorTable({ data, season }: { data: CareerData; season: SeasonRecord }) {
  const rows = constructorStandings(data, season);
  const leader = rows[0]?.total ?? 0;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="label-caps px-2 py-2 text-right">#</th>
            <th className="label-caps px-3 py-2 text-left">Team</th>
            <RoundHeaders data={data} season={season} />
            <th className="label-caps px-3 py-2 text-right">Pts</th>
            <th className="label-caps px-3 py-2 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rank) => (
            <tr key={r.id} className="border-t border-border/60">
              <td className="px-2 py-1 text-right font-mono text-muted-foreground">{rank + 1}</td>
              <td className="whitespace-nowrap px-3 py-1">
                <span className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-sm" style={{ background: r.colour }} aria-hidden />
                  {r.label}
                </span>
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="px-1 py-1 text-center font-mono">
                  {c ?? ""}
                </td>
              ))}
              <td className="px-3 py-1 text-right font-mono font-bold">{r.total}</td>
              <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                {rank === 0 ? "—" : r.total - leader}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currentSeason, driverTeamOf, money, seasonDriverInfo, seasonTrackInfo, teamLabel } from "@/lib/career/engine";
import { applyRaceResult } from "@/lib/career/season";
import { Flag } from "@/lib/career/flags";
import { PLAYER_DRIVER_ID, type CareerData, type CareerState } from "@/lib/career/types";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ENTRY_STATES: CareerState[] = ["ACTIVE_SEASON"];

export function CalendarDebugPanel({
  data,
  state,
  apply,
}: {
  data: CareerData;
  state: CareerState;
  apply: (fn: (d: CareerData) => void, nextState: CareerState) => void;
}) {
  const season = currentSeason(data);
  const [entering, setEntering] = useState<number | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [adding, setAdding] = useState("");

  if (!season) return <p className="text-sm text-muted-foreground">No season is running.</p>;
  if (season.completed)
    return <p className="text-sm text-muted-foreground">This season is finished; its calendar is locked.</p>;

  const resultFor = (round: number) => season.results.find((r) => r.round === round);
  // everyone currently in a team + the player
  // teams alphabetically (drivers in a team by surname), then every free agent by surname
  const surname = (id: string) => {
    const d = data.db.drivers.find((x) => x.id === id);
    return d ? `${d.lastName} ${d.firstName}`.toLowerCase() : seasonDriverInfo(data, season, id).name.toLowerCase();
  };
  const teamed = [
    PLAYER_DRIVER_ID,
    ...Object.entries(season.driverTeams)
      .filter(([id, t]) => t && id !== PLAYER_DRIVER_ID)
      .map(([id]) => id),
  ].sort((a, b) => {
    const ta = teamLabel(data, driverTeamOf(season, a)).toLowerCase();
    const tb = teamLabel(data, driverTeamOf(season, b)).toLowerCase();
    return ta.localeCompare(tb) || surname(a).localeCompare(surname(b));
  });
  const free = data.db.drivers
    .filter((d) => !season.driverTeams[d.id])
    .map((d) => d.id)
    .sort((a, b) => surname(a).localeCompare(surname(b)));
  const grid = [...teamed, ...free];
  const label = (id: string) => {
    const info = seasonDriverInfo(data, season, id);
    const team = driverTeamOf(season, id);
    return `${info.name} (${id === PLAYER_DRIVER_ID ? "You" : team ? teamLabel(data, team) : "Free agent"})`;
  };

  const removeResult = (round: number) => {
    apply((next) => {
      const sea = next.seasons[next.seasons.length - 1]!;
      const r = sea.results.find((x) => x.round === round);
      if (!r) return;
      next.cash -= r.earned ?? 0;
      sea.results = sea.results.filter((x) => x.round !== round);
      next.lastRaceEarnings = sea.results.length ? next.lastRaceEarnings : null;
    }, state === "MID_SEASON_CONTRACT_WINDOW" ? "ACTIVE_SEASON" : state);
    toast.success(`Result for round ${round} removed.`);
  };

  const editCalendar = (fn: (cal: string[], results: { round: number }[]) => void) =>
    apply((next) => {
      const sea = next.seasons[next.seasons.length - 1]!;
      fn(sea.calendar, sea.results);
    }, state);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= season.calendar.length || resultFor(j + 1)) return;
    editCalendar((cal) => {
      [cal[i], cal[j]] = [cal[j]!, cal[i]!];
    });
  };

  const removeRound = (i: number) =>
    editCalendar((cal, results) => {
      cal.splice(i, 1);
      for (const r of results) if (r.round > i + 1) r.round -= 1;
    });

  const openEntry = (round: number) => {
    setPicks(Array.from({ length: grid.length - data.db.drivers.filter((d) => !season.driverTeams[d.id]).length }, () => ""));
    setEntering(round);
  };

  const saveEntry = () => {
    if (entering == null) return;
    const positions: Record<string, number> = {};
    picks.forEach((id, i) => {
      if (id && positions[id] == null) positions[id] = i + 1;
    });
    if (!Object.keys(positions).length) {
      toast.error("Pick at least one finisher.");
      return;
    }
    const round = entering;
    let msg = "";
    let nextState: CareerState = state;
    const next = structuredClone(data);
    const sea = next.seasons[next.seasons.length - 1]!;
    const trackId = sea.calendar[round - 1]!;
    const out = applyRaceResult(next, sea, round, trackId, seasonTrackInfo(data, season, trackId).country, positions, `manual-${Date.now()}`);
    sea.results.find((r) => r.round === round)!.manual = true;
    msg = out.message;
    nextState = out.state;
    apply((d) => Object.assign(d, out.data), nextState);
    toast.success(msg);
    setEntering(null);
  };

  const canEnter = ENTRY_STATES.includes(state);
  const used = new Set(picks.filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="panel border-accent/60 p-4">
        <p className="label-caps text-accent">Calendar debugging mode</p>
        <p className="text-sm text-muted-foreground">
          Remove a wrong result (its prize money is taken back), reorder or remove upcoming races, or click an upcoming
          race to enter its result by hand.
        </p>
      </div>

      <div className="panel divide-y divide-border/60">
        {season.calendar.map((trackId, i) => {
          const round = i + 1;
          const t = seasonTrackInfo(data, season, trackId);
          const res = resultFor(round);
          return (
            <div key={`${i}-${trackId}`} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-8 font-mono text-muted-foreground">R{round}</span>
              <Flag nationality={t.country} />
              <button
                className={`flex-1 text-left ${!res && canEnter ? "hover:text-primary" : ""}`}
                disabled={!!res || !canEnter}
                onClick={() => openEntry(round)}
                title={!res && canEnter ? "Enter this result by hand" : undefined}
              >
                {t.country}
                {t.city && <span className="text-muted-foreground"> · {t.city}</span>}
              </button>
              {res ? (
                <>
                  <span className="label-caps text-success">
                    {res.manual ? "Entered by hand" : "Uploaded"}
                    {res.earned != null && ` · ${money(res.earned)}`}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => removeResult(round)}>
                    <Trash2 className="mr-1 size-3" /> Remove result
                  </Button>
                </>
              ) : (
                <span className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={i === 0 || !!resultFor(i)} onClick={() => move(i, -1)} aria-label="Move earlier">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === season.calendar.length - 1 || !!resultFor(i + 2)}
                    onClick={() => move(i, 1)}
                    aria-label="Move later"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeRound(i)} aria-label="Remove race">
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        >
          <option value="">Add a race at the end…</option>
          {data.db.tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.country}
              {t.city ? ` · ${t.city}` : ""}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!adding}
          onClick={() => {
            editCalendar((cal) => void cal.push(adding));
            setAdding("");
          }}
        >
          <Plus className="mr-1 size-4" /> Add
        </Button>
      </div>
      {!canEnter && (
        <p className="text-xs text-muted-foreground">Results can be entered by hand once the current window is closed.</p>
      )}

      <Dialog open={entering != null} onOpenChange={(o) => !o && setEntering(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="headline text-2xl">Enter result · Round {entering}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {picks.map((id, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 text-right font-mono font-bold">{i + 1}</span>
                <select
                  className="h-8 flex-1 rounded-md border border-border bg-surface-2 px-2 text-sm"
                  value={id}
                  onChange={(e) => setPicks(picks.map((p, k) => (k === i ? e.target.value : p)))}
                >
                  <option value="">—</option>
                  {grid.map((g) => (
                    <option key={g} value={g} disabled={used.has(g) && g !== id}>
                      {label(g)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setPicks([...picks, ""])}>
              <Plus className="mr-1 size-4" /> Add a position (free agents are in the list)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEntering(null)}>
              Cancel
            </Button>
            <Button onClick={saveEntry}>Save result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

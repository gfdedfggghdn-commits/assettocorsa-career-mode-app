import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  currentSeason,
  driverCost,
  driverName,
  money,
  overallRating,
  teamColour,
  teamLabel,
} from "@/lib/career/engine";
import { teamMateOf } from "@/lib/career/season";
import { Flag } from "@/lib/career/flags";
import { PLAYER_TEAM_ID, type CareerData, type CareerState, type Driver } from "@/lib/career/types";
import { toast } from "sonner";

type SortKey = "rating" | "cost" | "team" | "racecraft" | "pace" | "aggressiveness" | "f1Years";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "cost", label: "Cost" },
  { key: "team", label: "Team" },
  { key: "racecraft", label: "Racecraft" },
  { key: "pace", label: "Pace" },
  { key: "aggressiveness", label: "Aggression" },
  { key: "f1Years", label: "F1 years" },
];

export function DriverMarketPanel({
  data,
  state,
  apply,
}: {
  data: CareerData;
  state: CareerState;
  update?: (fn: (d: CareerData) => void) => void;
  apply: (fn: (d: CareerData) => void, nextState: CareerState) => void;
}) {
  const season = currentSeason(data);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sort, setSort] = useState<SortKey>("rating");

  const midWindow = state === "MID_SEASON_CONTRACT_WINDOW";
  const endWindow = state === "END_OF_SEASON_CONTRACT_WINDOW";
  const windowOpen = midWindow || endWindow;
  const mate = teamMateOf(data);

  const teamOf = (d: Driver) => season?.driverTeams[d.id];
  const drivers = [...data.db.drivers].sort((a, b) => {
    switch (sort) {
      case "cost":
        return driverCost(data.db, b) - driverCost(data.db, a);
      case "team": {
        const ta = teamOf(a), tb = teamOf(b);
        if (!ta && tb) return 1;
        if (ta && !tb) return -1;
        return teamLabel(data, ta).localeCompare(teamLabel(data, tb)) || overallRating(b) - overallRating(a);
      }
      case "racecraft":
      case "pace":
      case "aggressiveness":
      case "f1Years":
        return (b[sort] || 0) - (a[sort] || 0);
      default:
        return overallRating(b) - overallRating(a);
    }
  });

  const priceFor = (d: Driver) => (midWindow && d.id === mate ? 0 : driverCost(data.db, d));

  const sign = (d: Driver) => {
    const cost = priceFor(d);
    apply((next) => {
      if (midWindow) {
        const sea = next.seasons[next.seasons.length - 1];
        if (!sea) return;
        for (const [id, team] of Object.entries(sea.driverTeams)) {
          if (team === PLAYER_TEAM_ID && id !== d.id) delete sea.driverTeams[id];
        }
        sea.driverTeams[d.id] = PLAYER_TEAM_ID;
        sea.teamMateId = d.id;
        sea.midSeasonWindowUsed = true;
      }
      next.pendingTeamMateId = d.id;
      next.cash -= cost;
    }, "ACTIVE_SEASON");
    toast.success(cost === 0 ? `${driverName(d)} extended for free.` : `${driverName(d)} signed for ${money(cost)}.`);
    setSelected(null);
    setConfirming(false);
  };

  return (
    <div className="space-y-4">
      {windowOpen && (
        <div className="panel border-primary/60 p-4">
          <p className="label-caps text-primary">Contract window open</p>
          <p className="text-sm text-muted-foreground">
            {midWindow
              ? "Extending your current team mate is free. Signing anyone else costs their full fee."
              : "Pick your team mate for next season. Keeping your current driver still costs the full fee."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <span className="label-caps mr-2">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`label-caps rounded px-2.5 py-1 ${
              sort === s.key ? "bg-primary text-primary-foreground" : "bg-surface-2 hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="label-caps px-3 py-2">Driver</th>
              <th className="label-caps px-3 py-2">Team</th>
              <th className="label-caps px-2 py-2 text-right">RC</th>
              <th className="label-caps px-2 py-2 text-right">PAC</th>
              <th className="label-caps px-2 py-2 text-right">AGR</th>
              <th className="label-caps px-2 py-2 text-right">F1</th>
              <th className="label-caps px-3 py-2 text-right">Contract</th>
              <th className="label-caps px-3 py-2 text-right">Rating</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const teamId = teamOf(d);
              return (
                <tr
                  key={d.id}
                  onClick={() => windowOpen && setSelected(d)}
                  className={`border-t border-border/60 ${windowOpen ? "cursor-pointer hover:bg-surface-2" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <Flag nationality={d.nationality} />
                      {d.firstName} <strong>{d.lastName.toUpperCase()}</strong>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-4 w-1 rounded-sm"
                        style={{ background: teamId ? teamColour(data, teamId) : "var(--muted-foreground)" }}
                        aria-hidden
                      />
                      <span className={teamId ? "" : "text-muted-foreground"}>{teamLabel(data, teamId)}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{d.racecraft}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{d.pace}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{d.aggressiveness}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{d.f1Years || 0}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono">{money(driverCost(data.db, d))}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold">{overallRating(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {drivers.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">The drivers database is empty.</p>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && (setSelected(null), setConfirming(false))}>
        <DialogContent>
          {selected && priceFor(selected) > data.cash ? (
            <>
              <DialogHeader>
                <DialogTitle className="headline text-2xl">Not enough money</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {driverName(selected)} costs {money(priceFor(selected))}. You have {money(data.cash)}.
              </p>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Back
                </Button>
              </DialogFooter>
            </>
          ) : selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="headline text-2xl">
                  {confirming ? "Confirm signing" : "Approach driver"}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {confirming
                  ? `Sign ${driverName(selected)} for ${money(priceFor(selected))}?`
                  : `Approach ${driverName(selected)} about a seat in your team?`}
              </p>
              <DialogFooter>
                <Button variant="secondary" onClick={() => (confirming ? setConfirming(false) : setSelected(null))}>
                  Cancel
                </Button>
                <Button onClick={() => (confirming ? sign(selected) : setConfirming(true))}>Confirm</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

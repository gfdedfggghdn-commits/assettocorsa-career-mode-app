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
import { PLAYER_TEAM_ID, type CareerData, type CareerState, type Driver } from "@/lib/career/types";
import { toast } from "sonner";

export function DriverMarketPanel({
  data,
  state,
  update,
  apply,
}: {
  data: CareerData;
  state: CareerState;
  update: (fn: (d: CareerData) => void) => void;
  apply: (fn: (d: CareerData) => void, nextState: CareerState) => void;
}) {
  const season = currentSeason(data);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [teamPick, setTeamPick] = useState<Driver | null>(null);

  const midWindow = state === "MID_SEASON_CONTRACT_WINDOW";
  const endWindow = state === "END_OF_SEASON_CONTRACT_WINDOW";
  const windowOpen = midWindow || endWindow;

  const mate = teamMateOf(data);
  const drivers = [...data.db.drivers].sort((a, b) => overallRating(b) - overallRating(a));

  const priceFor = (d: Driver) => (midWindow && d.id === mate ? 0 : d.contractCost);

  const sign = (d: Driver) => {
    const cost = priceFor(d);
    if (midWindow) {
      apply((next) => {
        const sea = next.seasons[next.seasons.length - 1];
        if (!sea) return;
        for (const [id, team] of Object.entries(sea.driverTeams)) {
          if (team === PLAYER_TEAM_ID && id !== d.id) delete sea.driverTeams[id];
        }
        sea.driverTeams[d.id] = PLAYER_TEAM_ID;
        sea.teamMateId = d.id;
        sea.midSeasonWindowUsed = true;
        next.pendingTeamMateId = d.id;
        next.cash -= cost;
      }, "ACTIVE_SEASON");
    } else {
      apply((next) => {
        next.pendingTeamMateId = d.id;
        next.cash -= cost;
      }, "ACTIVE_SEASON");
    }
    toast.success(
      cost === 0 ? `${driverName(d)} extended for free.` : `${driverName(d)} signed for ${money(cost)}.`,
    );
    setSelected(null);
    setConfirming(false);
  };

  const setTeam = (d: Driver, teamId: string) => {
    update((next) => {
      const sea = next.seasons[next.seasons.length - 1];
      if (!sea) return;
      if (teamId === "") delete sea.driverTeams[d.id];
      else sea.driverTeams[d.id] = teamId;
    });
    setTeamPick(null);
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

      <div className="panel divide-y divide-border/60">
        {drivers.map((d) => {
          const teamId = season?.driverTeams[d.id];
          const isFree = !teamId;
          const clickable = windowOpen || isFree;
          return (
            <button
              key={d.id}
              disabled={!clickable}
              onClick={() => (windowOpen ? setSelected(d) : setTeamPick(d))}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                clickable ? "hover:bg-surface-2" : "cursor-default"
              }`}
            >
              <span
                className="h-6 w-1.5 rounded-sm"
                style={{ background: isFree ? "#ffffff" : teamColour(data, teamId) }}
                aria-hidden
              />
              <span className="flex-1">
                <span className="headline text-base">
                  {d.firstName} {d.lastName.toUpperCase()}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {teamLabel(data, teamId)}
                </span>
              </span>
              <span className="font-mono text-sm">{overallRating(d)}</span>
              <span className="w-28 text-right font-mono text-sm text-muted-foreground">
                {money(d.contractCost)}
              </span>
            </button>
          );
        })}
        {drivers.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">The drivers database is empty.</p>
        )}
      </div>

      {/* approach / sign flow */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && (setSelected(null), setConfirming(false))}>
        <DialogContent>
          {selected && priceFor(selected) > data.cash ? (
            <>
              <DialogHeader>
                <DialogTitle className="headline text-2xl">Not enough money</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {driverName(selected)} costs {money(selected.contractCost)}. You have{" "}
                {money(data.cash)}.
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
                <Button
                  variant="secondary"
                  onClick={() => (confirming ? setConfirming(false) : setSelected(null))}
                >
                  Cancel
                </Button>
                <Button onClick={() => (confirming ? sign(selected) : setConfirming(true))}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* free agent grid fixer */}
      <Dialog open={!!teamPick} onOpenChange={(o) => !o && setTeamPick(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="headline text-2xl">
              {teamPick ? `Where does ${driverName(teamPick)} drive?` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {data.db.teams.map((t) => (
              <Button
                key={t.id}
                variant="secondary"
                className="w-full justify-start"
                onClick={() => teamPick && setTeam(teamPick, t.id)}
              >
                <span className="mr-2 h-4 w-1.5 rounded-sm" style={{ background: t.colour }} />
                {t.name}
              </Button>
            ))}
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => teamPick && setTeam(teamPick, "")}
            >
              Free agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

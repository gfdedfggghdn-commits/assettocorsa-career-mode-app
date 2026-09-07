import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCareer, useSaveCareer } from "@/lib/career/api";
import {
  constructorPosition,
  constructorStandings,
  currentSeason,
  driverName,
  driverStandings,
  money,
  prizeMoneyFor,
} from "@/lib/career/engine";
import { PLAYER_TEAM_ID, type CareerData } from "@/lib/career/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/careers/$careerId/complete")({
  head: () => ({
    meta: [
      { title: "Season complete — MyTeam Career" },
      { name: "description", content: "Review your finished season, collect payouts and start the next one." },
      { property: "og:title", content: "Season complete — MyTeam Career" },
      {
        property: "og:description",
        content: "Review your finished season, collect payouts and start the next one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompletePage,
});

function CompletePage() {
  const { careerId } = Route.useParams();
  const { data: career, isLoading } = useCareer(careerId);
  const save = useSaveCareer(careerId);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [objectiveMet, setObjectiveMet] = useState(false);

  if (isLoading || !career) {
    return <div className="p-10 text-sm text-muted-foreground">Loading season…</div>;
  }

  const data = career.data;
  const season = currentSeason(data);
  if (!season) {
    return <div className="p-10 text-sm text-muted-foreground">No season to summarise.</div>;
  }

  const drivers = driverStandings(data, season);
  const teams = constructorStandings(data, season);
  const myPos = constructorPosition(data, season);
  const mate = data.db.drivers.find((d) => d.id === season.teamMateId);
  const mateRow = drivers.findIndex((r) => r.id === season.teamMateId);
  const oldSponsor = data.db.majorSponsors.find((s) => s.id === season.majorSponsorId);

  const reward = objectiveMet ? (oldSponsor?.objectiveReward ?? 0) : 0;
  const prize = prizeMoneyFor(data, myPos);
  const newBalance = data.cash + reward + prize;

  const finish = async () => {
    const next: CareerData = structuredClone(data);
    const sea = next.seasons[next.seasons.length - 1];
    if (sea) {
      sea.completed = true;
      sea.majorObjectiveMet = oldSponsor ? objectiveMet : null;
    }
    next.cash = newBalance;
    next.preseasonPhase = 1;
    await save.mutateAsync({
      data: next,
      state: "PRESEASON",
      season: career.season + 1,
    });
    navigate({ to: "/careers/$careerId/preseason", params: { careerId } });
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <p className="label-caps">Season {season.number}</p>
      <h1 className="headline text-4xl">{step === 1 ? "Season summary" : "End of season payout"}</h1>

      {step === 1 ? (
        <div className="mt-8 space-y-6">
          <div className="panel grid gap-6 p-6 sm:grid-cols-3">
            <Stat label="Constructors" value={`P${myPos}`} />
            <Stat
              label="Team points"
              value={`${teams.find((t) => t.id === PLAYER_TEAM_ID)?.total ?? 0}`}
            />
            <Stat label="Races" value={`${season.results.length}/${season.calendar.length}`} />
          </div>

          <div className="panel p-6">
            <p className="label-caps mb-3">Team mate</p>
            {mate ? (
              <p className="headline text-2xl">
                {driverName(mate)} — {mateRow >= 0 ? `P${mateRow + 1}` : "unclassified"} in the
                drivers' championship
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No team mate raced this season.</p>
            )}
          </div>

          <div className="panel p-6">
            <p className="label-caps mb-3">Championship top 5</p>
            <ol className="space-y-1">
              {drivers.slice(0, 5).map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="w-6 font-mono text-muted-foreground">{i + 1}</span>
                  <span className="h-4 w-1 rounded-sm" style={{ background: r.colour }} />
                  <span className="flex-1">{r.label}</span>
                  <span className="font-mono">{r.total}</span>
                </li>
              ))}
            </ol>
          </div>

          <Button onClick={() => setStep(2)}>Continue</Button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="panel divide-y divide-border/60">
            <Line label="Current balance" value={money(data.cash)} />
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="label-caps">Sponsor objective</p>
                <p className="text-sm text-muted-foreground">
                  {oldSponsor
                    ? `${oldSponsor.name}: ${oldSponsor.seasonObjective || "no objective"}`
                    : "No major sponsor this season"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{money(reward)}</span>
                {oldSponsor && (
                  <Switch checked={objectiveMet} onCheckedChange={setObjectiveMet} aria-label="Objective achieved" />
                )}
              </div>
            </div>
            <Line label={`Constructors' prize money (P${myPos})`} value={money(prize)} />
            <Line label="New balance" value={money(newBalance)} strong />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={finish}>Start pre-season {career.season + 1}</Button>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="headline text-3xl">{value}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <p className={strong ? "headline text-xl" : "label-caps"}>{label}</p>
      <p className={strong ? "headline text-2xl" : "font-mono"}>{value}</p>
    </div>
  );
}

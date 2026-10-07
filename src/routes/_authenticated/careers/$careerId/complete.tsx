import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCareer, useSaveCareer } from "@/lib/career/api";
import {
  captureSnapshot,
  constructorPosition,
  currentSeason,
  driverPositionOf,
  majorObjectiveText,
  money,
  prizeMoneyFor,
  teamPointFinishes,
} from "@/lib/career/engine";
import { PLAYER_DRIVER_ID, type CareerData } from "@/lib/career/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StandingsPanel } from "@/components/career/StandingsPanel";
import { CheckCircle2 } from "lucide-react";

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
  const [manualMet, setManualMet] = useState(false);
  const [regPU, setRegPU] = useState(false);
  const [regChassis, setRegChassis] = useState(false);

  if (isLoading || !career) {
    return <div className="p-10 text-sm text-muted-foreground">Loading season…</div>;
  }

  const data = career.data;
  const season = currentSeason(data);
  if (!season) {
    return <div className="p-10 text-sm text-muted-foreground">No season to summarise.</div>;
  }

  const myDriverPos = driverPositionOf(data, season, PLAYER_DRIVER_ID);
  const matePos = driverPositionOf(data, season, season.teamMateId ?? null);
  const myPos = constructorPosition(data, season);
  const sponsor = data.db.majorSponsors.find((s) => s.id === season.majorSponsorId);
  const auto = sponsor?.objectiveType === "POINT_FINISHES";
  const pointFinishes = teamPointFinishes(season);
  const objectiveMet = auto ? pointFinishes >= (sponsor?.objectiveCount ?? 0) : manualMet;
  const reward = objectiveMet ? (sponsor?.objectiveReward ?? 0) : 0;
  const prize = prizeMoneyFor(data, myPos);
  const newBalance = data.cash + reward + prize;

  const alreadyPaid = career.state === "PRESEASON";

  const finish = async () => {
    if (alreadyPaid) {
      navigate({ to: "/careers/$careerId/preseason", params: { careerId } });
      return;
    }
    const next: CareerData = structuredClone(data);
    const sea = next.seasons[next.seasons.length - 1];
    if (sea) {
      captureSnapshot(next, sea);
      sea.completed = true;
      sea.majorObjectiveMet = sponsor ? objectiveMet : null;
    }
    next.cash = newBalance;
    // regulation changes wipe that department's upgrades for everyone
    if (regPU) next.development.powerUnit = 0;
    if (regChassis) next.development.chassis = 0;
    next.lastRaceEarnings = null;
    // +1 F1 year for every driver who raced at least 25% of the season's rounds
    if (sea) {
      const needed = Math.max(1, Math.ceil(sea.calendar.length * 0.25));
      for (const d of next.db.drivers) {
        const raced = sea.results.filter((r) => r.positions[d.id] != null).length;
        if (raced >= needed) d.f1Years = (d.f1Years || 0) + 1;
      }
    }
    // next season's major sponsor and team mate are chosen fresh in pre-season
    next.pendingMajorSponsorId = null;
    next.pendingTeamMateId = null;
    next.preseasonPhase = 1;
    await save.mutateAsync({ data: next, state: "PRESEASON", season: career.season + 1 });
    navigate({ to: "/careers/$careerId/preseason", params: { careerId } });
  };

  const pos = (p: number | null) => (p ? `P${p}` : "Unclassified");

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-5 py-14">
      <p className="label-caps">Season {season.number}</p>
      <h1 className="headline text-4xl">Season summary</h1>

      <Row label="Your driver position" value={pos(myDriverPos)} />
      <Row label="Team mate's driver position" value={season.teamMateId ? pos(matePos) : "No team mate"} />
      <Row label="Your constructor position" value={`P${myPos}`} />
      <Row label="Constructor payout" value={money(prize)} green />

      <div className="panel space-y-3 p-6">
        <p className="label-caps">Major sponsor</p>
        {sponsor ? (
          <>
            <p className="headline text-2xl">{sponsor.name}</p>
            <p className="text-sm text-muted-foreground">{majorObjectiveText(sponsor)}</p>
            {auto ? (
              <p className="text-sm">
                Your team scored {pointFinishes} point finish{pointFinishes === 1 ? "" : "es"}.
                {!objectiveMet && " Goal not reached."}
              </p>
            ) : (
              <label className="flex items-center gap-3 text-sm">
                <Switch disabled={alreadyPaid} checked={manualMet} onCheckedChange={setManualMet} aria-label="Objective achieved" />
                Goal achieved
              </label>
            )}
            {objectiveMet && (
              <div className="flex items-center gap-3 text-success">
                <CheckCircle2 className="size-12" />
                <span className="headline text-3xl">{money(reward)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No major sponsor this season.</p>
        )}
      </div>

      <div className="panel space-y-3 p-6">
        <h2 className="headline text-2xl">Regulation changes</h2>
        <p className="text-xs text-muted-foreground">
          Turning a department on resets every upgrade in it for the whole grid next season.
        </p>
        <label className="flex items-center justify-between text-sm">
          Power unit
          <Switch disabled={alreadyPaid} checked={regPU} onCheckedChange={setRegPU} aria-label="Power unit regulation change" />
        </label>
        <label className="flex items-center justify-between text-sm">
          Chassis
          <Switch disabled={alreadyPaid} checked={regChassis} onCheckedChange={setRegChassis} aria-label="Chassis regulation change" />
        </label>
      </div>

      <Row label="New balance" value={money(newBalance)} />

      <StandingsPanel data={data} />

      <Button onClick={finish} disabled={save.isPending}>
        {alreadyPaid ? "Go to pre-season" : "Collect payouts — go to pre-season"}
      </Button>
    </main>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="panel flex items-center justify-between px-6 py-4">
      <p className="label-caps">{label}</p>
      <p className={`headline text-2xl ${green ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

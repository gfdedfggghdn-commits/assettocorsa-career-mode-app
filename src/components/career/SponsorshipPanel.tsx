import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { competitiveness, currentSeason, isMajorSponsorUnlocked, majorObjectiveText, money } from "@/lib/career/engine";
import { MINOR_SLOT_COSTS } from "@/lib/career/types";
import { Lock } from "lucide-react";
import type { CareerData, CareerState, MajorSponsor, MinorSponsor } from "@/lib/career/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function SponsorshipPanel({
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
  const [slot, setSlot] = useState<number | null>(null);
  const season = currentSeason(data);
  const comp = competitiveness(data);
  const ops = data.development.operations;

  const unlockedMajors = data.db.majorSponsors.filter((s) => isMajorSponsorUnlocked(s, comp, ops));
  const unlockedMinors = data.db.minorSponsors.filter((s) => comp >= s.minCompetitiveness);

  const major = data.db.majorSponsors.find((s) => s.id === season?.majorSponsorId);
  const pending = data.db.majorSponsors.find((s) => s.id === data.pendingMajorSponsorId);
  const sponsorWindow = state === "END_OF_SEASON_SPONSOR_WINDOW";

  const signMajor = (s: MajorSponsor) => {
    apply((d) => {
      d.pendingMajorSponsorId = s.id;
    }, "END_OF_SEASON_CONTRACT_WINDOW");
    toast.success(`${s.name} signed for next season. Now renew your driver line-up.`);
  };

  const slots = data.minorSlots ?? 7;
  const buySlot = (i: number) => {
    const cost = MINOR_SLOT_COSTS[i] ?? 0;
    if (cost > data.cash) {
      toast.error("Not enough money for this sponsor slot.");
      return;
    }
    update((d) => {
      d.minorSlots = i + 1;
      d.cash -= cost;
    });
    toast.success(`Sponsor slot ${i + 1} bought for ${money(cost)}.`);
  };

  const pickMinor = (s: MinorSponsor) => {
    if (slot === null) return;
    update((d) => {
      const sea = d.seasons[d.seasons.length - 1];
      if (sea) sea.minorSponsorIds[slot] = s.id;
    });
    setSlot(null);
  };

  return (
    <div className="space-y-6">
      {sponsorWindow && (
        <div className="panel border-primary/60 p-5">
          <p className="label-caps text-primary">Sponsor window</p>
          <h2 className="headline text-2xl">Choose your major sponsor for next season</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {major ? `${major.name} stays credited with the season just finished.` : ""} The new deal
            runs through the whole of next season.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {unlockedMajors.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sponsor is interested at your current competitiveness ({comp}).
              </p>
            )}
            {unlockedMajors.map((s) => (
              <button
                key={s.id}
                onClick={() => signMajor(s)}
                className="panel p-4 text-left transition-colors hover:border-primary"
              >
                <h3 className="headline text-lg">{s.name}</h3>
                {s.description && (
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                )}
                <dl className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
                  <div>Signing bonus {money(s.signingBonus)}</div>
                  <div>Per race {money(s.weeklyIncome)}</div>
                  <div>
                    Objective: {majorObjectiveText(s)} ({money(s.objectiveReward)})
                  </div>
                </dl>
              </button>
            ))}
          </div>
        </div>
      )}

      <section>
        <p className="label-caps mb-2">Major sponsor</p>
        {major ? (
          <div className="panel p-5">
            <h3 className="headline text-2xl">{major.name}</h3>
            <p className="text-sm text-muted-foreground">{major.description}</p>
            <dl className="mt-3 grid gap-2 font-mono text-xs text-muted-foreground sm:grid-cols-3">
              <div>Per race {money(major.weeklyIncome)}</div>
              <div>Objective {majorObjectiveText(major)}</div>
              <div>Reward {money(major.objectiveReward)}</div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Locked in for the rest of this season.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No major sponsor for this season.</p>
        )}
        {pending && pending.id !== major?.id && (
          <p className="mt-2 text-sm text-accent">Signed for next season: {pending.name}</p>
        )}
      </section>

      <section>
        <p className="label-caps mb-2">Minor sponsors</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => {
            const id = season?.minorSponsorIds[i] ?? null;
            if (i >= slots) {
              const cost = MINOR_SLOT_COSTS[i] ?? 0;
              const next = i === slots;
              return (
                <button
                  key={i}
                  disabled={!next}
                  onClick={() => buySlot(i)}
                  className="panel flex min-h-[7rem] flex-col items-center justify-center gap-1 text-muted-foreground transition-colors enabled:hover:border-primary enabled:hover:text-foreground disabled:opacity-40"
                >
                  <Lock className="size-5" />
                  <span className="label-caps">Buy slot {i + 1}</span>
                  <span className="font-mono text-sm">{money(cost)}</span>
                </button>
              );
            }
            const s = data.db.minorSponsors.find((m) => m.id === id);
            return s ? (
              <div key={i} className="panel p-4">
                <h4 className="headline text-lg">{s.name}</h4>
                <dl className="mt-2 space-y-1 text-xs">
                  <div>
                    <dt className="label-caps">Race income</dt>
                    <dd className="font-mono">{money(s.raceReward)}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Goal type</dt>
                    <dd>{goalText(data, s)}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Goal bonus</dt>
                    <dd className="font-mono text-success">{money(s.goalBonus ?? 0)}</dd>
                  </div>
                </dl>
                <button
                  className="label-caps mt-3 hover:text-foreground"
                  onClick={() =>
                    update((d) => {
                      const sea = d.seasons[d.seasons.length - 1];
                      if (sea) sea.minorSponsorIds[i] = null;
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                key={i}
                onClick={() => setSlot(i)}
                className="panel flex min-h-[7rem] items-center justify-center text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Plus className="size-7" />
              </button>
            );
          })}
        </div>
      </section>

      <Dialog open={slot !== null} onOpenChange={(o) => !o && setSlot(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="headline text-2xl">Available minor sponsors</DialogTitle>
          </DialogHeader>
          <p className="label-caps">Name - race income - goal bonus - goal</p>
          <div className="space-y-2">
            {unlockedMinors.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing unlocked at competitiveness {comp}.
              </p>
            )}
            {unlockedMinors.map((s) => {
              const taken = season?.minorSponsorIds.includes(s.id);
              return (
                <Button
                  key={s.id}
                  variant="secondary"
                  className="h-auto w-full justify-between py-3"
                  disabled={taken}
                  onClick={() => pickMinor(s)}
                >
                  <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left text-sm">
                    <span className="headline text-base">{s.name}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="font-mono">{money(s.raceReward)}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="font-mono text-success">{money(s.goalBonus ?? 0)}</span>
                    <span className="text-muted-foreground">-</span>
                    <span>{goalText(data, s)}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ordinal = (n: number) => {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suf}`;
};

function goalText(data: CareerData, s: MinorSponsor): string {
  switch (s.objectiveType ?? "MANUAL") {
    case "FINISH_POSITION":
      return `Finish ${ordinal(s.objectivePosition ?? 20)} or better`;
    case "AHEAD_OF_TEAM": {
      const t = data.db.teams.find((x) => x.id === s.objectiveTeamId);
      return `Finish ahead of both ${t?.name || "rival team"} drivers`;
    }
    case "TEAM_POINTS":
      return `Achieve ${s.objectivePoints ?? 1} points as a team`;
    case "AHEAD_OF_TEAMMATE":
      return "Finish ahead of your team mate";
    default:
      return "Always pay";
  }
}

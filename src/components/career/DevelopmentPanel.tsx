import { Button } from "@/components/ui/button";
import {
  acBallast,
  acRestrictor,
  competitiveness,
  developmentPercentage,
  money,
  upgradeCost,
} from "@/lib/career/engine";
import { MAX_UPGRADES, type CareerData, type Development } from "@/lib/career/types";
import { toast } from "sonner";

const SECTIONS: {
  key: keyof Development;
  group: "Car" | "Corporate";
  title: string;
  blurb: (d: Development) => string;
}[] = [
  {
    key: "powerUnit",
    group: "Car",
    title: "Power unit",
    blurb: (d) => `Set the Assetto Corsa restrictor to ${acRestrictor(d)}%.`,
  },
  {
    key: "chassis",
    group: "Car",
    title: "Chassis",
    blurb: (d) => `Set the Assetto Corsa ballast to ${acBallast(d)} kg.`,
  },
  {
    key: "operations",
    group: "Corporate",
    title: "Operations",
    blurb: () => "Unlocks better major sponsors regardless of competitiveness.",
  },
  {
    key: "infrastructure",
    group: "Corporate",
    title: "Infrastructure",
    blurb: (d) => `Cuts every other upgrade cost by ${Math.min(75, d.infrastructure * 5)}%.`,
  },
];

export function DevelopmentPanel({
  data,
  update,
}: {
  data: CareerData;
  update: (fn: (d: CareerData) => void) => void;
}) {
  const dev = data.development;
  const buy = (key: keyof Development) => {
    const level = dev[key];
    if (level >= MAX_UPGRADES) return;
    const cost = upgradeCost(level, dev, key);
    if (cost > data.cash) {
      toast.error("Not enough money for this upgrade.");
      return;
    }
    update((d) => {
      d.development[key] += 1;
      d.cash -= cost;
    });
    toast.success(`Upgrade bought for ${money(cost)}.`);
  };

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center gap-8 p-5">
        <Stat label="Competitiveness" value={`${competitiveness(data)}`} />
        <Stat label="Development" value={`${Math.round(developmentPercentage(dev) * 100)}%`} />
        <Stat label="AC restrictor" value={`${acRestrictor(dev)}%`} />
        <Stat label="AC ballast" value={`${acBallast(dev)} kg`} />
      </div>

      {(["Car", "Corporate"] as const).map((group) => (
        <section key={group}>
          <p className="label-caps mb-2">{group}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.filter((s) => s.group === group).map((s) => {
              const level = dev[s.key];
              const maxed = level >= MAX_UPGRADES;
              const cost = upgradeCost(level, dev, s.key);
              return (
                <div key={s.key} className="panel p-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="headline text-xl">{s.title}</h3>
                    <span className="font-mono text-sm text-muted-foreground">
                      {level}/{MAX_UPGRADES}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-[3px]">
                    {Array.from({ length: MAX_UPGRADES }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 flex-1 rounded-sm ${i < level ? "bg-primary" : "bg-surface-2"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{s.blurb(dev)}</p>
                  <Button
                    className="mt-4 w-full"
                    variant={maxed ? "secondary" : "default"}
                    disabled={maxed}
                    onClick={() => buy(s.key)}
                  >
                    {maxed ? "Fully upgraded" : `Upgrade — ${money(cost)}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
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

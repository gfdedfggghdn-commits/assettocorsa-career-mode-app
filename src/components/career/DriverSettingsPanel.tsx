import { EntityEditor, type Field } from "./EntityEditor";
import { SetBar } from "./SetBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uid, driverName } from "@/lib/career/engine";
import { clampChance, clampReputation } from "@/lib/career/driver";
import type { Academy, CareerData, CareerDatabases, ReputationRules, Team } from "@/lib/career/types";

export function driverTeamFields(db: CareerDatabases, realistic: boolean): Field<Team>[] {
  return realistic ? [
    { key: "startingReputation", label: "Starting reputation", type: "number" },
    { key: "objectivePosition", label: "Objective: finish Xth", type: "number" },
    { key: "contractRequirement", label: "Contract requirement", type: "number" },
    { key: "academyId", label: "Academy", type: "select", options: (db.academies ?? []).map(a => ({ value: a.id, label: a.name })) },
  ] : [{ key: "objectivePosition", label: "Objective: finish Xth", type: "number" }];
}

export function DriverSettingsPanel({ data, db, patch }: { data: CareerData; db: CareerDatabases; patch: (fn: (d: CareerDatabases) => void) => void }) {
  const rules = db.reputationRules ?? { beatTeamMate: 25, loseToTeamMate: 15, beatObjective: 100, missObjective: 75 };
  const realistic = data.driverCareer?.contractSystem !== "basic";
  return <div className="space-y-5">
    {realistic && <>
      <EntityEditor<Academy> title="Driver academies" fields={[
        { key: "name", label: "Academy" }, { key: "colour", label: "Colour", type: "color" },
        { key: "reputationDiscount", label: "Reputation discount", type: "number" },
      ]} rows={db.academies ?? []} makeEmpty={() => ({ id: uid(), name: "", colour: data.team.colour, reputationDiscount: 0 })}
        onChange={rows => patch(d => { d.academies = rows.map(a => ({ ...a, reputationDiscount: clampReputation(a.reputationDiscount) })); })}
        extra={<SetBar kind="academies" rows={db.academies ?? []} onLoad={rows => patch(d => { d.academies = rows; })} />} />
      <section className="space-y-3 border-t border-border py-4">
        <h3 className="headline text-xl">Reputation</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["beatTeamMate", "Beat team mate (+)"], ["loseToTeamMate", "Lose to team mate (−)"],
            ["beatObjective", "Meet championship objective (+)"], ["missObjective", "Miss championship objective (−)"],
          ] as [keyof ReputationRules, string][]).map(([key, label]) => <div key={key} className="space-y-1">
            <Label htmlFor={`rep-${key}`}>{label}</Label><Input id={`rep-${key}`} type="number" min={0} max={1000} value={rules[key]}
              onChange={e => patch(d => { d.reputationRules = { ...rules, [key]: clampReputation(Number(e.target.value)) }; })} />
          </div>)}
        </div>
        <Label htmlFor="contract-chance">Contract chance (%)</Label>
        <Input id="contract-chance" type="number" min={5} max={100} value={db.contractChance ?? 50}
          onChange={e => patch(d => { d.contractChance = clampChance(Number(e.target.value)); })} />
      </section>
    </>}
    {data.seasons.length === 0 && <section className="space-y-4 border-t border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="headline text-xl">Season 1 line-up</h3>
        <SetBar kind="season1" rows={db.season1} onLoad={rows => patch(d => { d.season1 = rows; })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{db.teams.filter(t => t.active !== false).map(team => {
        const ids = db.season1.find(e => e.teamId === team.id)?.driverIds ?? [];
        return <div key={team.id} className="space-y-2"><h4 className="headline text-lg">{team.name}</h4>
          {[0, 1].map(slot => <div key={slot}><Label>{slot + 1}{slot === 0 ? "st" : "nd"} driver</Label>
            <select aria-label={`${team.name} driver ${slot + 1}`} className="h-9 w-full rounded-md border border-input bg-surface-2 px-2" value={ids[slot] ?? ""}
              onChange={e => patch(d => {
                const nextIds = [...ids]; nextIds[slot] = e.target.value;
                d.season1 = d.season1.filter(entry => entry.teamId !== team.id).map(entry => ({ ...entry, driverIds: entry.driverIds.filter(id => id !== e.target.value) }));
                d.season1.push({ teamId: team.id, driverIds: nextIds });
              })}>
              <option value="">—</option>{db.drivers.map(driver => <option key={driver.id} value={driver.id} disabled={ids[1 - slot] === driver.id}>{driverName(driver)}</option>)}
            </select></div>)}
        </div>;
      })}</div>
    </section>}
  </div>;
}
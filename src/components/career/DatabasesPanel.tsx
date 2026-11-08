import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntityEditor } from "@/components/career/EntityEditor";
import { ContractCostEditor } from "@/components/career/ContractCostEditor";
import { SetBar } from "@/components/career/SetBar";
import { uid } from "@/lib/career/engine";
import type {
  CareerData,
  CareerDatabases,
  Driver,
  MajorSponsor,
  MinorSponsor,
  PlayerName,
  PowerUnit,
  PrizeMoneyRow,
  Team,
  Track,
} from "@/lib/career/types";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { DriverSettingsPanel, driverTeamFields } from "./DriverSettingsPanel";
import { isDriverCareer, isRealistic, clampReputation } from "@/lib/career/driver";
import { SeasonConfiguration } from "./SeasonConfiguration";

type Props = {
  data: CareerData;
  update: (fn: (d: CareerData) => void) => void;
  seasonNumber?: number;
  onDirtyChange?: (dirty: boolean) => void;
};

type PrizeRow = PrizeMoneyRow & { id: string };

export function DatabasesPanel({ data, update, seasonNumber = data.seasons.at(-1)?.number ?? 1, onDirtyChange }: Props) {
  const [db, setDb] = useState<CareerDatabases>(() => structuredClone(data.db));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) setDb(structuredClone(data.db));
  }, [data.db, dirty]);

  const patch = (fn: (d: CareerDatabases) => void) => {
    const next = structuredClone(db);
    fn(next);
    setDb(next);
    setDirty(true);
  };

  const puOptions = db.powerUnits.map((p) => ({ value: p.id, label: p.name || "Unnamed" }));
  const teamOptions = db.teams.map((t) => ({ value: t.id, label: t.name || "Unnamed" }));

  const prizeRows: PrizeRow[] = db.prizeMoney.map((p) => ({ ...p, id: String(p.position) }));

  return (
    <div className="space-y-5">
      {dirty && <div role="alert" className="sticky top-2 z-20 rounded-md bg-warning p-4 text-sm font-semibold text-warning-foreground">Unsaved database changes. Save changes at the bottom of this page before switching tabs or proceeding.</div>}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="headline text-2xl">Databases</h2>
          <p className="text-xs text-muted-foreground">
            Edit drivers, teams, sponsors and tracks mid-season. Changes only apply once you save.
          </p>
        </div>
        </div>
      <EntityEditor<Driver>
        title="Drivers"
        fields={[
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "nationality", label: "Nationality" },
          { key: "racecraft", label: "Racecraft", type: "number" },
          { key: "pace", label: "Pace", type: "number" },
          { key: "aggressiveness", label: "Aggression", type: "number" },
          { key: "f1Years", label: "F1 years", type: "number" },
        ]}
        rows={db.drivers}
        makeEmpty={() => ({ id: uid(), firstName: "", lastName: "", nationality: "", racecraft: 50, pace: 50, aggressiveness: 50, f1Years: 0 })}
        onChange={rows => patch(d => { d.drivers = rows; })}
        extra={<SetBar kind="drivers" rows={db.drivers} onLoad={rows => patch(d => { d.drivers = rows; })} />}
      />
      <div className="hidden">
        <div className="flex items-center gap-2">
          {dirty && <span className="label-caps text-accent">Unsaved changes</span>}
          <Button
            variant="secondary"
            onClick={() => {
              setDb(structuredClone(data.db));
              setDirty(false);
            }}
            disabled={!dirty}
          >
            Discard
          </Button>
          <Button
            disabled={!dirty}
            onClick={() => {
              update((d) => void (d.db = structuredClone(db)));
              setDirty(false);
              toast.success("Databases saved.");
            }}
          >
            <Save className="mr-1 size-4" /> Save changes
          </Button>
        </div>
      </div>

      <EntityEditor<Driver>
        title="Drivers"
        fields={[
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "nationality", label: "Nationality" },
          { key: "racecraft", label: "Racecraft", type: "number", width: "6rem" },
          { key: "pace", label: "Pace", type: "number", width: "6rem" },
          { key: "aggressiveness", label: "Aggression", type: "number", width: "6rem" },
          { key: "f1Years", label: "F1 years", type: "number", width: "6rem" },
        ]}
        rows={db.drivers}
        makeEmpty={() => ({
          id: uid(),
          firstName: "",
          lastName: "",
          nationality: "",
          racecraft: 50,
          pace: 50,
          aggressiveness: 50,
          f1Years: 0,
        })}
        onChange={(rows) => patch((d) => void (d.drivers = rows))}
        extra={<SetBar kind="drivers" rows={db.drivers} onLoad={(rows) => patch((d) => void (d.drivers = rows))} />}
      />

      <EntityEditor<Team>
        title="Teams"
        fields={[
          { key: "name", label: "Name", width: "14rem" },
          { key: "nationality", label: "Nationality" },
          { key: "powerUnitId", label: "Power unit", type: "select", options: puOptions },
          { key: "colour", label: "Colour", type: "color", width: "5rem" },
          { key: "active", label: "Active", type: "switch", width: "5rem" },
          ...(isDriverCareer(data) ? driverTeamFields(db, isRealistic(data)) : []),
        ]}
        description="Name and colour apply to the current season. Finished seasons keep the name and colour each team had back then, so you can rebrand a team for a new season."
        rows={db.teams.map((t) => ({ ...t, active: t.active ?? true }))}
        makeEmpty={() => ({ id: uid(), name: "", nationality: "", powerUnitId: "", colour: "#888888", active: true })}
        onChange={(rows) => patch((d) => void (d.teams = rows.map(t => ({ ...t, startingReputation: clampReputation(t.startingReputation ?? 0), contractRequirement: clampReputation(t.contractRequirement ?? 0), objectivePosition: Math.max(1, t.objectivePosition ?? 20) }))))}
        extra={<SetBar kind="teams" rows={db.teams} onLoad={(rows) => patch((d) => void (d.teams = rows))} />}
      />

      <EntityEditor<PowerUnit>
        title="Power unit suppliers"
        fields={[
          { key: "name", label: "Supplier", width: "12rem" },
          { key: "colour", label: "Colour", type: "color", width: "5rem" },
          { key: "basePerformance", label: "Performance", type: "number", width: "7rem" },
          { key: "baseDurability", label: "Durability", type: "number", width: "7rem" },
          ...(!isDriverCareer(data) ? [{ key: "cost" as const, label: "Cost", type: "number" as const }] : []),
          { key: "active", label: "Active", type: "switch", width: "5rem" },
        ]}
        rows={db.powerUnits}
        makeEmpty={() => ({
          id: uid(),
          name: "",
          colour: "#cccccc",
          basePerformance: 50,
          baseDurability: 50,
          cost: 1000000,
          active: true,
        })}
        onChange={(rows) => patch((d) => void (d.powerUnits = rows))}
        extra={
          <SetBar kind="powerUnits" rows={db.powerUnits} onLoad={(rows) => patch((d) => void (d.powerUnits = rows))} />
        }
      />

      {!isDriverCareer(data) && <EntityEditor<MajorSponsor>
        title="Major sponsors"
        fields={[
          { key: "name", label: "Name", width: "12rem" },
          { key: "description", label: "Description", width: "16rem" },
          { key: "signingBonus", label: "Signing bonus", type: "number" },
          {
            key: "objectiveType",
            label: "Objective type",
            type: "select",
            width: "14rem",
            options: [
              { value: "MANUAL", label: "Written objective (tick by hand)" },
              { value: "POINT_FINISHES", label: "As a team, achieve X point finishes" },
            ],
          },
          { key: "objectiveCount", label: "X (point finishes)", type: "number", width: "7rem" },
          { key: "seasonObjective", label: "Written objective", width: "14rem" },
          { key: "objectiveReward", label: "Objective reward", type: "number" },
          { key: "weeklyIncome", label: "Race income", type: "number" },
          { key: "minCompetitiveness", label: "Min comp.", type: "number", width: "6rem" },
          { key: "operationsUnlock", label: "Ops unlock", type: "number", width: "6rem" },
        ]}
        rows={db.majorSponsors}
        makeEmpty={() => ({
          id: uid(),
          name: "",
          description: "",
          signingBonus: 1000000,
          seasonObjective: "",
          objectiveReward: 2000000,
          weeklyIncome: 200000,
          minCompetitiveness: 0,
          operationsUnlock: 0,
        })}
        onChange={(rows) => patch((d) => void (d.majorSponsors = rows))}
        extra={
          <SetBar
            kind="majorSponsors"
            rows={db.majorSponsors}
            onLoad={(rows) => patch((d) => void (d.majorSponsors = rows))}
          />
        }
      />

      }
      {!isDriverCareer(data) && <EntityEditor<MinorSponsor>
        title="Minor sponsors"
        description="Pick a goal type and the app checks it after every race, paying the reward only when it is met."
        fields={[
          { key: "name", label: "Name", width: "12rem" },
          { key: "description", label: "Description", width: "14rem" },
          {
            key: "objectiveType",
            label: "Goal type",
            type: "select",
            width: "12rem",
            options: [
              { value: "FINISH_POSITION", label: "Finish Nth or better" },
              { value: "AHEAD_OF_TEAMMATE", label: "Finish ahead of team mate" },
              { value: "AHEAD_OF_TEAM", label: "Finish ahead of a team" },
              { value: "TEAM_POINTS", label: "Achieve X points as a team" },
              { value: "MANUAL", label: "Always pay (manual)" },
            ],
          },
          { key: "objectivePosition", label: "Position", type: "number", width: "6rem" },
          { key: "objectivePoints", label: "Team points (X)", type: "number", width: "7rem" },
          { key: "objectiveTeamId", label: "Rival team", type: "select", width: "12rem", options: teamOptions },
          { key: "raceReward", label: "Race income", type: "number" },
          { key: "goalBonus", label: "Goal bonus", type: "number" },
          { key: "minCompetitiveness", label: "Min comp.", type: "number", width: "6rem" },
          { key: "operationsUnlock", label: "Ops unlock", type: "number", width: "6rem" },
        ]}
        rows={db.minorSponsors}
        makeEmpty={() => ({
          id: uid(),
          name: "",
          description: "",
          raceObjective: "",
          objectiveType: "FINISH_POSITION",
          objectivePosition: 20,
          objectiveTeamId: "",
          raceReward: 50000,
          goalBonus: 30000,
          minCompetitiveness: 0,
          operationsUnlock: 0,
        })}
        onChange={(rows) => patch((d) => void (d.minorSponsors = rows))}
        extra={
          <SetBar
            kind="minorSponsors"
            rows={db.minorSponsors}
            onLoad={(rows) => patch((d) => void (d.minorSponsors = rows))}
          />
        }
      />

      }
      <EntityEditor<Track>
        title="Tracks"
        description="Exact ID matches result files precisely; the approximate ID is a fallback."
        fields={[
          { key: "country", label: "Country" },
          { key: "city", label: "City / region" },
          { key: "acExactId", label: "AC exact ID", width: "14rem", placeholder: "albert-park_acu" },
          { key: "acApproxId", label: "AC approximate ID", placeholder: "albert" },
        ]}
        rows={db.tracks}
        makeEmpty={() => ({ id: uid(), country: "", city: "", acExactId: "", acApproxId: "" })}
        onChange={(rows) => patch((d) => void (d.tracks = rows))}
        extra={<SetBar kind="tracks" rows={db.tracks} onLoad={(rows) => patch((d) => void (d.tracks = rows))} />}
      />

      <EntityEditor<PlayerName>
        title="Your driver names"
        description="Names you race under, so result files can spot you. They never appear in the driver market."
        fields={[
          { key: "name", label: "Name in the game", width: "16rem" },
          { key: "nationality", label: "Nationality", width: "12rem" },
        ]}
        rows={db.playerNames}
        makeEmpty={() => ({ id: uid(), name: "", nationality: "" })}
        onChange={(rows) => patch((d) => void (d.playerNames = rows))}
        extra={
          <SetBar
            kind="playerNames"
            rows={db.playerNames}
            onLoad={(rows) => patch((d) => void (d.playerNames = rows))}
          />
        }
      />

      {isDriverCareer(data) && <DriverSettingsPanel data={data} db={db} patch={patch} />}
      {!isDriverCareer(data) && <><ContractCostEditor
        value={db.contractCostBase}
        onChange={(n) => patch((d) => void (d.contractCostBase = n))}
      />

      <EntityEditor<PrizeRow>
        title="Prize money"
        description="Constructor championship payout per finishing position."
        fields={[
          { key: "position", label: "Position", type: "number", width: "7rem" },
          { key: "amount", label: "Amount", type: "number" },
        ]}
        rows={prizeRows}
        makeEmpty={() => ({ id: uid(), position: prizeRows.length + 1, amount: 1000000 })}
        onChange={(rows) =>
          patch(
            (d) =>
              void (d.prizeMoney = rows
                .map((r) => ({ position: Number(r.position) || 0, amount: Number(r.amount) || 0 }))
                .sort((a, b) => a.position - b.position)),
          )
        }
      />
      </>}
      <SeasonConfiguration db={db} seasonNumber={seasonNumber} patch={patch} />
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <p className="mr-auto text-sm text-muted-foreground">Save all changes here, then proceed.</p>
        <Button variant="secondary" disabled={!dirty} onClick={() => { setDb(structuredClone(data.db)); setDirty(false); }}>Discard</Button>
        <Button disabled={!dirty} onClick={() => { update(d => { d.db = structuredClone(db); }); setDirty(false); toast.success("Databases saved."); }}><Save className="mr-2 size-4" />Save changes</Button>
      </footer>
    </div>
  );
}

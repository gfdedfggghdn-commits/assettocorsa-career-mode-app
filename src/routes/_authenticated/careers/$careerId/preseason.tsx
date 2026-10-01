import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCareer, useSaveCareer } from "@/lib/career/api";
import {
  PLAYER_TEAM_ID,
  type CareerData,
  type Driver,
  type MajorSponsor,
  type MinorSponsor,
  type PowerUnit,
  type PrizeMoneyRow,
  type Season1Entry,
  type SeasonRecord,
  DEFAULT_CONTRACT_BASE,
  F1_YEAR_BONUS,
  type PlayerName,
  type StartingTier,
  type Team,
  type Track,
} from "@/lib/career/types";
import {
  competitiveness,
  CONTRACT_GROWTH,
  driverCost,
  driverName,
  isMajorSponsorUnlocked,
  money,
  overallRating,
  uid,
} from "@/lib/career/engine";
import { EntityEditor, type Field } from "@/components/career/EntityEditor";
import { SetBar } from "@/components/career/SetBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Download, Plus, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/careers/$careerId/preseason")({
  head: () => ({
    meta: [
      { title: "Pre-season — MyTeam Career Mode" },
      { name: "description", content: "Set up your databases, team, sponsors and calendar before the season starts." },
      { property: "og:title", content: "Pre-season — MyTeam Career Mode" },
      {
        property: "og:description",
        content: "Set up your databases, team, sponsors and calendar before the season starts.",
      },
    ],
  }),
  component: Preseason,
});

const PHASES = ["Databases", "Team", "Deals", "Calendar"];

function Preseason() {
  const { careerId } = Route.useParams();
  const { data: career, isLoading } = useCareer(careerId);
  const save = useSaveCareer(careerId);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<CareerData | null>(null);
  const [phase, setPhase] = useState(1);
  const [calendar, setCalendar] = useState<string[]>([]);
  const [windowMode, setWindowMode] = useState<"END" | "MID_AND_END">("END");
  const [pickedPowerUnit, setPickedPowerUnit] = useState<string | null>(null);
  const [offers, setOffers] = useState<string[] | null>(null);

  const isFirstSeason = (career?.season ?? 1) === 1;

  useEffect(() => {
    if (career && !draft) {
      setDraft(structuredClone(career.data));
      setPhase(career.data.preseasonPhase || 1);
      const prev = career.data.seasons[career.data.seasons.length - 1];
      setCalendar(prev?.calendar ?? []);
      setWindowMode(prev?.contractWindowMode ?? "END");
      setPickedPowerUnit(prev?.powerUnitId ?? null);
    }
  }, [career, draft]);

  if (isLoading || !career || !draft) {
    return <div className="p-10 text-sm text-muted-foreground">Loading pre-season…</div>;
  }

  const patch = (fn: (d: CareerData) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const persist = async (extra?: Partial<CareerData>) => {
    await save.mutateAsync({ data: { ...draft, ...extra, preseasonPhase: phase } });
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <button
        className="label-caps mb-4 flex items-center gap-1 hover:text-foreground"
        onClick={() => navigate({ to: "/careers" })}
      >
        <ArrowLeft className="size-3" /> All careers
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Pre-season · Season {career.season}</p>
          <h1 className="headline text-4xl">{career.name}</h1>
        </div>
        <div className="flex gap-1">
          {PHASES.map((p, i) => (
            <button
              key={p}
              onClick={() => setPhase(i + 1)}
              className={`headline rounded-md px-3 py-1.5 text-sm uppercase transition-colors ${
                phase === i + 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {i + 1}. {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {phase === 1 && (
          <PhaseOne draft={draft} patch={patch} isFirstSeason={isFirstSeason} />
        )}
        {phase === 2 && <PhaseTwo draft={draft} patch={patch} isFirstSeason={isFirstSeason} />}
        {phase === 3 && (
          <PhaseThree
            draft={draft}
            patch={patch}
            isFirstSeason={isFirstSeason}
            pickedPowerUnit={pickedPowerUnit}
            setPickedPowerUnit={setPickedPowerUnit}
            offers={offers}
            setOffers={setOffers}
          />
        )}
        {phase === 4 && (
          <PhaseFour
            draft={draft}
            calendar={calendar}
            setCalendar={setCalendar}
            windowMode={windowMode}
            setWindowMode={setWindowMode}
          />
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="secondary" disabled={phase === 1} onClick={() => setPhase(phase - 1)}>
          Back
        </Button>
        {phase < 4 ? (
          <Button
            onClick={async () => {
              const problem =
                phase === 2 && !draft.team.name.trim()
                  ? "Name your team."
                  : phase === 2 && isFirstSeason && !draft.team.startingTierId
                    ? "Pick what your team starts as."
                    : phase === 3 && !pickedPowerUnit
                      ? "Select a power unit supplier."
                      : phase === 3 && isFirstSeason && !draft.pendingMajorSponsorId
                        ? "Select a major sponsor."
                        : phase === 3 && isFirstSeason && !draft.pendingTeamMateId
                          ? "Select a team mate."
                          : null;
              if (problem) {
                toast.error(problem);
                return;
              }
              await persist();
              setPhase(phase + 1);
            }}
          >
            Confirm <ArrowRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button
            onClick={async () => {
              if (calendar.length === 0) {
                toast.error("Add at least one race to the calendar.");
                return;
              }
              const finalData = startSeason(draft, career.season, calendar, windowMode, pickedPowerUnit);
              await save.mutateAsync({
                data: finalData,
                state: "ACTIVE_SEASON",
                season: career.season,
              });
              navigate({ to: "/careers/$careerId/dashboard", params: { careerId } });
            }}
          >
            <Check className="mr-1 size-4" /> Start season {career.season}
          </Button>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function startSeason(
  data: CareerData,
  seasonNumber: number,
  calendar: string[],
  windowMode: "END" | "MID_AND_END",
  powerUnitId: string | null,
): CareerData {
  const next = structuredClone(data);
  const previous = next.seasons[next.seasons.length - 1];

  const driverTeams: Record<string, string> = {};
  if (seasonNumber === 1) {
    for (const entry of next.db.season1) {
      for (const dId of entry.driverIds) driverTeams[dId] = entry.teamId;
    }
    const tier = next.db.startingTiers.find((t) => t.id === next.team.startingTierId);
    next.cash = tier?.startingCash ?? 0;
  } else if (previous) {
    Object.assign(driverTeams, previous.driverTeams);
  }
  if (next.pendingTeamMateId) {
    for (const [id, team] of Object.entries(driverTeams)) {
      if (team === PLAYER_TEAM_ID && id !== next.pendingTeamMateId) delete driverTeams[id];
    }
    driverTeams[next.pendingTeamMateId] = PLAYER_TEAM_ID;
  }

  const sponsor = next.db.majorSponsors.find((s) => s.id === next.pendingMajorSponsorId);
  if (sponsor) next.cash += sponsor.signingBonus;

  if (seasonNumber === 1) {
    const teamMate = next.db.drivers.find((d) => d.id === next.pendingTeamMateId);
    if (teamMate) next.cash -= driverCost(next.db, teamMate);
  }
  const pu = next.db.powerUnits.find((p) => p.id === powerUnitId);
  if (pu) next.cash -= pu.cost;

  const season: SeasonRecord = {
    number: seasonNumber,
    calendar,
    results: [],
    driverTeams,
    majorSponsorId: next.pendingMajorSponsorId,
    minorSponsorIds: Array.from({ length: 7 }, (_, i) => previous?.minorSponsorIds[i] ?? null),
    teamMateId: next.pendingTeamMateId,
    powerUnitId: powerUnitId,
    contractWindowMode: windowMode,
    midSeasonWindowUsed: false,
    completed: false,
    majorObjectiveMet: null,
  };
  next.seasons.push(season);
  next.preseasonPhase = 1;
  return next;
}

/* ------------------------------ phase 1 ------------------------------ */

function PhaseOne({
  draft,
  patch,
  isFirstSeason,
}: {
  draft: CareerData;
  patch: (fn: (d: CareerData) => void) => void;
  isFirstSeason: boolean;
}) {
  const driverFields: Field<Driver>[] = [
    { key: "firstName", label: "Name" },
    { key: "lastName", label: "Surname" },
    { key: "nationality", label: "Nationality" },
    { key: "racecraft", label: "Racecraft", type: "number", width: "6rem" },
    { key: "pace", label: "Pace", type: "number", width: "6rem" },
    { key: "aggressiveness", label: "Aggression", type: "number", width: "6rem" },
    { key: "f1Years", label: "F1 years", type: "number", width: "6rem" },
  ];

  const puOptions = draft.db.powerUnits.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Everything here is stored inside this career only. Use <strong>Sets</strong> to save a list
        and reuse it in another save.
      </p>

      <EntityEditor<Driver>
        title="Drivers"
        description="Overall = (racecraft×3 + pace×2 + aggression×2) / 7, plus active F1 years."
        fields={driverFields}
        rows={draft.db.drivers}
        makeEmpty={() => ({
          id: uid(),
          firstName: "",
          lastName: "",
          nationality: "",
          racecraft: 50,
          pace: 50,
          aggressiveness: 50,
          f1Years: 0,
          contractCost: 1000000,
        })}
        onChange={(rows) => patch((d) => void (d.db.drivers = rows))}
        extra={
          <SetBar
            kind="drivers"
            rows={draft.db.drivers}
            onLoad={(rows) => patch((d) => void (d.db.drivers = rows))}
          />
        }
      />

      <EntityEditor<Team>
        title="Teams"
        fields={[
          { key: "name", label: "Name", width: "14rem" },
          { key: "nationality", label: "Nationality" },
          { key: "powerUnitId", label: "Power unit", type: "select", options: puOptions },
          { key: "colour", label: "Colour", type: "color", width: "5rem" },
        ]}
        rows={draft.db.teams}
        makeEmpty={() => ({ id: uid(), name: "", nationality: "", powerUnitId: "", colour: "#888888" })}
        onChange={(rows) => patch((d) => void (d.db.teams = rows))}
        extra={
          <SetBar
            kind="teams"
            rows={draft.db.teams}
            onLoad={(rows) => patch((d) => void (d.db.teams = rows))}
          />
        }
      />

      <EntityEditor<PowerUnit>
        title="Power unit suppliers"
        fields={[
          { key: "name", label: "Supplier", width: "12rem" },
          { key: "colour", label: "Colour", type: "color", width: "5rem" },
          { key: "basePerformance", label: "Performance", type: "number", width: "7rem" },
          { key: "baseDurability", label: "Durability", type: "number", width: "7rem" },
          { key: "cost", label: "Cost", type: "number" },
          { key: "active", label: "Active", type: "switch", width: "5rem" },
        ]}
        rows={draft.db.powerUnits}
        makeEmpty={() => ({
          id: uid(),
          name: "",
          colour: "#cccccc",
          basePerformance: 50,
          baseDurability: 50,
          cost: 1000000,
          active: true,
        })}
        onChange={(rows) => patch((d) => void (d.db.powerUnits = rows))}
        extra={
          <SetBar
            kind="powerUnits"
            rows={draft.db.powerUnits}
            onLoad={(rows) => patch((d) => void (d.db.powerUnits = rows))}
          />
        }
      />

      <EntityEditor<MajorSponsor>
        title="Major sponsors"
        description="Operations unlock level overrides the minimum competitiveness."
        fields={[
          { key: "name", label: "Name", width: "12rem" },
          { key: "description", label: "Description", width: "16rem" },
          { key: "signingBonus", label: "Signing bonus", type: "number" },
          { key: "seasonObjective", label: "Season objective", width: "14rem" },
          { key: "objectiveReward", label: "Objective reward", type: "number" },
          { key: "weeklyIncome", label: "Weekly income", type: "number" },
          { key: "minCompetitiveness", label: "Min comp.", type: "number", width: "6rem" },
          { key: "operationsUnlock", label: "Ops unlock", type: "number", width: "6rem" },
        ]}
        rows={draft.db.majorSponsors}
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
        onChange={(rows) => patch((d) => void (d.db.majorSponsors = rows))}
        extra={
          <SetBar
            kind="majorSponsors"
            rows={draft.db.majorSponsors}
            onLoad={(rows) => patch((d) => void (d.db.majorSponsors = rows))}
          />
        }
      />

      <EntityEditor<MinorSponsor>
        title="Minor sponsors"
        description="Pick a goal type and the app checks it after every race, paying the reward only when it is met."
        fields={[
          { key: "name", label: "Name", width: "12rem" },
          { key: "description", label: "Description", width: "14rem" },
          { key: "raceObjective", label: "Race objective", width: "12rem" },
          {
            key: "objectiveType",
            label: "Goal type",
            type: "select",
            width: "12rem",
            options: [
              { value: "FINISH_POSITION", label: "Finish Nth or better" },
              { value: "AHEAD_OF_TEAMMATE", label: "Finish ahead of team mate" },
              { value: "AHEAD_OF_TEAM", label: "Finish ahead of a team" },
              { value: "MANUAL", label: "Always pay (manual)" },
            ],
          },
          { key: "objectivePosition", label: "Position", type: "number", width: "6rem" },
          {
            key: "objectiveTeamId",
            label: "Rival team",
            type: "select",
            width: "12rem",
            options: draft.db.teams.map((t) => ({ value: t.id, label: t.name || "Unnamed" })),
          },
          { key: "raceReward", label: "Race income", type: "number" },
          { key: "goalBonus", label: "Goal bonus", type: "number" },
          { key: "minCompetitiveness", label: "Min comp.", type: "number", width: "6rem" },
          { key: "operationsUnlock", label: "Ops unlock", type: "number", width: "6rem" },
        ]}
        rows={draft.db.minorSponsors}
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
        onChange={(rows) => patch((d) => void (d.db.minorSponsors = rows))}
        extra={
          <SetBar
            kind="minorSponsors"
            rows={draft.db.minorSponsors}
            onLoad={(rows) => patch((d) => void (d.db.minorSponsors = rows))}
          />
        }
      />

      <EntityEditor<Track>
        title="Tracks"
        description="Exact ID matches result files precisely; the approximate ID is a fallback (e.g. 'sepang')."
        fields={[
          { key: "country", label: "Country" },
          { key: "city", label: "City / region" },
          { key: "acExactId", label: "AC exact ID", width: "14rem", placeholder: "malaysia_sepangint_acu" },
          { key: "acApproxId", label: "AC approximate ID", placeholder: "sepang" },
        ]}
        rows={draft.db.tracks}
        makeEmpty={() => ({ id: uid(), country: "", city: "", acExactId: "", acApproxId: "" })}
        onChange={(rows) => patch((d) => void (d.db.tracks = rows))}
        extra={
          <SetBar
            kind="tracks"
            rows={draft.db.tracks}
            onLoad={(rows) => patch((d) => void (d.db.tracks = rows))}
          />
        }
      />

      <EntityEditor<StartingTier>
        title="Starting competitiveness"
        fields={[
          { key: "label", label: "Label" },
          { key: "startingCash", label: "Starting cash", type: "number" },
          { key: "startingCompetitiveness", label: "Starting competitiveness", type: "number" },
        ]}
        rows={draft.db.startingTiers}
        makeEmpty={() => ({ id: uid(), label: "", startingCash: 0, startingCompetitiveness: 0 })}
        onChange={(rows) => patch((d) => void (d.db.startingTiers = rows))}
        extra={
          <SetBar
            kind="startingTiers"
            rows={draft.db.startingTiers}
            onLoad={(rows) => patch((d) => void (d.db.startingTiers = rows))}
          />
        }
      />

      <EntityEditor<PrizeMoneyRow & { id: string }>
        title="Prize money"
        description="Constructors' championship finishing position and its payout."
        fields={[
          { key: "position", label: "Position", type: "number", width: "7rem" },
          { key: "amount", label: "Prize money", type: "number" },
        ]}
        rows={draft.db.prizeMoney.map((p) => ({ ...p, id: String(p.position) }))}
        makeEmpty={() => ({ id: uid(), position: draft.db.prizeMoney.length + 1, amount: 0 })}
        onChange={(rows) =>
          patch(
            (d) =>
              void (d.db.prizeMoney = rows.map((r) => ({ position: r.position, amount: r.amount }))),
          )
        }
        extra={
          <SetBar
            kind="prizeMoney"
            rows={draft.db.prizeMoney}
            onLoad={(rows) => patch((d) => void (d.db.prizeMoney = rows as PrizeMoneyRow[]))}
          />
        }
      />

      <EntityEditor<PlayerName>
        title="Your driver names"
        description="Names you race under in Assetto Corsa, so result files can spot you. Add every alias you use."
        fields={[
          { key: "name", label: "Name in the game", width: "16rem" },
          { key: "nationality", label: "Nationality", width: "12rem" },
        ]}
        rows={draft.db.playerNames}
        makeEmpty={() => ({ id: uid(), name: "", nationality: "" })}
        onChange={(rows) => patch((d) => void (d.db.playerNames = rows))}
        extra={
          <SetBar
            kind="playerNames"
            rows={draft.db.playerNames}
            onLoad={(rows) => patch((d) => void (d.db.playerNames = rows))}
          />
        }
      />

      <ContractCostEditor draft={draft} patch={patch} />

      {isFirstSeason && <Season1Editor draft={draft} patch={patch} />}
    </div>
  );
}

export function ContractCostEditor({
  draft,
  patch,
}: {
  draft: CareerData;
  patch: (fn: (d: CareerData) => void) => void;
}) {
  const base = draft.db.contractCostBase || DEFAULT_CONTRACT_BASE;
  const sample = (rating: number) =>
    money(
      Math.round(
        (base * Math.pow(CONTRACT_GROWTH, rating - 80)) / 1000,
      ) * 1000,
    );
  return (
    <div className="panel space-y-4 p-5">
      <div>
        <p className="headline text-xl">Driver contract cost</p>
        <p className="text-sm text-muted-foreground">
          One number sets the whole driver market: what a driver rated 80 costs. Every 10 rating
          points above that multiplies the fee by 1.75, and each season of F1 experience adds{" "}
          {money(F1_YEAR_BONUS)}. Leave it at {money(DEFAULT_CONTRACT_BASE)} for the standard market
          (80 costs {money(DEFAULT_CONTRACT_BASE)}, 90 costs about $10,500,000). Lower it to make
          stars affordable, raise it to make signings painful.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="contract-base">Cost of a driver rated 80</Label>
          <Input
            id="contract-base"
            type="number"
            className="w-56"
            value={base}
            onChange={(e) =>
              patch((d) => void (d.db.contractCostBase = Number(e.target.value) || 0))
            }
          />
        </div>
        <div className="flex gap-6 text-sm">
          {[70, 80, 90, 95].map((r) => (
            <div key={r}>
              <p className="label-caps">Rating {r}</p>
              <p className="font-mono">{sample(r)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Season1Editor({
  draft,
  patch,
}: {
  draft: CareerData;
  patch: (fn: (d: CareerData) => void) => void;
}) {
  const assigned = new Set(draft.db.season1.flatMap((e) => e.driverIds));

  const setEntry = (teamId: string, driverIds: string[]) => {
    patch((d) => {
      const rest = d.db.season1.filter((e) => e.teamId !== teamId);
      d.db.season1 = [...rest, { teamId, driverIds }];
    });
  };

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="headline text-xl">Season 1 line-up</h3>
          <p className="text-xs text-muted-foreground">
            Assign two drivers to every team. You must do this yourself.
          </p>
        </div>
        <SetBar
          kind="season1"
          rows={draft.db.season1}
          onLoad={(rows) => patch((d) => void (d.db.season1 = rows as Season1Entry[]))}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {draft.db.teams.map((team) => {
          const entry = draft.db.season1.find((e) => e.teamId === team.id);
          const ids = entry?.driverIds ?? [];
          return (
            <div key={team.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1.5 rounded" style={{ backgroundColor: team.colour }} />
                <span className="font-semibold">{team.name || "Unnamed team"}</span>
              </div>
              <div className="mt-2 grid gap-2">
                {[0, 1].map((slot) => (
                  <select
                    key={slot}
                    className="h-9 rounded-md border border-input bg-surface-2 px-2 text-sm"
                    value={ids[slot] ?? ""}
                    onChange={(e) => {
                      const next = [...ids];
                      next[slot] = e.target.value;
                      setEntry(team.id, next.filter(Boolean));
                    }}
                  >
                    <option value="">— empty —</option>
                    {draft.db.drivers
                      .filter((d) => !assigned.has(d.id) || ids.includes(d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {driverName(d)}
                        </option>
                      ))}
                  </select>
                ))}
              </div>
            </div>
          );
        })}
        {draft.db.teams.length === 0 && (
          <p className="text-sm text-muted-foreground">Add teams first.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ phase 2 ------------------------------ */

function PhaseTwo({
  draft,
  patch,
  isFirstSeason,
}: {
  draft: CareerData;
  patch: (fn: (d: CareerData) => void) => void;
  isFirstSeason: boolean;
}) {
  return (
    <div className="panel space-y-6 p-6">
      <div className="space-y-2">
        <Label htmlFor="teamname">Team name</Label>
        <Input
          id="teamname"
          value={draft.team.name}
          onChange={(e) => patch((d) => void (d.team.name = e.target.value))}
          placeholder="e.g. Aurora Racing"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="teamdesc">Team backstory</Label>
        <Textarea
          id="teamdesc"
          value={draft.team.description}
          onChange={(e) => patch((d) => void (d.team.description = e.target.value))}
          placeholder="Where does your team come from?"
        />
      </div>

      <div className="space-y-2">
        <Label>Team colour</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-11 w-20 cursor-pointer rounded border border-input bg-transparent"
            value={draft.team.colour}
            onChange={(e) => patch((d) => void (d.team.colour = e.target.value))}
          />
          <Input
            className="w-32 font-mono"
            value={draft.team.colour}
            onChange={(e) => patch((d) => void (d.team.colour = e.target.value))}
          />
          <div
            className="h-11 flex-1 rounded"
            style={{
              background: `linear-gradient(90deg, ${draft.team.colour}, transparent)`,
            }}
          />
        </div>
      </div>

      {isFirstSeason && (
        <div className="space-y-2">
          <Label>Your team starts as</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {draft.db.startingTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => patch((d) => void (d.team.startingTierId = tier.id))}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  draft.team.startingTierId === tier.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-2 hover:border-muted-foreground"
                }`}
              >
                <div className="headline text-lg">{tier.label}</div>
                <div className="text-sm text-muted-foreground">{money(tier.startingCash)}</div>
                <div className="text-xs text-muted-foreground">
                  Competitiveness {tier.startingCompetitiveness}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ phase 3 ------------------------------ */

function PhaseThree({
  draft,
  patch,
  isFirstSeason,
  pickedPowerUnit,
  setPickedPowerUnit,
  offers,
  setOffers,
}: {
  draft: CareerData;
  patch: (fn: (d: CareerData) => void) => void;
  isFirstSeason: boolean;
  pickedPowerUnit: string | null;
  setPickedPowerUnit: (v: string) => void;
  offers: string[] | null;
  setOffers: (v: string[]) => void;
}) {
  const comp = competitiveness(draft);
  const [tab, setTab] = useState<"sponsor" | "pu" | "mate">(isFirstSeason ? "sponsor" : "pu");

  const unlocked = useMemo(
    () =>
      draft.db.majorSponsors.filter((s) =>
        isMajorSponsorUnlocked(s, comp, draft.development.operations),
      ),
    [draft.db.majorSponsors, comp, draft.development.operations],
  );

  useEffect(() => {
    if (offers === null && isFirstSeason) {
      const pool = unlocked.slice();
      const picked: string[] = [];
      while (picked.length < 8 && pool.length) {
        const [taken] = pool.splice(Math.floor(Math.random() * pool.length), 1);
        if (taken) picked.push(taken.id);
      }
      setOffers(picked);
    }
  }, [offers, unlocked, isFirstSeason, setOffers]);

  const assigned = new Set(draft.db.season1.flatMap((e) => e.driverIds));
  const freeAgents = draft.db.drivers
    .filter((d) => !assigned.has(d.id))
    .sort((a, b) => overallRating(b) - overallRating(a));

  const sponsor = draft.db.majorSponsors.find((s) => s.id === draft.pendingMajorSponsorId);
  const teamMate = draft.db.drivers.find((d) => d.id === draft.pendingTeamMateId);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <BigButton
          active={tab === "sponsor"}
          disabled={!isFirstSeason}
          onClick={() => setTab("sponsor")}
          title="Major sponsor"
          value={sponsor?.name ?? "Not selected"}
          locked={!isFirstSeason}
        />
        <BigButton
          active={tab === "pu"}
          onClick={() => setTab("pu")}
          title="Power unit"
          value={draft.db.powerUnits.find((p) => p.id === pickedPowerUnit)?.name ?? "Not selected"}
        />
        <BigButton
          active={tab === "mate"}
          disabled={!isFirstSeason}
          onClick={() => setTab("mate")}
          title="Team mate"
          value={teamMate ? driverName(teamMate) : "Not selected"}
          locked={!isFirstSeason}
        />
      </div>

      {tab === "sponsor" && (
        <div className="panel p-4">
          <h3 className="headline text-xl">Sponsor offers</h3>
          <p className="text-xs text-muted-foreground">
            Eight offers drawn from the sponsors your competitiveness of {comp} unlocks.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(offers ?? []).map((id) => {
              const s = draft.db.majorSponsors.find((x) => x.id === id)!;
              if (!s) return null;
              return (
                <button
                  key={id}
                  onClick={() => patch((d) => void (d.pendingMajorSponsorId = id))}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    draft.pendingMajorSponsorId === id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2 hover:border-muted-foreground"
                  }`}
                >
                  <div className="headline text-lg">{s.name}</div>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  )}
                  <dl className="mt-2 space-y-0.5 text-sm">
                    <Row k="Signing bonus" v={money(s.signingBonus)} />
                    <Row k="Weekly income" v={money(s.weeklyIncome)} />
                    <Row k="Objective" v={s.seasonObjective || "—"} />
                    <Row k="Objective reward" v={money(s.objectiveReward)} />
                  </dl>
                </button>
              );
            })}
            {(offers ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No sponsors are available at your competitiveness. Add sponsors with a lower minimum
                in phase 1.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "pu" && (
        <div className="panel p-4">
          <h3 className="headline text-xl">Power unit suppliers</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {draft.db.powerUnits
              .filter((p) => p.active)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPickedPowerUnit(p.id)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    pickedPowerUnit === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface-2 hover:border-muted-foreground"
                  }`}
                >
                  <span className="h-10 w-1.5 rounded" style={{ backgroundColor: p.colour }} />
                  <div className="flex-1">
                    <div className="headline text-lg">{p.name}</div>
                    <dl className="text-sm">
                      <Row k="Performance" v={String(p.basePerformance)} />
                      <Row k="Durability" v={String(p.baseDurability)} />
                      <Row k="Cost" v={money(p.cost)} />
                    </dl>
                  </div>
                </button>
              ))}
            {draft.db.powerUnits.filter((p) => p.active).length === 0 && (
              <p className="text-sm text-muted-foreground">No active suppliers in your database.</p>
            )}
          </div>
        </div>
      )}

      {tab === "mate" && (
        <div className="panel p-4">
          <h3 className="headline text-xl">Team mate</h3>
          <p className="text-xs text-muted-foreground">
            Every free agent, sorted by overall rating. You drive as number one.
          </p>
          <div className="mt-4 space-y-1.5">
            {freeAgents.map((d) => (
              <button
                key={d.id}
                onClick={() => patch((x) => void (x.pendingTeamMateId = d.id))}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                  draft.pendingTeamMateId === d.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-2 hover:border-muted-foreground"
                }`}
              >
                <span className="h-6 w-1.5 rounded bg-white" />
                <span className="flex-1 font-medium">{driverName(d)}</span>
                <span className="text-xs text-muted-foreground">Free Agent</span>
                <span className="font-mono text-sm">{overallRating(d)}</span>
                <span className="w-28 text-right font-mono text-sm">
                  {money(driverCost(draft.db, d))}
                </span>
              </button>
            ))}
            {freeAgents.length === 0 && (
              <p className="text-sm text-muted-foreground">No free agents available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BigButton({
  title,
  value,
  active,
  onClick,
  disabled,
  locked,
}: {
  title: string;
  value: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-5 text-left transition-colors ${
        active ? "border-primary bg-primary/10" : "border-border bg-surface-2"
      } ${disabled ? "cursor-not-allowed opacity-70" : "hover:border-muted-foreground"}`}
    >
      <div className="label-caps">{title}</div>
      <div className="headline mt-1 text-2xl">{value}</div>
      {locked && <div className="mt-1 text-xs text-muted-foreground">Already under contract</div>}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

/* ------------------------------ phase 4 ------------------------------ */

function PhaseFour({
  draft,
  calendar,
  setCalendar,
  windowMode,
  setWindowMode,
}: {
  draft: CareerData;
  calendar: string[];
  setCalendar: (v: string[]) => void;
  windowMode: "END" | "MID_AND_END";
  setWindowMode: (v: "END" | "MID_AND_END") => void;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <div className="label-caps">Contract renewal window</div>
        <div className="mt-3 inline-flex rounded-md border border-border bg-surface-2 p-1">
          {(
            [
              ["END", "End of season only"],
              ["MID_AND_END", "Mid-season and end of season"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setWindowMode(value)}
              className={`headline rounded px-4 py-1.5 text-sm uppercase transition-colors ${
                windowMode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {windowMode === "MID_AND_END" && calendar.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Mid-season window opens after round {Math.ceil(calendar.length / 2)}.
          </p>
        )}
      </div>

      <div className="panel p-5">
        <div className="label-caps">Calendar</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {calendar.map((trackId, i) => {
            const t = draft.db.tracks.find((x) => x.id === trackId);
            return (
              <div key={`${trackId}-${i}`} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
                  <span className="label-caps">R{i + 1}</span>
                  <span className="text-sm">
                    {t ? `${t.country}${t.city ? ` · ${t.city}` : ""}` : "Unknown track"}
                  </span>
                  <button
                    onClick={() => setCalendar(calendar.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="relative">
            <Button size="icon" variant="secondary" onClick={() => setOpenAt(openAt === null ? calendar.length : null)}>
              <Plus className="size-4" />
            </Button>
            {openAt !== null && (
              <div className="absolute top-11 left-0 z-20 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                {draft.db.tracks.map((t) => (
                  <button
                    key={t.id}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setCalendar([...calendar, t.id]);
                      setOpenAt(null);
                    }}
                  >
                    {t.country} {t.city && <span className="text-muted-foreground">· {t.city}</span>}
                  </button>
                ))}
                {draft.db.tracks.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">Add tracks in phase 1 first.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

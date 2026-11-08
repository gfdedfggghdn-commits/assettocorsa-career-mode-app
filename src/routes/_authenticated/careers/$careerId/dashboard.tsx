import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useCareer, useSaveCareer } from "@/lib/career/api";
import { competitiveness, currentSeason, midSeasonRound, money } from "@/lib/career/engine";
import { blockedReason, processResultFile } from "@/lib/career/season";
import type { CareerData, CareerState } from "@/lib/career/types";
import { DevelopmentPanel } from "@/components/career/DevelopmentPanel";
import { SponsorshipPanel } from "@/components/career/SponsorshipPanel";
import { StandingsPanel } from "@/components/career/StandingsPanel";
import { DriverMarketPanel } from "@/components/career/DriverMarketPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarCog, Palette } from "lucide-react";
import { TeamDetailsPanel } from "@/components/career/TeamDetailsPanel";
import { CalendarDebugPanel } from "@/components/career/CalendarDebugPanel";
import { ArrowLeft, Database, Flag, LineChart, Upload, Users, Wrench } from "lucide-react";
import { DatabasesPanel } from "@/components/career/DatabasesPanel";
import { SeasonOverviewPanel } from "@/components/career/SeasonOverviewPanel";
import { HeadToHeadPanel } from "@/components/career/HeadToHeadPanel";
import { ContractOffersPanel } from "@/components/career/ContractOffersPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clampReputation, isDriverCareer, isRealistic } from "@/lib/career/driver";
import { seasonTeamInfo } from "@/lib/career/engine";

export const Route = createFileRoute("/_authenticated/careers/$careerId/dashboard")({
  head: () => ({
    meta: [
      { title: "Season dashboard — MyTeam Career" },
      { name: "description", content: "Run your season: development, sponsors, standings and race results." },
      { property: "og:title", content: "Season dashboard — MyTeam Career" },
      {
        property: "og:description",
        content: "Run your season: development, sponsors, standings and race results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

type Tab = "development" | "sponsorship" | "standings" | "market" | "team" | "calendar" | "databases" | "h2h";

const TABS: { key: Tab; label: string; icon: typeof Wrench }[] = [
  { key: "development", label: "Development", icon: Wrench },
  { key: "sponsorship", label: "Sponsorship", icon: LineChart },
  { key: "standings", label: "Standings", icon: Flag },
  { key: "market", label: "Driver market", icon: Users },
  { key: "team", label: "Team details", icon: Palette },
  { key: "calendar", label: "Calendar debug", icon: CalendarCog },
  { key: "databases", label: "Databases", icon: Database },
];

function DashboardPage() {
  const { careerId } = Route.useParams();
  const { data: career, isLoading } = useCareer(careerId);
  const save = useSaveCareer(careerId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("development");
  const [databaseDirty, setDatabaseDirty] = useState(false);
  const [debugReputation, setDebugReputation] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (isLoading || !career) {
    return <div className="p-10 text-sm text-muted-foreground">Loading career…</div>;
  }

  const data = career.data;
  const state = career.state;
  const season = currentSeason(data);
  const driverMode = isDriverCareer(data);
  const realistic = isRealistic(data);
  const employer = season ? seasonTeamInfo(data, season, season.playerTeamId) : { name: career.name, colour: data.team.colour };
  const tabs = driverMode ? [
    { key: "development" as const, label: "Season overview", icon: Wrench },
    { key: "standings" as const, label: "Standings", icon: Flag },
    { key: "h2h" as const, label: "Head to head", icon: Users },
    ...(realistic ? [{ key: "market" as const, label: "Contract offers", icon: Users }] : []),
    { key: "calendar" as const, label: "Calendar debug", icon: CalendarCog },
    { key: "databases" as const, label: "Databases", icon: Database },
  ] : TABS;

  const update = (fn: (d: CareerData) => void) => {
    const next = structuredClone(data);
    fn(next);
    return save.mutateAsync({ data: next });
  };

  const apply = (fn: (d: CareerData) => void, nextState: CareerState) => {
    const next = structuredClone(data);
    fn(next);
    if (nextState === "PRESEASON") {
      next.preseasonPhase = 1;
      next.lastRaceEarnings = null;
      void save
        .mutateAsync({ data: next, state: nextState, season: career.season + 1 })
        .then(() => navigate({ to: "/careers/$careerId/preseason", params: { careerId } }));
      return;
    }
    void save.mutateAsync({ data: next, state: nextState }).then(() => {
      if (nextState === "SEASON_COMPLETE") navigate({ to: "/careers/$careerId/complete", params: { careerId } });
    });
  };

  const onFile = async (file: File) => {
    try {
      const raw = await file.text();
      const outcome = processResultFile(data, state, raw, file.name);
      await save.mutateAsync({ data: outcome.data, state: outcome.state });
      toast.success(outcome.message);
      if (outcome.state === "MID_SEASON_CONTRACT_WINDOW") setTab("market");
      if (outcome.data.seasons.at(-1)?.rivalSelectionRequired) setTab("h2h");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  if (state === "SEASON_COMPLETE") {
    void navigate({ to: "/careers/$careerId/complete", params: { careerId } });
    return null;
  }
  if (state === "PRESEASON") {
    void navigate({ to: "/careers/$careerId/preseason", params: { careerId } });
    return null;
  }

  const blocked = blockedReason(state, data);
  const seasonDone = !!season && season.calendar.length > 0 && season.results.length >= season.calendar.length;
  const readyForSummary = seasonDone && state === "ACTIVE_SEASON";
  const needsSponsor = state === "END_OF_SEASON_SPONSOR_WINDOW";
  const needsDriver = state === "MID_SEASON_CONTRACT_WINDOW" || state === "END_OF_SEASON_CONTRACT_WINDOW";

  const rounds = season?.calendar.length ?? 0;
  const done = season?.results.length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {databaseDirty && <div role="alert" className="sticky top-2 z-30 mb-4 rounded-md bg-warning p-4 font-semibold text-warning-foreground">Unsaved databases. Use Save changes at the bottom of the Databases tab before leaving.</div>}
      <button
        className="label-caps mb-4 flex items-center gap-1 hover:text-foreground"
        onClick={() => navigate({ to: "/careers" })}
      >
        <ArrowLeft className="size-3" /> All careers
      </button>

      <header
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg px-6 py-5"
        style={{
          background: `linear-gradient(90deg, ${driverMode ? employer.colour : data.team.colour || "#e10600"} 0%, transparent 85%)`,
          color: driverMode ? undefined : data.team.secondaryColour || undefined,
        }}
      >
        <div>
          <p className="label-caps">
            Season {career.season} · Round {Math.min(done + 1, Math.max(rounds, 1))} of {rounds} ·
            {!driverMode && <>Competitiveness {competitiveness(data)}</>}
          </p>
          <h1 className="headline text-4xl" style={{ color: data.team.secondaryColour || undefined }}>
            {driverMode ? employer.name : data.team.name || career.name}
          </h1>
        </div>
        {(!driverMode || realistic) && <div className="text-right">
          <p className="label-caps">{driverMode ? "Reputation" : "Budget"}</p>
          <p className="headline text-3xl">
            {driverMode ? data.driverCareer?.reputation ?? 0 : money(data.cash)}
            {driverMode && done > 0 && data.driverCareer?.lastReputationChange != null && <span className={`ml-2 align-middle font-mono text-sm ${data.driverCareer.lastReputationChange < 0 ? "text-destructive" : "text-success"}`}>{data.driverCareer.lastReputationChange >= 0 ? "+" : ""}{data.driverCareer.lastReputationChange}</span>}
            {!driverMode && done > 0 && !seasonDone && data.lastRaceEarnings != null && (
              <span className="ml-2 align-middle font-mono text-sm text-success">
                +{money(data.lastRaceEarnings)}
              </span>
            )}
          </p>
        </div>}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav className="space-y-1">
          {tabs.map((t) => {
            const attention =
              (t.key === "sponsorship" && needsSponsor) || (t.key === "market" && needsDriver) || (t.key === "h2h" && !!season?.rivalSelectionRequired);
            return (
              <button
                key={t.key}
                disabled={databaseDirty && t.key !== "databases"}
                onClick={() => setTab(t.key)}
                className={`headline flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base uppercase transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : attention
                      ? "bg-accent/20 text-accent"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
                {attention && <span className="ml-auto size-2 rounded-full bg-accent" />}
              </button>
            );
          })}

          <div className="panel mt-4 space-y-3 p-4">
            <p className="label-caps">Race result</p>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
            <Button
              className="w-full"
              disabled={!!blocked}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="mr-1 size-4" /> Upload result.json
            </Button>
            {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
            {!blocked && season?.contractWindowMode === "MID_AND_END" && !season.midSeasonWindowUsed && (
              <p className="text-xs text-muted-foreground">
                Mid-season contract window opens after round {midSeasonRound(rounds)}.
              </p>
            )}
            {readyForSummary && (
              <Button
                variant="default"
                className="w-full"
                onClick={async () => {
                  await save.mutateAsync({ state: "SEASON_COMPLETE" });
                  navigate({ to: "/careers/$careerId/complete", params: { careerId } });
                }}
              >
                Advance to post-season screen
              </Button>
            )}
          </div>
        </nav>

        <section className="min-w-0">
          {tab === "development" && (driverMode ? <SeasonOverviewPanel data={data} /> : <DevelopmentPanel data={data} update={update} />)}
          {tab === "h2h" && driverMode && <HeadToHeadPanel data={data} update={update} />}
          {tab === "sponsorship" && (
            <SponsorshipPanel data={data} state={state} update={update} apply={apply} />
          )}
          {tab === "standings" && <StandingsPanel data={data} update={update} />}
          {tab === "market" && (
            driverMode ? realistic && <ContractOffersPanel data={data} update={update} /> : <DriverMarketPanel data={data} state={state} update={update} apply={apply} />
          )}
          {tab === "team" && <TeamDetailsPanel data={data} update={update} />}
          {tab === "calendar" && <><CalendarDebugPanel data={data} state={state} apply={apply} />{realistic && <div className="mt-6 space-y-3 border-t border-border pt-5"><h3 className="headline text-xl">Reputation debug</h3><Label htmlFor="debug-reputation">Set reputation (0–1000)</Label><div className="flex gap-3"><Input id="debug-reputation" type="number" min={0} max={1000} value={debugReputation} placeholder={String(data.driverCareer?.reputation ?? 0)} onChange={e => setDebugReputation(e.target.value)} /><Button disabled={debugReputation === "" || save.isPending} onClick={async () => { await update(d => { if (d.driverCareer) { d.driverCareer.reputation = clampReputation(Number(debugReputation)); d.driverCareer.lastReputationChange = null; } }); toast.success("Reputation updated."); }}>Set reputation</Button></div></div>}</>}
          {tab === "databases" && <DatabasesPanel data={data} update={update} seasonNumber={career.season} onDirtyChange={setDatabaseDirty} />}
        </section>
      </div>
    </main>
  );
}

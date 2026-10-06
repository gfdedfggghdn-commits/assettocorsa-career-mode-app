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

type Tab = "development" | "sponsorship" | "standings" | "market" | "team" | "calendar" | "databases";

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
  const fileInput = useRef<HTMLInputElement>(null);

  if (isLoading || !career) {
    return <div className="p-10 text-sm text-muted-foreground">Loading career…</div>;
  }

  const data = career.data;
  const state = career.state;
  const season = currentSeason(data);

  const update = (fn: (d: CareerData) => void) => {
    const next = structuredClone(data);
    fn(next);
    void save.mutateAsync({ data: next });
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
      <button
        className="label-caps mb-4 flex items-center gap-1 hover:text-foreground"
        onClick={() => navigate({ to: "/careers" })}
      >
        <ArrowLeft className="size-3" /> All careers
      </button>

      <header
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg px-6 py-5"
        style={{
          background: `linear-gradient(90deg, ${data.team.colour || "#e10600"} 0%, transparent 85%)`,
        }}
      >
        <div>
          <p className="label-caps">
            Season {career.season} · Round {Math.min(done + 1, Math.max(rounds, 1))} of {rounds} ·
            Competitiveness {competitiveness(data)}
          </p>
          <h1 className="headline text-4xl" style={{ color: data.team.secondaryColour || undefined }}>
            {data.team.name || career.name}
          </h1>
        </div>
        <div className="text-right">
          <p className="label-caps">Budget</p>
          <p className="headline text-3xl">
            {money(data.cash)}
            {done > 0 && data.lastRaceEarnings != null && (
              <span className="ml-2 align-middle font-mono text-sm text-success">
                +{money(data.lastRaceEarnings)}
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav className="space-y-1">
          {TABS.map((t) => {
            const attention =
              (t.key === "sponsorship" && needsSponsor) || (t.key === "market" && needsDriver);
            return (
              <button
                key={t.key}
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

        <section>
          {tab === "development" && <DevelopmentPanel data={data} update={update} />}
          {tab === "sponsorship" && (
            <SponsorshipPanel data={data} state={state} update={update} apply={apply} />
          )}
          {tab === "standings" && <StandingsPanel data={data} update={update} />}
          {tab === "market" && (
            <DriverMarketPanel data={data} state={state} update={update} apply={apply} />
          )}
          {tab === "team" && <TeamDetailsPanel data={data} update={update} />}
          {tab === "calendar" && <CalendarDebugPanel data={data} state={state} apply={apply} />}
          {tab === "databases" && <DatabasesPanel data={data} update={update} />}
        </section>
      </div>
    </main>
  );
}

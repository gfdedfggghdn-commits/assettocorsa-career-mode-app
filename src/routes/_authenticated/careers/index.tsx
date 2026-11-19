import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCareers, useCreateCareer, useDeleteCareer } from "@/lib/career/api";
import { Button } from "@/components/ui/button";
import { seasonTeamInfo } from "@/lib/career/engine";
import type { CareerData } from "@/lib/career/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/careers/")({
  head: () => ({
    meta: [
      { title: "Your careers — MyTeam Career Mode" },
      { name: "description", content: "Pick a career save to continue, or start a brand new team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Your careers — MyTeam Career Mode" },
      {
        property: "og:description",
        content: "Pick a career save to continue, or start a brand new team.",
      },
    ],
  }),
  component: CareersPage,
});

const STATE_LABEL: Record<string, string> = {
  PRESEASON: "Pre-season",
  ACTIVE_SEASON: "Season running",
  MID_SEASON_CONTRACT_WINDOW: "Mid-season contract window",
  END_OF_SEASON_SPONSOR_WINDOW: "Sponsor window",
  END_OF_SEASON_CONTRACT_WINDOW: "Contract window",
  SEASON_COMPLETE: "Season complete",
};

function CareersPage() {
  const { data: careers, isLoading } = useCareers();
  const create = useCreateCareer();
  const remove = useDeleteCareer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"myteam" | "driver">("myteam");
  const [contractSystem, setContractSystem] = useState<"realistic" | "basic">("realistic");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function startNew() {
    const id = await create.mutateAsync({ name: mode === "driver" ? "Driver Career" : "MyTeam", mode, contractSystem });
    navigate({ to: "/careers/$careerId/preseason", params: { careerId: id } });
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps">MyTeam & Driver Career</p>
          <h1 className="headline text-4xl">Career saves</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Career mode">
          {(["myteam", "driver"] as const).map(value => <Button key={value} variant={mode === value ? "default" : "secondary"} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "myteam" ? "MyTeam" : "Driver Career"}</Button>)}
        </div>
        {mode === "driver" && <div className="space-y-2"><p className="label-caps">Contract offer system</p><div className="flex gap-2">
          {(["realistic", "basic"] as const).map(value => <Button key={value} variant={contractSystem === value ? "default" : "secondary"} aria-pressed={contractSystem === value} onClick={() => setContractSystem(value)}>{value === "realistic" ? "Realistic" : "Basic"}</Button>)}
        </div></div>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={startNew} disabled={create.isPending}>
          <Plus className="mr-2 size-4" /> Start career
        </Button>
      </div>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {careers?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No careers yet. Pick a mode above and start your first pre-season.
          </p>
        )}
        {careers?.map((c) => (
          <div key={c.id} className="panel flex items-center gap-4 p-4">
            <span
              className="h-10 w-1.5 rounded-full"
              style={{ backgroundColor: careerTeam(c.data, c.name).colour }}
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/careers/$careerId"
                params={{ careerId: c.id }}
                className="headline block truncate text-xl hover:text-primary"
              >
                {careerTeam(c.data, c.name).name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {c.data.mode === "driver" ? "Driver Career" : "MyTeam"} · Season {c.season} ·{" "}
                {STATE_LABEL[c.state] ?? c.state}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Delete "${careerTeam(c.data, c.name).name}"? This cannot be undone.`)) remove.mutate(c.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}

/** The card title and stripe: the team you run (MyTeam) or drive for (Driver Career). */
function careerTeam(data: CareerData, fallback: string): { name: string; colour: string } {
  if (data.mode === "driver") {
    const season = data.seasons?.at(-1);
    if (season?.playerTeamId) {
      const t = seasonTeamInfo(data, season, season.playerTeamId);
      return { name: t.name, colour: t.colour === "transparent" ? "#e10600" : t.colour };
    }
    const team = data.db?.teams?.find((t) => t.id === data.driverCareer?.teamId);
    return team ? { name: team.name, colour: team.colour } : { name: "No team yet", colour: "#6b7280" };
  }
  return { name: data.team?.name || fallback || "New team", colour: data.team?.colour || "#e10600" };
}

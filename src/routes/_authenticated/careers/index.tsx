import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCareers, useCreateCareer, useDeleteCareer } from "@/lib/career/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/careers/")({
  head: () => ({
    meta: [
      { title: "Your careers — MyTeam Career Mode" },
      { name: "description", content: "Pick a career save to continue, or start a brand new team." },
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
  const [name, setName] = useState("");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function startNew() {
    if (!name.trim()) {
      toast.error("Give your career a name first.");
      return;
    }
    const id = await create.mutateAsync(name.trim());
    navigate({ to: "/careers/$careerId/preseason", params: { careerId: id } });
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps">MyTeam</p>
          <h1 className="headline text-4xl">Career saves</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>

      <div className="panel mt-8 flex flex-col gap-3 p-4 sm:flex-row">
        <Input
          placeholder="New career name (e.g. F1 2013 MyTeam)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startNew()}
        />
        <Button onClick={startNew} disabled={create.isPending}>
          <Plus className="mr-2 size-4" /> Start career
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {careers?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No careers yet. Name one above and start your first pre-season.
          </p>
        )}
        {careers?.map((c) => (
          <div key={c.id} className="panel flex items-center gap-4 p-4">
            <span
              className="h-10 w-1.5 rounded-full"
              style={{ backgroundColor: c.data.team.colour || "#e10600" }}
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/careers/$careerId"
                params={{ careerId: c.id }}
                className="headline block truncate text-xl hover:text-primary"
              >
                {c.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {c.data.team.name || "Team not named yet"} · Season {c.season} ·{" "}
                {STATE_LABEL[c.state] ?? c.state}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Delete "${c.name}"? This cannot be undone.`)) remove.mutate(c.id);
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

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CareerData } from "@/lib/career/types";
import { toast } from "sonner";

export function TeamDetailsPanel({
  data,
  update,
}: {
  data: CareerData;
  update: (fn: (d: CareerData) => void) => void;
}) {
  const [team, setTeam] = useState(data.team);
  useEffect(() => setTeam(data.team), [data.team]);
  const dirty =
    team.name !== data.team.name || team.colour !== data.team.colour || team.description !== data.team.description;

  return (
    <div className="panel space-y-4 p-5">
      <p className="label-caps">Team details</p>
      <label className="block space-y-1">
        <span className="label-caps">Team name</span>
        <Input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} />
      </label>
      <label className="block space-y-1">
        <span className="label-caps">Team colour</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={team.colour || "#e10600"}
            onChange={(e) => setTeam({ ...team, colour: e.target.value })}
            className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent"
          />
          <Input className="w-32 font-mono" value={team.colour} onChange={(e) => setTeam({ ...team, colour: e.target.value })} />
        </div>
      </label>
      <label className="block space-y-1">
        <span className="label-caps">Backstory</span>
        <Textarea rows={6} value={team.description} onChange={(e) => setTeam({ ...team, description: e.target.value })} />
      </label>
      <div className="flex gap-2">
        <Button
          disabled={!dirty || !team.name.trim()}
          onClick={() => {
            update((d) => {
              d.team.name = team.name.trim();
              d.team.colour = team.colour;
              d.team.description = team.description;
            });
            toast.success("Team details saved.");
          }}
        >
          Save
        </Button>
        <Button variant="secondary" disabled={!dirty} onClick={() => setTeam(data.team)}>
          Discard
        </Button>
      </div>
    </div>
  );
}

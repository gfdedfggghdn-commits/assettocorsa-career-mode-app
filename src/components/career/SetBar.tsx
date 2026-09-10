import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDeleteSet, useSaveSet, useSets } from "@/lib/career/api";
import type { SetKind } from "@/lib/career/types";
import { Library, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props<T> = {
  kind: SetKind;
  rows: T[];
  onLoad: (rows: T[]) => void;
  /** append instead of replace; defaults to onLoad([...rows, ...added]) */
  onAdd?: (rows: T[]) => void;
};

export function SetBar<T>({ kind, rows, onLoad }: Props<T>) {
  const { data: sets } = useSets(kind);
  const save = useSaveSet();
  const remove = useDeleteSet();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Library className="mr-1 size-4" /> Sets
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reusable sets</DialogTitle>
          <DialogDescription>
            Save this list under a name and load it into any other career later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input placeholder="Set name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            onClick={async () => {
              if (!name.trim()) {
                toast.error("Name the set first.");
                return;
              }
              await save.mutateAsync({ kind, name: name.trim(), data: rows as unknown[] });
              setName("");
              toast.success("Set saved.");
            }}
          >
            Save current
          </Button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {sets?.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved sets for this database yet.</p>
          )}
          {sets?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <span className="flex-1 truncate text-sm">
                {s.name}{" "}
                <span className="text-muted-foreground">({(s.data as unknown[]).length})</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onLoad(s.data as T[]);
                  setOpen(false);
                  toast.success(`Loaded "${s.name}".`);
                }}
              >
                Load
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

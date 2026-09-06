import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

export type FieldType = "text" | "number" | "switch" | "color" | "select";

export type Field<T> = {
  key: keyof T & string;
  label: string;
  type?: FieldType;
  width?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

type Props<T extends { id: string }> = {
  title: string;
  description?: string;
  fields: Field<T>[];
  rows: T[];
  makeEmpty: () => T;
  onChange: (rows: T[]) => void;
  readOnly?: boolean;
  extra?: React.ReactNode;
};

export function EntityEditor<T extends { id: string }>({
  title,
  description,
  fields,
  rows,
  makeEmpty,
  onChange,
  readOnly,
  extra,
}: Props<T>) {
  const update = (index: number, key: string, value: unknown) => {
    const next = rows.slice();
    next[index] = { ...(next[index] as T), [key]: value } as T;
    onChange(next);
  };

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="headline text-xl">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {!readOnly && (
            <Button size="sm" variant="secondary" onClick={() => onChange([...rows, makeEmpty()])}>
              <Plus className="mr-1 size-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key} className="label-caps px-2 pb-2 text-left whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-t border-border/60">
                  {fields.map((f) => (
                    <td key={f.key} className="px-1 py-1.5" style={{ minWidth: f.width ?? "8rem" }}>
                      {f.type === "switch" ? (
                        <Switch
                          checked={Boolean(row[f.key])}
                          disabled={readOnly}
                          onCheckedChange={(v) => update(i, f.key, v)}
                        />
                      ) : f.type === "color" ? (
                        <input
                          type="color"
                          disabled={readOnly}
                          className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                          value={String(row[f.key] ?? "#888888")}
                          onChange={(e) => update(i, f.key, e.target.value)}
                        />
                      ) : f.type === "select" ? (
                        <select
                          disabled={readOnly}
                          className="h-9 w-full rounded-md border border-input bg-surface-2 px-2 text-sm"
                          value={String(row[f.key] ?? "")}
                          onChange={(e) => update(i, f.key, e.target.value)}
                        >
                          <option value="">—</option>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          disabled={readOnly}
                          className="h-9"
                          placeholder={f.placeholder}
                          type={f.type === "number" ? "number" : "text"}
                          value={String(row[f.key] ?? "")}
                          onChange={(e) =>
                            update(
                              i,
                              f.key,
                              f.type === "number" ? Number(e.target.value || 0) : e.target.value,
                            )
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-1">
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onChange(rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Nothing in here yet.</p>
      )}
    </section>
  );
}

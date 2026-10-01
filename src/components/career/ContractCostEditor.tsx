import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTRACT_GROWTH, money } from "@/lib/career/engine";
import { DEFAULT_CONTRACT_BASE, F1_YEAR_BONUS } from "@/lib/career/types";

export function ContractCostEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const base = value || DEFAULT_CONTRACT_BASE;
  const sample = (rating: number) =>
    money(Math.round((base * Math.pow(CONTRACT_GROWTH, rating - 80)) / 1000) * 1000);
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
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
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

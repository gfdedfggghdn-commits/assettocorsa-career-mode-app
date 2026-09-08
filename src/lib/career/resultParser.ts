import type { Driver, Track } from "./types";

export type ParsedResult = {
  trackRaw: string;
  /** finishing order, best first */
  order: { name: string; car?: string }[];
  sourceKey: string;
};

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function pickTrack(json: Record<string, unknown>): string {
  const keys = ["TrackName", "trackName", "track", "Track", "track_name"];
  for (const k of keys) {
    const v = json[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const nested = json["session"] ?? json["Session"];
  if (nested && typeof nested === "object") return pickTrack(nested as Record<string, unknown>);
  return "";
}

function pickResults(json: Record<string, unknown>): Record<string, unknown>[] {
  const keys = ["Result", "result", "Results", "results", "Cars", "cars"];
  for (const k of keys) {
    const v = json[k];
    if (Array.isArray(v) && v.length) return v as Record<string, unknown>[];
  }
  const sessions = (json["sessions"] ?? json["Sessions"]) as unknown;
  if (Array.isArray(sessions)) {
    for (const s of sessions.slice().reverse()) {
      const r = pickResults(s as Record<string, unknown>);
      if (r.length) return r;
    }
  }
  return [];
}

function entryName(entry: Record<string, unknown>): string {
  const direct = ["DriverName", "driverName", "Name", "name"];
  for (const k of direct) {
    const v = entry[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const driver = entry["Driver"] ?? entry["driver"];
  if (driver && typeof driver === "object") {
    const dn = (driver as Record<string, unknown>)["Name"] ?? (driver as Record<string, unknown>)["name"];
    if (typeof dn === "string") return dn.trim();
  }
  return "";
}

function entryTime(entry: Record<string, unknown>): number {
  const keys = ["TotalTime", "totalTime", "time", "Time"];
  for (const k of keys) {
    const v = entry[k];
    if (typeof v === "number" && v > 0) return v;
  }
  return 0;
}

/** Assetto Corsa "results" export: players[] + sessions[].raceResult (car indices, best first). */
function parseAcRaceResult(
  json: Record<string, unknown>,
  trackRaw: string,
  fileName: string,
): ParsedResult | null {
  const players = json["players"];
  if (!Array.isArray(players) || players.length === 0) return null;

  const names = players.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const n = o["name"] ?? o["Name"] ?? o["driverName"];
    const car = o["car"] ?? o["Car"] ?? o["model"];
    return { name: typeof n === "string" ? n.trim() : "", car: typeof car === "string" ? car : undefined };
  });

  const sessions = json["sessions"] ?? json["Sessions"];
  if (!Array.isArray(sessions)) return null;

  let order: number[] | null = null;
  for (const s of sessions.slice().reverse()) {
    const o = (s ?? {}) as Record<string, unknown>;
    const rr = o["raceResult"] ?? o["RaceResult"];
    if (Array.isArray(rr) && rr.length) {
      order = rr.filter((v): v is number => typeof v === "number");
      break;
    }
  }
  if (!order || !order.length) return null;

  const entries = order
    .map((carIndex) => names[carIndex])
    .filter((e): e is { name: string; car?: string } => !!e && !!e.name);
  if (!entries.length) return null;

  return {
    trackRaw,
    order: entries,
    sourceKey: `${fileName}|${trackRaw}|${entries.map((e) => e.name).join(",")}`,
  };
}

export function parseResultFile(raw: string, fileName: string): ParsedResult {
  const json = JSON.parse(raw) as Record<string, unknown>;
  const trackRaw = pickTrack(json);

  const ac = parseAcRaceResult(json, trackRaw, fileName);
  if (ac) return ac;

  const entries = pickResults(json).filter((e) => entryName(e));
  if (!entries.length) throw new Error("No driver results found in this file.");

  const hasTimes = entries.some((e) => entryTime(e) > 0);
  const ordered = hasTimes
    ? entries
        .slice()
        .sort((a, b) => (entryTime(a) || Number.MAX_SAFE_INTEGER) - (entryTime(b) || Number.MAX_SAFE_INTEGER))
    : entries;

  return {
    trackRaw,
    order: ordered.map((e) => ({ name: entryName(e) })),
    sourceKey: `${fileName}|${trackRaw}|${ordered.map(entryName).join(",")}`,
  };
}

export function matchTrack(trackRaw: string, tracks: Track[]): Track | null {
  const t = normalise(trackRaw);
  if (!t) return null;
  const exact = tracks.find((x) => x.acExactId && normalise(x.acExactId) === t);
  if (exact) return exact;
  const approx = tracks.find(
    (x) => x.acApproxId && (t.includes(normalise(x.acApproxId)) || normalise(x.acApproxId).includes(t)),
  );
  if (approx) return approx;
  return tracks.find((x) => x.city && t.includes(normalise(x.city))) ?? null;
}

export function matchDriver(name: string, drivers: Driver[]): Driver | null {
  const n = normalise(name);
  if (!n) return null;
  const full = drivers.find((d) => normalise(`${d.firstName}${d.lastName}`) === n);
  if (full) return full;
  const contains = drivers.find(
    (d) => n.includes(normalise(d.lastName)) && normalise(d.lastName).length > 2,
  );
  if (contains) return contains;
  return drivers.find((d) => normalise(d.lastName) === n) ?? null;
}

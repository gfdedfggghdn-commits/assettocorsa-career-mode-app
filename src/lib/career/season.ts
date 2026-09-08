import { currentSeason, evaluateMinorSponsors, midSeasonRound, raceIncome } from "./engine";
import { matchDriver, matchTrack, parseResultFile } from "./resultParser";
import { PLAYER_TEAM_ID, type CareerData, type CareerState, type RaceResult } from "./types";

export type UploadOutcome = {
  data: CareerData;
  state: CareerState;
  message: string;
  round: number;
};

export function blockedReason(state: CareerState, data: CareerData): string | null {
  if (state === "MID_SEASON_CONTRACT_WINDOW")
    return "The mid-season contract window is open. Sign a driver in the driver market before uploading another race.";
  if (state === "END_OF_SEASON_SPONSOR_WINDOW")
    return "You must sign a major sponsor for next season before anything else.";
  if (state === "END_OF_SEASON_CONTRACT_WINDOW")
    return "You cannot upload a new race file before you have signed a driver contract.";
  if (state === "SEASON_COMPLETE") return "This season is finished. Continue to the season summary.";
  if (state === "PRESEASON") return "Finish the pre-season phases first.";
  const season = currentSeason(data);
  if (season && season.results.length >= season.calendar.length && season.calendar.length > 0)
    return "Every round of this season has been raced. Continue to the season summary.";
  return null;
}

export function processResultFile(
  data: CareerData,
  state: CareerState,
  raw: string,
  fileName: string,
): UploadOutcome {
  const blocked = blockedReason(state, data);
  if (blocked) throw new Error(blocked);

  const next = structuredClone(data);
  const season = currentSeason(next);
  if (!season) throw new Error("No season is running.");

  const parsed = parseResultFile(raw, fileName);
  const track = matchTrack(parsed.trackRaw, next.db.tracks);
  if (!track)
    throw new Error(
      `Could not recognise the track "${parsed.trackRaw || "unknown"}". Add its Assetto Corsa ID to the tracks database.`,
    );

  const rounds = season.calendar
    .map((trackId, i) => ({ trackId, round: i + 1 }))
    .filter((r) => r.trackId === track.id);
  if (rounds.length === 0) throw new Error(`${track.country} is not on this season's calendar.`);

  const alreadyDone = season.results.map((r) => r.round);
  const target = rounds.find((r) => !alreadyDone.includes(r.round));
  if (!target) throw new Error(`Round ${rounds[0]!.round} (${track.country}) already has a result.`);

  if (season.results.some((r) => r.sourceKey === parsed.sourceKey))
    throw new Error("This result file has already been processed.");

  const positions: Record<string, number> = {};
  let position = 0;
  const unmatched: string[] = [];
  for (const entry of parsed.order) {
    const driver = matchDriver(entry.name, next.db.drivers);
    if (!driver) {
      unmatched.push(entry.name);
      continue;
    }
    if (positions[driver.id] != null) continue;
    position += 1;
    positions[driver.id] = position;
  }
  if (position === 0) throw new Error("None of the drivers in this file match your drivers database.");

  const result: RaceResult = {
    round: target.round,
    trackId: track.id,
    positions,
    uploadedAt: new Date().toISOString(),
    sourceKey: parsed.sourceKey,
  };
  season.results.push(result);
  season.results.sort((a, b) => a.round - b.round);

  const outcomes = evaluateMinorSponsors(next, season, positions);
  next.cash += raceIncome(next, season, positions);
  const metCount = outcomes.filter((o) => o.met).length;

  const isFinal = season.results.length >= season.calendar.length;
  const midRound = midSeasonRound(season.calendar.length);

  let nextState: CareerState = "ACTIVE_SEASON";
  let message = `Round ${target.round} — ${track.country} saved.`;

  if (isFinal) {
    season.completed = true;
    nextState = "END_OF_SEASON_SPONSOR_WINDOW";
    message = `Final round saved. Standings are locked in — choose your major sponsor for next season.`;
  } else if (
    season.contractWindowMode === "MID_AND_END" &&
    !season.midSeasonWindowUsed &&
    target.round >= midRound
  ) {
    nextState = "MID_SEASON_CONTRACT_WINDOW";
    message = `Round ${target.round} saved. The mid-season contract window is now open.`;
  }

  if (outcomes.length) message += ` ${metCount}/${outcomes.length} sponsor goals met.`;
  if (unmatched.length) message += ` ${unmatched.length} unknown driver(s) skipped.`;

  return { data: next, state: nextState, message, round: target.round };
}

/** Current team mate id for the season in progress. */
export function teamMateOf(data: CareerData): string | null {
  const season = currentSeason(data);
  if (!season) return null;
  const fromMap = Object.entries(season.driverTeams).find(([, t]) => t === PLAYER_TEAM_ID);
  return season.teamMateId ?? fromMap?.[0] ?? null;
}

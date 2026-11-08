import { describe, expect, test } from "vitest";
import { applyTeamStates, POINTS_PRESETS, selectedPointsSystem } from "./configuration";
import { advanceDriverRace, h2h, startDriverSeason } from "./driver";
import { captureSnapshot, constructorStandings, driverStandings, pointsFor, seasonTeamInfo, teamPointFinishes } from "./engine";
import { applyRaceResult } from "./season";
import { emptyCareerData, PLAYER_DRIVER_ID } from "./types";

function fixture() {
  const data = emptyCareerData();
  data.mode = "driver";
  data.driverCareer = { contractSystem: "realistic", reputation: 500, lastReputationChange: null, teamId: "team", role: 2, academyId: null, academyLocked: false };
  data.db.teams = [{ id: "team", name: "Renault", colour: "yellow", nationality: "France", powerUnitId: "", finishingExpectation: 10, startingReputation: 500 }];
  data.db.season1 = [{ teamId: "team", driverIds: ["mate", "seat"] }];
  const season = startDriverSeason(data, 1, ["track", "track", "track", "track"], "team");
  return { data, season };
}

describe("Season customization", () => {
  test("modern F1 awards 25 for first and 1 for tenth", () => { expect(POINTS_PRESETS[0]?.points[0]).toBe(25); expect(POINTS_PRESETS[0]?.points[9]).toBe(1); });
  test("pre-2010 F1 awards 10 for first and no points for ninth", () => { const { data, season } = fixture(); data.db.selectedPointsSystemId = "pre-2010-f1"; season.pointsSystem = selectedPointsSystem(data.db); expect(pointsFor(1, season)).toBe(10); expect(pointsFor(9, season)).toBe(0); });
  test("IndyCar finish points award 50 for first and 5 for 25th", () => { expect(POINTS_PRESETS[2]?.points[0]).toBe(50); expect(POINTS_PRESETS[2]?.points[24]).toBe(5); });
  test("custom points feed drivers, constructors and H2H without changing past seasons", () => {
    const { data, season } = fixture();
    data.db.pointsSystems = [{ id: "custom", name: "Custom", points: [100, 40] }]; data.db.selectedPointsSystemId = "custom";
    const next = startDriverSeason(data, 2, ["track", "track"], "team");
    applyRaceResult(data, next, 1, "track", "France", { [PLAYER_DRIVER_ID]: 1, mate: 2 }, "new");
    expect(driverStandings(data, next).find(r => r.id === PLAYER_DRIVER_ID)?.total).toBe(100);
    expect(constructorStandings(data, next).find(r => r.id === "team")?.total).toBe(140);
    expect(h2h(next, "mate").points).toEqual([100, 40]);
    const custom = data.db.pointsSystems[0]; if (custom) custom.points[0] = 1;
    expect(pointsFor(1, next)).toBe(100); expect(pointsFor(1, season)).toBe(25);
  });
  test("legacy seasons keep modern F1 even when database scoring changes", () => { const { data, season } = fixture(); delete season.pointsSystem; data.db.selectedPointsSystemId = "indycar"; expect(pointsFor(1, season)).toBe(25); });
  test("team states retain stable team id and old name and colour", () => {
    const { data, season } = fixture(); const team = data.db.teams[0]; if (!team) throw new Error("Missing fixture");
    team.states = [{ id: "renault", name: "Renault F1 Team", colour: "darkyellow" }, { id: "lotus", name: "Lotus", colour: "gold" }, { id: "sport", name: "Renault Sport", colour: "brightyellow" }]; team.seasonStates = { "1": "renault", "2": "lotus", "3": "sport" };
    applyTeamStates(data.db, 1); captureSnapshot(data, season); season.completed = true;
    const next = startDriverSeason(data, 2, ["track"], "team");
    expect(next.playerTeamId).toBe("team"); expect(seasonTeamInfo(data, next, "team")).toEqual({ name: "Lotus", colour: "gold" });
    expect(seasonTeamInfo(data, season, "team")).toEqual({ name: "Renault F1 Team", colour: "darkyellow" });
    applyTeamStates(data.db, 3); expect(data.db.teams[0]?.name).toBe("Renault Sport");
  });
  test("point finishes follow custom points rather than a fixed top ten", () => { const { season } = fixture(); season.pointsSystem = { id: "short", name: "Top two", points: [5, 2] }; season.results.push({ round: 1, trackId: "track", positions: { [PLAYER_DRIVER_ID]: 3, mate: 2 }, teams: { [PLAYER_DRIVER_ID]: "PLAYER", mate: "PLAYER" }, uploadedAt: "", sourceKey: "1" }); expect(teamPointFinishes(season)).toBe(1); });
});

describe("Expanded reputation", () => {
  test("beating expectation gives the main reward in addition to teammate reward", () => { const { data, season } = fixture(); applyRaceResult(data, season, 1, "track", "France", { [PLAYER_DRIVER_ID]: 9, mate: 11 }, "1"); expect(data.driverCareer?.reputation).toBe(575); });
  test("missing expectation and losing to teammate reduce reputation", () => { const { data, season } = fixture(); applyRaceResult(data, season, 1, "track", "France", { [PLAYER_DRIVER_ID]: 12, mate: 11 }, "1"); expect(data.driverCareer?.reputation).toBe(455); });
  test("beating the prior average adds the small bonus", () => { const { data, season } = fixture(); season.results.push({ round: 1, trackId: "track", positions: { [PLAYER_DRIVER_ID]: 12 }, uploadedAt: "", sourceKey: "1" }); applyRaceResult(data, season, 2, "track", "France", { [PLAYER_DRIVER_ID]: 10 }, "2"); expect(data.driverCareer?.reputation).toBe(505); });
  test("beating and losing to the selected rival affect reputation", () => { const { data, season } = fixture(); season.rivalId = "rival"; season.rivalStartRound = 1; applyRaceResult(data, season, 1, "track", "France", { [PLAYER_DRIVER_ID]: 10, rival: 11 }, "1"); expect(data.driverCareer?.reputation).toBe(515); applyRaceResult(data, season, 2, "track", "France", { [PLAYER_DRIVER_ID]: 10, rival: 9 }, "2"); expect(data.driverCareer?.reputation).toBe(505); });
  test("basic contracts never earn reputation bonuses", () => { const { data, season } = fixture(); if (data.driverCareer) data.driverCareer.contractSystem = "basic"; season.rivalId = "rival"; advanceDriverRace(data, season, { [PLAYER_DRIVER_ID]: 1, mate: 2, rival: 3 }); expect(data.driverCareer?.reputation).toBe(500); });
});
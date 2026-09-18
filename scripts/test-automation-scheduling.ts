import assert from "node:assert/strict";
import { automationScheduleState, localDateKey } from "../lib/timezone";
import { automationConfigHash } from "../lib/automations/governance";

function main() {
  const martiniqueMonday10 = new Date("2026-09-21T14:00:00.000Z");
  const defaultWindow = automationScheduleState(martiniqueMonday10, "America/Martinique");
  assert.equal(defaultWindow.eligible, true);
  assert.equal(defaultWindow.hour, 10);
  assert.equal(defaultWindow.weekday, "Mon");

  const beforeStart = automationScheduleState(
    new Date("2026-09-21T13:00:00.000Z"),
    "America/Martinique"
  );
  assert.equal(beforeStart.eligible, false);
  assert.equal(beforeStart.reason, "before_start");

  const sunday = automationScheduleState(
    new Date("2026-09-20T14:00:00.000Z"),
    "America/Martinique"
  );
  assert.equal(sunday.eligible, false);
  assert.equal(sunday.reason, "day_not_selected");

  const customSunday = automationScheduleState(
    new Date("2026-09-20T16:00:00.000Z"),
    "America/Martinique",
    { startHour: 11, endHour: 16, days: "Sun" }
  );
  assert.equal(customSunday.eligible, true);
  assert.equal(customSunday.hour, 12);

  const outsideCustomWindow = automationScheduleState(
    new Date("2026-09-20T20:00:00.000Z"),
    "America/Martinique",
    { startHour: 11, endHour: 16, days: "Sun" }
  );
  assert.equal(outsideCustomWindow.eligible, false);
  assert.equal(outsideCustomWindow.reason, "after_window");

  const invalidTimezone = automationScheduleState(new Date(), "Mars/Olympus");
  assert.equal(invalidTimezone.eligible, false);
  assert.equal(invalidTimezone.reason, "timezone_missing");

  assert.equal(
    localDateKey(new Date("2026-09-22T02:00:00.000Z"), "America/Martinique"),
    "2026-09-21"
  );

  const baseConfig = {
    templateId: "relance-prospects",
    messageSubject: "Bonjour {{name}}",
    messageBody: "Message",
    approvalMode: "first_then_auto",
    cadenceDays: 7,
    maxSendsPerContact: 3,
    scheduleStartHour: 10,
    scheduleEndHour: 18,
    scheduleDays: "Mon,Tue,Wed,Thu,Fri,Sat",
    replyToEmail: "contact@example.com",
  };
  const baseHash = automationConfigHash(baseConfig);
  assert.notEqual(
    baseHash,
    automationConfigHash({ ...baseConfig, scheduleStartHour: 11 }),
    "Changer l'heure doit invalider l'approbation précédente."
  );
  assert.notEqual(
    baseHash,
    automationConfigHash({ ...baseConfig, scheduleDays: "Mon,Tue,Wed,Thu,Fri" }),
    "Changer les jours doit invalider l'approbation précédente."
  );

  console.log("Automation scheduling tests: OK");
}

main();

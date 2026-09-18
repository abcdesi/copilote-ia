export const AUTOMATION_LOCAL_START_HOUR = 6;
export const AUTOMATION_LOCAL_END_HOUR = 18;
export const MAX_SCHEDULED_RETRIES_PER_LOCAL_DAY = 3;

const ALLOWED_WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

export function isValidTimeZone(value?: string | null) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value?: string | null) {
  const timezone = value?.trim();
  return timezone && isValidTimeZone(timezone) ? timezone : null;
}

export function zonedScheduleParts(date: Date, timeZone: string) {
  if (!isValidTimeZone(timeZone)) throw new Error("Fuseau horaire IANA invalide.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const weekday = read("weekday");
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));

  return {
    dateKey: `${year}-${month}-${day}`,
    weekday,
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function automationScheduleState(date: Date, timeZone?: string | null) {
  const normalized = normalizeTimeZone(timeZone);
  if (!normalized) {
    return {
      eligible: false,
      reason: "timezone_missing" as const,
      timeZone: null,
      dateKey: null,
      weekday: null,
      hour: null,
      minute: null,
    };
  }

  const local = zonedScheduleParts(date, normalized);
  if (!ALLOWED_WEEKDAYS.has(local.weekday)) {
    return { eligible: false, reason: "sunday" as const, timeZone: normalized, ...local };
  }

  const startsAt = AUTOMATION_LOCAL_START_HOUR * 60;
  const endsAt = AUTOMATION_LOCAL_END_HOUR * 60;
  if (local.minutesSinceMidnight < startsAt) {
    return { eligible: false, reason: "before_start" as const, timeZone: normalized, ...local };
  }
  if (local.minutesSinceMidnight >= endsAt) {
    return { eligible: false, reason: "after_window" as const, timeZone: normalized, ...local };
  }

  return { eligible: true, reason: "eligible" as const, timeZone: normalized, ...local };
}

export function localDateKey(date: Date, timeZone: string) {
  return zonedScheduleParts(date, timeZone).dateKey;
}

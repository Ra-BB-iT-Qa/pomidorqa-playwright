function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  return zonedAsUtc - instant.getTime();
}

export function zonedDateTime(instant: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`,
  };
}

export function shiftClock(date: string, time: string, minutes: number): { date: string; time: string } {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

export function tomorrowDate(timeZone: string): string {
  const today = zonedDateTime(new Date(), timeZone).date;
  return shiftClock(today, "12:00", 24 * 60).date;
}

export function zonedInstant(date: string, time: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let pass = 0; pass < 2; pass += 1) {
    utc = Date.UTC(year, month - 1, day, hour, minute) - zoneOffsetMs(new Date(utc), timeZone);
  }
  return utc;
}

export function futureSlotClock(timeZone: string, leadMs: number): { date: string; time: string } {
  const earliest = Date.now() + leadMs;
  const clock = zonedDateTime(new Date(earliest), timeZone);
  if (zonedInstant(clock.date, clock.time, timeZone) >= earliest) {
    return clock;
  }
  return shiftClock(clock.date, clock.time, 1);
}

export function pastClock(timeZone: string): { date: string; time: string } {
  const now = zonedDateTime(new Date(), timeZone);
  const hourAgo = shiftClock(now.date, now.time, -60);
  if (hourAgo.date === now.date) {
    return hourAgo;
  }
  return { date: now.date, time: "00:00" };
}

export function clockTimeInZone(date: string, time: string, fromZone: string, toZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let pass = 0; pass < 2; pass += 1) {
    utc = Date.UTC(year, month - 1, day, hour, minute) - zoneOffsetMs(new Date(utc), fromZone);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: toZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utc));
}

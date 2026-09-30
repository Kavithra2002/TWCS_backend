const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Current wall-clock time in the factory's time zone. */
export function localNow(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    hhmm: `${get('hour')}:${get('minute')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
  };
}

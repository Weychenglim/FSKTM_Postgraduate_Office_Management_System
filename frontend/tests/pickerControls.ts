// Drives the portal's DateField and TimeField the way a person does: open, choose, close.
const pause = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));
const panel = (name: string) => document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`);

export async function pickDate(trigger: HTMLElement, iso: string) {
  if (!panel('Choose a date')) {
    trigger.click();
    await pause();
  }
  for (let step = 0; step < 400; step += 1) {
    const calendar = panel('Choose a date');
    if (!calendar) throw new Error('Date picker did not open');
    const day = calendar.querySelector<HTMLElement>(`[data-day="${iso}"]`);
    if (day) {
      day.click();
      await pause();
      return;
    }
    const shown = calendar.querySelectorAll<HTMLElement>('[data-day]')[14]?.dataset.day ?? '';
    calendar.querySelector<HTMLElement>(`[aria-label="${iso < shown ? 'Previous month' : 'Next month'}"]`)?.click();
    await pause(10);
  }
  throw new Error(`Date picker could not reach ${iso}`);
}

/** ``time`` is 24-hour "HH:MM". */
export async function pickTime(trigger: HTMLElement, time: string) {
  const [hour, minute] = time.split(':').map(Number);
  trigger.click();
  await pause();
  const clock = panel('Choose a time');
  if (!clock) throw new Error('Time picker did not open');
  for (const [wheel, value] of [['Hour', hour % 12 || 12], ['Minute', minute], ['AM or PM', hour >= 12 ? 1 : 0]] as const) {
    const row = clock.querySelector<HTMLElement>(`[aria-label="${wheel}"] [data-value="${value}"]`);
    if (!row) throw new Error(`No ${wheel} ${value} in the time picker`);
    row.click();
    await pause(10);
  }
  [...clock.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Done')?.click();
  await pause();
}

/** A DateTimeField by its ``label`` prop; ``value`` is "YYYY-MM-DDTHH:MM". */
export async function pickDateTime(label: string, value: string, scope: ParentNode = document) {
  const [date, time] = value.split('T');
  const dateTrigger = scope.querySelector<HTMLElement>(`[aria-label="${label}, date"]`);
  if (!dateTrigger) throw new Error(`No ${label} date`);
  await pickDate(dateTrigger, date);
  const timeTrigger = scope.querySelector<HTMLElement>(`[aria-label="${label}, time"]`);
  if (!timeTrigger) throw new Error(`No ${label} time`);
  await pickTime(timeTrigger, time.slice(0, 5));
}

/** The "YYYY-MM-DDTHH:MM" a DateTimeField shows, or '' when either half is empty. */
export function dateTimeValue(label: string, scope: ParentNode = document) {
  const date = scope.querySelector<HTMLElement>(`[aria-label="${label}, date"]`)?.dataset.value ?? '';
  const time = scope.querySelector<HTMLElement>(`[aria-label="${label}, time"]`)?.dataset.value ?? '';
  return date && time ? `${date}T${time}` : '';
}

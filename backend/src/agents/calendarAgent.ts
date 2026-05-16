/**
 * CalendarAgent — stub (architecture plan §9 marks this out-of-scope for MVP).
 *
 * Kept as a no-op so the orchestrator, registry and Permission Dashboard can
 * show "Not connected" consistently with the in-scope subagents.
 */

export interface CalendarPreview {
  status:  'not_connected';
  events:  [];
  message: string;
}

export async function runCalendarAgent(): Promise<CalendarPreview> {
  return {
    status:  'not_connected',
    events:  [],
    message: 'Calendar Agent is planned for Phase 2. No calendar data is read or written.',
  };
}

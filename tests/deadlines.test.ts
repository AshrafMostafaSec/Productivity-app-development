import { expect, it } from 'vitest';
import { createInitialState } from '../src/state/initialState';
import { dueSoon, assignmentPending } from '../src/state/selectors';
import { notificationPlan } from '../src/platform/notificationPlan';
import { dayKeyOf } from '../src/lib/time';
import type { Assignment } from '../src/types';

it('treats a deadline without steps as pending in both due lists and native reminders', () => {
  const now = new Date(2026, 9, 19, 8); const state = createInitialState(now);
  const assignment: Assignment = { id: 'deadline', title: 'Lab report', course: 'Networks', dueDate: dayKeyOf(now), steps: [] };
  state.assignments = [assignment];
  expect(assignmentPending(assignment)).toBe(true); expect(dueSoon(state, now)).toEqual([assignment]);
  expect(notificationPlan(state, now).some(n => n.extra.key === `deadline:${dayKeyOf(now)}`)).toBe(true);
  assignment.steps = [{ id: 'step', title: 'Submit', done: true }];
  expect(assignmentPending(assignment)).toBe(false); expect(dueSoon(state, now)).toEqual([]);
  expect(notificationPlan(state, now).some(n => n.extra.key === `deadline:${dayKeyOf(now)}`)).toBe(false);
});

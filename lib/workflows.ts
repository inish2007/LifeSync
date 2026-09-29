import type { EnergyLevel, MicroStep, Obligation, CompletionProof } from './types';
import { calculateAllBackplans, getReferenceToday } from './backplanner';
import { getEstimatedTimeMinutes } from './focus-mode';

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isActionable(task: Obligation, tasks: Obligation[]): boolean {
  return task.status === 'confirmed' && (task.dependsOnIds ?? []).every(id => tasks.some(t => t.id === id && t.status === 'completed'));
}

export function suggestMicroSteps(task: Obligation): MicroStep[] {
  const effort = Math.max(1, getEstimatedTimeMinutes(task));
  return [
    { id: `${task.id}-prepare`, title: `Open the notice from ${task.payee || 'the sender'} and find the required details`, minutes: 2, energy: 'low', done: false },
    { id: `${task.id}-gather`, title: `Gather the information needed to: ${task.requiredAction || task.title}`, minutes: 5, energy: 'medium', done: false },
    { id: `${task.id}-act`, title: task.requiredAction || task.title, minutes: effort, energy: effort > 20 ? 'high' : 'medium', done: false },
    { id: `${task.id}-proof`, title: 'Save the receipt or confirmation, then add proof to close the loop', minutes: 2, energy: 'low', done: false },
  ];
}

export function matchMicroSteps(tasks: Obligation[], energy: EnergyLevel, minutes: number) {
  const rank = { low: 0, medium: 1, high: 2 };
  return tasks.filter(t => isActionable(t, tasks)).flatMap(task => {
    // Only the first unfinished step is actionable; never recommend saving a receipt before doing the work.
    const step = (task.microSteps ?? suggestMicroSteps(task)).find(s => !s.done);
    return step && rank[step.energy] <= rank[energy] && step.minutes <= minutes ? [{ task, step }] : [];
  }).sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.step.minutes - b.step.minutes);
}

export interface Collision {
  id: string;
  kind: 'capacity' | 'deadline' | 'dependency' | 'waiting';
  title: string;
  explanation: string;
  taskIds: string[];
}

export function detectCollisions(tasks: Obligation[], dailyMinutes = 60, today = getReferenceToday()): Collision[] {
  const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'pending_review' && isCalendarDate(t.dueDate));
  const plans = calculateAllBackplans(tasks, today);
  const collisions: Collision[] = [];
  const days = new Map<string, Obligation[]>();
  for (const task of active) {
    const plan = plans.get(task.id);
    const day = plan?.recommendedStartDate && plan.recommendedStartDate > today ? plan.recommendedStartDate : today;
    days.set(day, [...(days.get(day) ?? []), task]);
    if (plan?.scheduleHealth === 'overrun') collisions.push({ id: `deadline-${task.id}`, kind: 'deadline', title: `Start window missed: ${task.title}`, explanation: `The backplan needs ${plan.totalLeadDaysRequired} days and is ${plan.deficitDays} days short. Review the deadline or request an extension.`, taskIds: [task.id] });
    const unresolved = (task.dependsOnIds ?? []).filter(id => !tasks.some(t => t.id === id && t.status === 'completed'));
    const conflicts = unresolved.filter(id => {
      const prerequisite = tasks.find(t => t.id === id);
      return !prerequisite || prerequisite.dueDate > (plan?.recommendedStartDate ?? task.dueDate);
    });
    if (conflicts.length) collisions.push({ id: `dependency-${task.id}`, kind: 'dependency', title: `Handoff at risk: ${task.title}`, explanation: 'A prerequisite is missing or due after this task needs to start. Bring its handoff forward or revise the plan.', taskIds: [task.id, ...conflicts.filter(id => tasks.some(t => t.id === id))] });
    if (task.status === 'waiting' && (!task.followUpDate || task.followUpDate > (plan?.recommendedStartDate ?? task.dueDate))) collisions.push({ id: `waiting-${task.id}`, kind: 'waiting', title: `Follow-up gap: ${task.title}`, explanation: 'The follow-up is missing or falls after the recommended start. Contact the person holding up this task earlier.', taskIds: [task.id] });
  }
  const capacity = Number.isFinite(dailyMinutes) ? Math.max(1, dailyMinutes) : 60;
  for (const [date, group] of days) {
    const effort = group.reduce((sum, task) => sum + getEstimatedTimeMinutes(task), 0);
    if (effort > capacity) collisions.push({ id: `capacity-${date}`, kind: 'capacity', title: `Workload collision on ${date}`, explanation: `${group.length} obligation(s) need about ${effort} minutes against your ${capacity}-minute daily capacity. This estimate groups work by recommended start date; move preparation earlier or request more time.`, taskIds: group.map(t => t.id) });
  }
  return collisions;
}

export type ResolutionKind = 'extension' | 'clarification' | 'follow-up';
export function createResolutionDraft(task: Obligation, kind: ResolutionKind): string {
  const request = kind === 'extension'
    ? 'Could you confirm whether an extension is possible, and what revised deadline and terms you can offer?'
    : kind === 'follow-up'
      ? `I am following up on ${task.waitingNote || task.requiredAction || task.title}. Could you share the current status and expected response date?`
      : `Could you clarify the steps and documents required for: ${task.requiredAction || task.title}?`;
  return `Subject: ${kind === 'follow-up' ? 'Follow-up' : 'Request'} — ${task.title}\n\nHello ${task.waitingOn || task.payee || 'team'},\n\nI am contacting you about ${task.title}${task.dueDate ? `, currently due ${task.dueDate}` : ''}.\n\n${request}\n\nPlease confirm any changes in writing.\n\nThank you,\n[Your name]`;
}

export const MAX_PROOF_BYTES = 1024 * 1024;
export const PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
export function validateCompletion(task: Obligation, tasks: Obligation[], note: string, proofs: CompletionProof[]): string | null {
  if (task.status === 'pending_review') return 'Confirm this obligation in the inbox first.';
  if ((task.dependsOnIds ?? []).some(id => !tasks.some(t => t.id === id && t.status === 'completed'))) return 'Complete all prerequisites before closing this loop.';
  if (!note.trim() && !proofs.length) return 'Add a confirmation note or upload a receipt before closing this loop.';
  if (proofs.length > 3 || proofs.some(p => !PROOF_TYPES.includes(p.mimeType) || p.size > MAX_PROOF_BYTES || p.size <= 0 || !p.dataUrl.startsWith(`data:${p.mimeType};base64,`) || p.dataUrl.length > MAX_PROOF_BYTES * 1.4)) return 'Use up to three PNG, JPG, WebP or PDF files, each at most 1 MB.';
  return null;
}

import assert from 'node:assert/strict';
import { INITIAL_SEED_OBLIGATIONS, completeObligation, getObligations, putInWaitingRoom, updateWorkflow } from '../lib/storage';
import { createResolutionDraft, detectCollisions, isCalendarDate, matchMicroSteps, suggestMicroSteps, validateCompletion } from '../lib/workflows';
import { calculateFocusPriorities } from '../lib/focus-mode';
import { calculateNextBestAction } from '../lib/graph';
import type { CompletionProof, Obligation } from '../lib/types';

const base: Obligation = { ...INITIAL_SEED_OBLIGATIONS[0], id: 'base', dueDate: '2026-10-10', dependsOnIds: [], estimatedMinutes: 40, estimatedDurationDays: 1, bufferDays: 0 };
const blocked: Obligation = { ...base, id: 'blocked', dependsOnIds: ['base'] };
const waiting: Obligation = { ...base, id: 'waiting', status: 'waiting', followUpDate: '2026-10-11' };
const completed: Obligation = { ...base, id: 'done', status: 'completed' };
const pending: Obligation = { ...base, id: 'pending', status: 'pending_review' };
const tasks = [base, blocked, waiting, completed, pending];

assert.equal(isCalendarDate('2026-02-30'), false);
assert.equal(isCalendarDate('2028-02-29'), true);
assert.equal(matchMicroSteps(tasks, 'low', 2).length, 1);
assert.equal(matchMicroSteps(tasks, 'low', 1).length, 0);
const progressed = { ...base, microSteps: suggestMicroSteps(base).map((s, i) => ({ ...s, done: i === 0 })) };
assert.equal(matchMicroSteps([progressed], 'low', 60).length, 0, 'Do not skip ahead to a low-energy receipt step');
assert.equal(matchMicroSteps([progressed], 'medium', 5)[0].step.id, 'base-gather');
assert.equal(calculateNextBestAction([waiting, pending]), null);
const focus = calculateFocusPriorities(tasks, '2026-10-12');
assert.deepEqual(focus.topThree.map(r => r.task.id), ['base']);
assert.ok(focus.criticalOverdueTasks.some(r => r.task.id === 'waiting'), 'Never hide overdue waiting tasks');

const collisions = detectCollisions(tasks, 30, '2026-10-01');
assert.ok(collisions.some(c => c.kind === 'capacity'));
assert.ok(collisions.some(c => c.kind === 'dependency'));
assert.ok(collisions.some(c => c.kind === 'waiting'));
assert.ok(!collisions.some(c => c.taskIds.includes('done') || c.taskIds.includes('pending')));
assert.equal(detectCollisions([base], 60, '2026-10-01').length, 0);
assert.ok(detectCollisions([base], 60, '2026-10-12').some(c => c.kind === 'deadline'));
assert.ok(detectCollisions([{ ...blocked, dependsOnIds: ['missing'] }], 60, '2026-10-01').some(c => c.kind === 'dependency'));

const draft = createResolutionDraft({ ...base, consequence: 'Invented penalty MUST NOT appear' }, 'extension');
assert.ok(draft.includes(base.dueDate));
assert.ok(!draft.includes('Invented penalty'));
assert.ok(createResolutionDraft({ ...waiting, waitingOn: 'Morgan', waitingNote: 'a signed document' }, 'follow-up').includes('Hello Morgan'));
assert.ok(validateCompletion(base, tasks, '   ', []));
assert.ok(validateCompletion(blocked, tasks, 'receipt 123', []));
assert.equal(validateCompletion(base, tasks, 'receipt 123', []), null);
const proof: CompletionProof = { id: 'proof', name: 'receipt.pdf', mimeType: 'application/pdf', dataUrl: 'data:application/pdf;base64,JVBERg==', size: 4, uploadedAt: '2026-09-29T00:00:00Z' };
assert.equal(validateCompletion(base, tasks, '', [proof]), null);
assert.ok(validateCompletion(base, tasks, '', [{ ...proof, size: 2 * 1024 * 1024 }]));
assert.ok(validateCompletion(base, tasks, '', [{ ...proof, mimeType: 'text/html' }]));

const memory = new Map<string, string>();
let failWrites = false;
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrites) throw new Error('Quota'); memory.set(key, value); },
} });
Object.defineProperty(globalThis, 'window', { value: { dispatchEvent: () => true } });
memory.set('lifeloop_obligations_v1', JSON.stringify(tasks));
putInWaitingRoom('base', 'Morgan', 'Approval', '2026-10-05');
assert.equal(getObligations()[0].status, 'waiting');
assert.equal(getObligations()[0].dueDate, base.dueDate, 'Waiting must preserve original deadline');
assert.throws(() => putInWaitingRoom('base', '', 'Approval', '2026-10-05'));
assert.throws(() => putInWaitingRoom('done', 'Morgan', 'Approval', '2026-10-05'));
updateWorkflow('base', { resolutionDraft: draft, microSteps: suggestMicroSteps(base) });
assert.equal(getObligations()[0].resolutionDraft, draft);
completeObligation('base', 'Receipt 123', [proof]);
assert.equal(getObligations()[0].completionProofs?.[0].dataUrl, proof.dataUrl);
assert.ok(getObligations()[0].completedAt);
assert.equal(validateCompletion(blocked, getObligations(), 'Receipt 456', []), null, 'Saved completion unlocks dependent');
const beforeFailure = memory.get('lifeloop_obligations_v1');
failWrites = true;
assert.throws(() => updateWorkflow('base', { resolutionDraft: 'lost draft' }), /Could not save/);
assert.equal(memory.get('lifeloop_obligations_v1'), beforeFailure);
failWrites = false;
updateWorkflow('base', { status: 'confirmed', completedAt: undefined });
assert.ok(validateCompletion(blocked, getObligations(), 'Receipt 456', []), 'Reopening blocks dependents again');
assert.equal(getObligations()[0].completionProofs?.[0].name, 'receipt.pdf', 'Reopening retains evidence');
console.log('PASS: workflow matching, collisions, drafts, waiting, proof validation, persistence, quota failure and dependency lifecycle.');

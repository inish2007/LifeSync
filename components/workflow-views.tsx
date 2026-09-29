'use client';

import { useState } from 'react';
import type { EnergyLevel, Obligation } from '@/lib/types';
import { detectCollisions, matchMicroSteps } from '@/lib/workflows';
import { getReferenceToday, offsetDate } from '@/lib/backplanner';
import { updateWorkflow } from '@/lib/storage';

type Props = { obligations: Obligation[]; onSelectTask: (task: Obligation) => void };

export function EnergyStepsView({ obligations, onSelectTask }: Props) {
  const [energy, setEnergy] = useState<EnergyLevel>('low');
  const [minutes, setMinutes] = useState(10);
  const matches = matchMicroSteps(obligations, energy, minutes);
  const overdue = obligations.filter(t => t.status !== 'completed' && t.status !== 'pending_review' && t.dueDate < getReferenceToday());
  return <section className="panel workflow-stack">
    <div><div className="eyebrow">One small step is progress</div><h2>Energy-Matched Micro-Steps</h2><p className="helper">Choose what you have capacity for. We match the next unfinished step from tasks you can act on.</p></div>
    <div className="row">
      <label>My energy <select value={energy} onChange={e => setEnergy(e.target.value as EnergyLevel)}><option value="low">Low — keep it light</option><option value="medium">Medium — steady effort</option><option value="high">High — ready to focus</option></select></label>
      <label>Time available <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[2, 5, 10, 15, 30, 60].map(n => <option value={n} key={n}>{n} minutes</option>)}</select></label>
    </div>
    {!!overdue.length && <div className="notice"><strong>{overdue.length} overdue obligation(s) still need attention.</strong><p>Your energy selection never hides these deadlines.</p><div className="row">{overdue.map(t => <button className="linkbutton" key={t.id} onClick={() => onSelectTask(t)}>{t.title}</button>)}</div></div>}
    {!matches.length && <p className="empty">No next steps fit this energy and time. Increase your available time, edit a task’s steps, or check the Waiting Room.</p>}
    {matches.slice(0, 5).map(({ task, step }) => <article className="workflow-card" key={task.id}><span className="badge blue">{step.minutes} min · {step.energy} energy</span><h3>{step.title}</h3><p className="helper">{task.title} · Due {task.dueDate}</p><button className="secondary" onClick={() => onSelectTask(task)}>Open steps</button></article>)}
  </section>;
}

export function CollisionView({ obligations, onSelectTask }: Props) {
  const [capacity, setCapacity] = useState(60);
  const collisions = detectCollisions(obligations, capacity);
  return <section className="panel workflow-stack"><div><div className="eyebrow">Make space before deadlines collide</div><h2>Collision Detector</h2><p className="helper">Checks estimated workload, prerequisite handoffs, missed start windows, and follow-up gaps. These are planning warnings, not calendar appointments.</p></div>
    <label className="field">Daily capacity in minutes<input type="number" min="1" max="1440" value={capacity} onChange={e => setCapacity(Math.min(1440, Math.max(1, Number(e.target.value) || 1)))} /></label>
    {!collisions.length && <p className="completion">No collisions found with your current dates and estimates.</p>}
    {collisions.map(collision => <article className="workflow-card" key={collision.id}><span className="badge amber">{collision.kind}</span><h3>{collision.title}</h3><p>{collision.explanation}</p><div className="row">{collision.taskIds.map(id => { const task = obligations.find(t => t.id === id); return task && <button className="secondary" key={id} onClick={() => onSelectTask(task)}>Resolve: {task.title}</button>; })}</div></article>)}
  </section>;
}

export function WaitingRoomView({ obligations, onSelectTask }: Props) {
  const [error, setError] = useState('');
  const today = getReferenceToday();
  const waiting = obligations.filter(t => t.status === 'waiting').sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''));
  const save = (id: string, changes: Partial<Obligation>) => { try { updateWorkflow(id, changes); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); } };
  return <section className="panel workflow-stack"><div><div className="eyebrow">Out of your hands, still in sight</div><h2>Waiting Room</h2><p className="helper">Keep track of who owes you a response. Follow-up reminders are shown in this app; no messages are sent.</p></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {!waiting.length && <p className="empty">Nothing waiting right now. Open an obligation to record who you need a response from and when to follow up.</p>}
    {waiting.map(task => <article className="workflow-card" key={task.id}><span className={`badge ${!task.followUpDate || task.followUpDate <= today ? 'amber' : 'blue'}`}>{!task.followUpDate ? 'Set a follow-up date' : task.followUpDate <= today ? 'Follow-up due' : `Follow up ${task.followUpDate}`}</span><h3>{task.title}</h3><p>Waiting on <strong>{task.waitingOn || task.payee || 'Not specified'}</strong>: {task.waitingNote || 'No details yet.'}</p><p className="helper">Obligation due {task.dueDate}{task.dueDate < today ? ' · Overdue' : ''}{task.waitingSince ? ` · Waiting since ${task.waitingSince.slice(0, 10)}` : ''}{task.lastFollowedUpAt ? ` · Last contacted ${task.lastFollowedUpAt.slice(0, 10)}` : ''}</p><div className="row">
      <button className="primary" onClick={() => onSelectTask(task)}>Draft follow-up / edit</button>
      <button className="secondary" onClick={() => save(task.id, { lastFollowedUpAt: new Date().toISOString(), followUpDate: offsetDate(today, 3) })}>I followed up · remind in 3 days</button>
      <button className="secondary" onClick={() => save(task.id, { status: 'confirmed', followUpDate: undefined, waitingSince: undefined })}>Response received</button>
    </div></article>)}
  </section>;
}

export function ProofLibraryView({ obligations, onSelectTask }: Props) {
  const closed = obligations.filter(t => t.status === 'completed');
  return <section className="panel workflow-stack"><div><div className="eyebrow">Every closed loop has a record</div><h2>Proof of Completion</h2><p className="helper">Your confirmation notes and uploaded receipts, stored locally in this browser.</p></div>
    {!closed.length && <p className="empty">No closed loops yet. Open a task and save a confirmation note or receipt to complete it.</p>}
    {closed.map(task => <article className="workflow-card" key={task.id}><span className="badge green">Closed {task.completedAt?.slice(0, 10) || ''}</span><h3>{task.title}</h3><p className="quote">{task.completionProofNote || (task.completionProofs?.length ? 'Receipt attached.' : 'No evidence recorded for this older completion.')}</p><p className="helper">{task.completionProofs?.length || 0} attachment(s)</p><button className="secondary" onClick={() => onSelectTask(task)}>View evidence</button></article>)}
  </section>;
}

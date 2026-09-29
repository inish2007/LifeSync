'use client';

import { useState } from 'react';
import type { CompletionProof, Obligation } from '@/lib/types';
import { completeObligation, putInWaitingRoom, updateWorkflow } from '@/lib/storage';
import { createResolutionDraft, MAX_PROOF_BYTES, PROOF_TYPES, suggestMicroSteps, validateCompletion, type ResolutionKind } from '@/lib/workflows';
import { getReferenceToday, offsetDate } from '@/lib/backplanner';

export default function TaskWorkflows({ task, tasks, onUpdated }: { task: Obligation; tasks: Obligation[]; onUpdated: () => void }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [waitingOn, setWaitingOn] = useState(task.waitingOn || task.payee);
  const [waitingNote, setWaitingNote] = useState(task.waitingNote || '');
  const [followUp, setFollowUp] = useState(task.followUpDate || offsetDate(getReferenceToday(), 2));
  const [kind, setKind] = useState<ResolutionKind>(task.status === 'waiting' ? 'follow-up' : 'extension');
  const [draft, setDraft] = useState(task.resolutionDraft || createResolutionDraft(task, task.status === 'waiting' ? 'follow-up' : 'extension'));
  const [note, setNote] = useState(task.completionProofNote || '');
  const [proofs, setProofs] = useState<CompletionProof[]>(task.completionProofs || []);
  const [reading, setReading] = useState(false);
  const [stepTitle, setStepTitle] = useState('');
  const steps = task.microSteps ?? suggestMicroSteps(task);

  function run(action: () => void, success: string) {
    setError(''); setMessage('');
    try { action(); onUpdated(); setMessage(success); return true; }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please try again.'); return false; }
  }

  async function attach(files: File[]) {
    setError(''); setMessage('');
    if (!files.length) return;
    if (files.length + proofs.length > 3 || files.some(f => !PROOF_TYPES.includes(f.type) || !f.size || f.size > MAX_PROOF_BYTES)) {
      setError('Use up to three PNG, JPG, WebP or PDF files, each at most 1 MB.'); return;
    }
    setReading(true);
    try {
      const attachments = await Promise.all(files.map(file => new Promise<CompletionProof>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the attachment. Please choose it again.'));
        reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result), uploadedAt: new Date().toISOString() });
        reader.readAsDataURL(file);
      })));
      setProofs(previous => [...previous, ...attachments]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read attachment.'); }
    finally { setReading(false); }
  }

  return <div className="workflow-stack">
    <section className="workflow-card" id="micro-steps" aria-labelledby="micro-heading">
      <h3 id="micro-heading">Energy-Matched Micro-Steps</h3>
      <p className="helper">Suggested steps and time estimates are editable. Checking a step does not close the obligation.</p>
      {steps.map((step, index) => <div className="micro-row" key={step.id}>
        <input type="checkbox" aria-label={`Complete step: ${step.title}`} checked={step.done} disabled={task.status === 'completed'} onChange={e => run(() => updateWorkflow(task.id, { microSteps: steps.map(s => s.id === step.id ? { ...s, done: e.target.checked } : s) }), 'Step progress saved.')} />
        <input className={step.done ? 'micro-done' : ''} aria-label={`Title for step ${index + 1}`} defaultValue={step.title} disabled={task.status === 'completed'} maxLength={300} onBlur={e => {
          const title = e.target.value.trim();
          if (!title) { e.target.value = step.title; return; }
          if (title !== step.title) run(() => updateWorkflow(task.id, { microSteps: steps.map(s => s.id === step.id ? { ...s, title } : s) }), 'Step updated.');
        }} />
        <label className="helper">Minutes<input aria-label={`Minutes for step ${index + 1}`} type="number" min="1" max="480" defaultValue={step.minutes} disabled={task.status === 'completed'} onBlur={e => {
          const minutes = Number(e.target.value);
          if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) { e.target.value = String(step.minutes); return; }
          run(() => updateWorkflow(task.id, { microSteps: steps.map(s => s.id === step.id ? { ...s, minutes } : s) }), 'Step estimate saved.');
        }} /></label>
        <select aria-label={`Energy for step ${index + 1}`} value={step.energy} disabled={task.status === 'completed'} onChange={e => run(() => updateWorkflow(task.id, { microSteps: steps.map(s => s.id === step.id ? { ...s, energy: e.target.value as typeof s.energy } : s) }), 'Energy level saved.')}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>)}
      {task.status !== 'completed' && <form className="row" onSubmit={e => { e.preventDefault(); if (!stepTitle.trim()) return; if (run(() => updateWorkflow(task.id, { microSteps: [...steps, { id: crypto.randomUUID(), title: stepTitle.trim(), minutes: 5, energy: 'low', done: false }] }), 'Custom step added.')) setStepTitle(''); }}>
        <input aria-label="Custom micro-step" placeholder="Add your own small step" value={stepTitle} onChange={e => setStepTitle(e.target.value)} required maxLength={300} />
        <button className="secondary" type="submit">Add step</button>
      </form>}
    </section>

    {task.status !== 'completed' && <>
      <section className="workflow-card" id="resolution-copilot">
        <h3>Resolution Copilot</h3>
        <p className="helper">An editable template using this task’s details. Review and copy it to your email or message app; nothing is sent automatically.</p>
        <div className="row">
          <label>Request <select value={kind} onChange={e => setKind(e.target.value as ResolutionKind)}><option value="extension">Extension</option><option value="clarification">Clarification</option><option value="follow-up">Follow-up</option></select></label>
          <button className="secondary" type="button" onClick={() => { if (!draft.trim() || confirm('Replace the current draft with a new template?')) setDraft(createResolutionDraft(task, kind)); }}>Generate draft</button>
        </div>
        <label className="field">Message draft<textarea rows={9} value={draft} onChange={e => setDraft(e.target.value)} /></label>
        <div className="row">
          <button className="primary" type="button" onClick={() => run(() => updateWorkflow(task.id, { resolutionDraft: draft }), 'Draft saved. Nothing has been sent.')}>Save draft</button>
          <button className="secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft); setMessage('Draft copied. Review it before sending.'); setError(''); } catch { setError('Clipboard unavailable. Select and copy the draft manually.'); } }}>Copy draft</button>
        </div>
      </section>
      <section className="workflow-card" id="waiting-room">
        <h3>Waiting Room</h3>
        <p className="helper">Track a response without losing the original deadline. Follow-ups appear here when you open LifeLoop.</p>
        <form onSubmit={e => { e.preventDefault(); run(() => putInWaitingRoom(task.id, waitingOn, waitingNote, followUp), 'Waiting details saved.'); }}>
          <label className="field">Waiting on<input required value={waitingOn} onChange={e => setWaitingOn(e.target.value)} placeholder="Person or organization" /></label>
          <label className="field">What do you need?<input required value={waitingNote} onChange={e => setWaitingNote(e.target.value)} placeholder="e.g. Confirmation that the payment was received" /></label>
          <label className="field">Follow up on<input required type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} /></label>
          {followUp > task.dueDate && <p className="notice">This follow-up is after the obligation’s deadline.</p>}
          <div className="row"><button className="primary" type="submit">{task.status === 'waiting' ? 'Update follow-up' : 'Move to Waiting Room'}</button>
            {task.status === 'waiting' && <button className="secondary" type="button" onClick={() => run(() => updateWorkflow(task.id, { status: 'confirmed', waitingSince: undefined, followUpDate: undefined }), 'Response received. Task returned to active work.')}>Response received</button>}
          </div>
        </form>
      </section>
    </>}

    <section className="workflow-card" id="completion-proof">
      <h3>Proof of Completion</h3>
      <p className="helper">Save a receipt, confirmation code, or a description of what you verified. Evidence is stored only in this browser and is not independently verified.</p>
      {task.status === 'completed' ? <>
        <p className="completion">Loop closed {task.completedAt ? new Date(task.completedAt).toLocaleString() : ''}</p>
        <p className="quote">{task.completionProofNote || 'Receipt attached.'}</p>
        {(task.completionProofs || []).map(proof => <p key={proof.id}><a className="linkbutton" href={proof.dataUrl} download={proof.name}>Download {proof.name}</a></p>)}
      </> : <>
        <label className="field">Confirmation note or reference code<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Payment accepted; receipt reference ABC-123" /></label>
        <label className="field">Attach evidence (up to 3 files, 1 MB each)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple disabled={reading} onChange={e => { void attach(Array.from(e.target.files || [])); e.target.value = ''; }} /></label>
        {proofs.map(proof => <div className="row spread" key={proof.id}><a href={proof.dataUrl} download={proof.name}>{proof.name}</a><button type="button" className="linkbutton" disabled={reading} onClick={() => setProofs(proofs.filter(p => p.id !== proof.id))}>Remove</button></div>)}
        <p className="helper">{validateCompletion(task, tasks, note, proofs) || 'Ready to close with your evidence.'}</p>
        <button type="button" className="primary" disabled={reading || !!validateCompletion(task, tasks, note, proofs)} onClick={() => run(() => completeObligation(task.id, note, proofs), 'Evidence saved and loop closed.')}>
          {reading ? 'Reading attachment…' : 'Save proof & close loop'}
        </button>
      </>}
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="completion" role="status">{message}</p>}
  </div>;
}

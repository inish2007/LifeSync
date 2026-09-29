'use client';
import { inrOnly } from '@/lib/currency';

import { useState, useEffect } from 'react';
import {
  GitBranch,
  Lock,
  PlayCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Building2,
  AlertTriangle,
  Plus,
  X,
  FileText,
  Trash2,
  Sparkles,
  ShieldAlert,
  Info,
  CalendarClock,
  Hourglass,
  ArrowRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Obligation, ConsequenceProvenance, ConsequenceType } from '@/lib/types';
import {
  getTaskDependencyStatus,
  getUnresolvedPrerequisites,
  getDirectDownstreamDependents,
  getTransitiveUnlockedTasks,
  canAddDependency,
  addDependency,
  removeDependency
} from '@/lib/graph';
import {
  updateObligationStatus,
  deleteObligation,
  saveObligation,
  updateObligationBackplanSettings,
  updateObligationDueDate,
  updateObligationEstimatedMinutes
} from '@/lib/storage';
import {
  calculateUrgency,
  generateWhyNowExplanation,
  getConsequenceCategoryLabel,
  detectConsequenceType
} from '@/lib/consequence-engine';
import { calculateAllBackplans } from '@/lib/backplanner';
import { getEstimatedTimeMinutes, formatEstimatedTime } from '@/lib/focus-mode';
import TaskWorkflows from '@/components/task-workflows';

interface TaskDetailDialogProps {
  task: Obligation | null;
  allTasks: Obligation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function TaskDetailDialog({
  task,
  allTasks,
  open,
  onOpenChange,
  onUpdated,
}: TaskDetailDialogProps) {
  const [selectedPrereqToAdd, setSelectedPrereqToAdd] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consequence inline editing states
  const [isEditingConsequence, setIsEditingConsequence] = useState(false);
  const [consequenceText, setConsequenceText] = useState('');
  const [consequenceProv, setConsequenceProv] = useState<ConsequenceProvenance>('From document');
  const [consequenceTypeVal, setConsequenceTypeVal] = useState<ConsequenceType>('general');
  // Backplanner & Effort state
  const [durationInput, setDurationInput] = useState<number>(task?.estimatedDurationDays ?? 1);
  const [bufferInput, setBufferInput] = useState<number>(task?.bufferDays ?? 1);
  const [dueDateInput, setDueDateInput] = useState<string>(task?.dueDate ?? '');
  const [estimatedMinutesInput, setEstimatedMinutesInput] = useState<number>(
    task?.estimatedMinutes ?? (task ? getEstimatedTimeMinutes(task) : 15)
  );

  useEffect(() => {
    if (task) {
      setDurationInput(task.estimatedDurationDays ?? 1);
      setBufferInput(task.bufferDays ?? 1);
      setDueDateInput(task.dueDate || '');
      setEstimatedMinutesInput(task.estimatedMinutes ?? getEstimatedTimeMinutes(task));
    }
  }, [task?.id, task?.estimatedDurationDays, task?.bufferDays, task?.dueDate, task?.estimatedMinutes]);

  if (!task) return null;

  const handleSaveBackplanner = (newDuration?: number, newBuffer?: number, newDate?: string) => {
    if (!task) return;
    const dur = newDuration !== undefined ? newDuration : durationInput;
    const buf = newBuffer !== undefined ? newBuffer : bufferInput;
    const date = newDate !== undefined ? newDate : dueDateInput;

    if (date && date !== task.dueDate) {
      updateObligationDueDate(task.id, date);
    }
    updateObligationBackplanSettings(task.id, dur, buf);
    onUpdated();
  };

  const backplans = calculateAllBackplans(allTasks);
  const backplan = backplans.get(task.id);

  const currentStatus = getTaskDependencyStatus(task, allTasks);
  const unresolvedPrereqs = getUnresolvedPrerequisites(task, allTasks);
  const currentPrereqIds = task.dependsOnIds || [];
  const currentPrereqs = currentPrereqIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Obligation => t !== undefined);

  const downstreamDependents = getDirectDownstreamDependents(task.id, allTasks);
  const transitiveUnlocked = getTransitiveUnlockedTasks(task.id, allTasks);

  const urgency = calculateUrgency(task, allTasks);
  const whyNow = generateWhyNowExplanation(task, allTasks);
  const provenance = task.consequenceProvenance || 'From document';
  const categoryLabel = getConsequenceCategoryLabel(task.consequenceType || detectConsequenceType(task.consequence));

  const handleOpenEditConsequence = () => {
    setConsequenceText(task.consequence || '');
    setConsequenceProv(task.consequenceProvenance || 'From document');
    setConsequenceTypeVal(task.consequenceType || detectConsequenceType(task.consequence || ''));
    setIsEditingConsequence(true);
  };

  const handleSaveConsequence = () => {
    task.consequence = consequenceText;
    task.consequenceProvenance = consequenceProv;
    task.consequenceType = consequenceTypeVal;
    saveObligation(task);
    setIsEditingConsequence(false);
    onUpdated();
  };

  // Available obligations that can be added as prerequisites (no self, no existing, no cycles)
  const availablePrereqs = allTasks.filter(candidate => {
    const validation = canAddDependency(task.id, candidate.id, allTasks);
    return validation.allowed;
  });

  const handleAddPrerequisite = () => {
    if (!selectedPrereqToAdd) return;
    const validation = canAddDependency(task.id, selectedPrereqToAdd, allTasks);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'Cannot add this dependency.');
      return;
    }

    addDependency(task.id, selectedPrereqToAdd);
    setSelectedPrereqToAdd('');
    setErrorMessage(null);
    onUpdated();
  };

  const handleRemovePrerequisite = (prereqId: string) => {
    removeDependency(task.id, prereqId);
    setErrorMessage(null);
    onUpdated();
  };

  const handleReactivate = () => {
    updateObligationStatus(task.id, 'confirmed');
    onUpdated();
  };

  const handleDelete = () => {
    if (confirm(`Delete obligation "${task.title}"?`)) {
      deleteObligation(task.id);
      onOpenChange(false);
      onUpdated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal" style={{ maxWidth: '680px' }}>
        {/* HEADER */}
        <div className="sectionhead" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="badge" style={{ fontSize: 11.5 }}>
                {task.category}
              </span>

              {/* Urgency Ranker Badge */}
              <span className={`badge ${urgency.badgeColor}`} style={{ fontSize: 11, fontWeight: 700 }}>
                {urgency.badgeLabel}
              </span>

              {currentStatus === 'completed' && (
                <span className="badge green">
                  <CheckCircle2 size={12} />
                  Loop Closed
                </span>
              )}
              {task.status === 'waiting' && <span className="badge amber">Waiting for a response</span>}
              {currentStatus === 'ready' && task.status === 'confirmed' && (
                <span className="badge blue" style={{ fontWeight: 700 }}>
                  <PlayCircle size={12} />
                  Ready to Act
                </span>
              )}
              {currentStatus === 'blocked' && (
                <span className="badge red" style={{ fontWeight: 700 }}>
                  <Lock size={12} />
                  Blocked by {unresolvedPrereqs.length} prerequisite{unresolvedPrereqs.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <DialogTitle style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px' }}>
              {task.title}
            </DialogTitle>
            <DialogDescription style={{ color: '#5c6048' }}>
              {task.payee} • Due {task.dueDate} • {inrOnly(task.amount)}
            </DialogDescription>
          </div>

          <button
            type="button"
            className="linkbutton"
            style={{ color: '#85523f', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleDelete}
            title="Delete this obligation"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>

        <nav className="row" aria-label="Task workflows">
          {([{ id: 'micro-steps', label: 'Micro-Steps' }, { id: 'resolution-copilot', label: 'Resolution Copilot' }, { id: 'waiting-room', label: 'Waiting Room' }, { id: 'completion-proof', label: 'Proof of Completion' }] as const).filter(item => task.status !== 'completed' || item.id === 'micro-steps' || item.id === 'completion-proof').map(item => <button key={item.id} type="button" className="secondary" onClick={() => document.getElementById(item.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{item.label}</button>)}
        </nav>

        {errorMessage && (
          <div className="notice error" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
            <AlertTriangle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* "WHY NOW?" REASONING BANNER */}
        <div
          style={{
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #f5f1e8 0%, #eee9df 100%)',
            border: '1px solid #cfc7b6',
            borderRadius: 10,
            margin: '6px 0 14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5c6048', fontWeight: 700, fontSize: 13 }}>
              <Sparkles size={14} color="#5c6048" />
              Why now?
            </div>
            <span style={{ fontSize: 11, color: '#5c6048' }}>
              {urgency.reason}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: '#292820', lineHeight: 1.55 }}>
            {whyNow}
          </p>
        </div>

        {/* BLOCKED STATUS CALLOUT */}
        {currentStatus === 'blocked' && (
          <div
            style={{
              padding: '12px 16px',
              background: '#f6ece3',
              border: '1.5px solid #ead8c8',
              borderRadius: 10,
              margin: '0 0 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#85523f', fontWeight: 700, fontSize: 13.5 }}>
              <Lock size={15} />
              This task is currently BLOCKED
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#85523f', lineHeight: 1.5 }}>
              You cannot complete this obligation until the following prerequisite task is finished:
            </p>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unresolvedPrereqs.map(p => (
                <span
                  key={p.id}
                  style={{
                    padding: '3px 8px',
                    background: '#fbf8f0',
                    border: '1px solid #ead8c8',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#85523f',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <AlertTriangle size={11} />
                  {p.title} (Due {p.dueDate})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* REQUIRED ACTION & PROMINENT CONSEQUENCE */}
        <div style={{ display: 'grid', gap: 10, margin: '6px 0 16px' }}>
          <div style={{ padding: 12, background: '#fbf8f0', borderRadius: 8, border: '1px solid #e3ddcf' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase' }}>
              Required Action
            </span>
            <div style={{ fontSize: 14, color: '#292820', fontWeight: 550, marginTop: 4 }}>
              {inrOnly(task.requiredAction)}
            </div>
          </div>

          {/* PROMINENT DOCUMENTED CONSEQUENCE SECTION */}
          <div
            style={{
              padding: 14,
              background: provenance === 'Unknown' ? '#fbf8f0' : '#f6ece3',
              borderRadius: 8,
              border: provenance === 'Unknown' ? '1px solid #e3ddcf' : '1px solid #ead8c8',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: provenance === 'Unknown' ? '#5c6048' : '#85523f', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={13} color={provenance === 'Unknown' ? '#5c6048' : '#85523f'} />
                  Documented Consequence
                </span>
                <span className="badge" style={{ fontSize: 10.5 }}>
                  {categoryLabel}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Consequence Provenance Badge */}
                <span
                  className={`badge ${
                    provenance === 'From document'
                      ? 'blue'
                      : provenance === 'Added by you'
                      ? 'amber'
                      : ''
                  }`}
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {provenance === 'From document' && <FileText size={11} />}
                  {provenance === 'Added by you' && <ShieldAlert size={11} />}
                  {provenance}
                </span>

                <button
                  type="button"
                  className="linkbutton"
                  style={{ fontSize: 12, color: '#5c6048' }}
                  onClick={() => (isEditingConsequence ? setIsEditingConsequence(false) : handleOpenEditConsequence())}
                >
                  {isEditingConsequence ? 'Cancel' : 'Edit consequence'}
                </button>
              </div>
            </div>

            {/* Inline Consequence Editor */}
            {isEditingConsequence ? (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#5c6048' }}>Provenance:</span>
                  {(['From document', 'Added by you', 'Unknown'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      className="secondary"
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        background: consequenceProv === p ? '#292820' : '#eee9df',
                        color: consequenceProv === p ? '#fbf8f0' : '#5c6048',
                        border: 0,
                      }}
                      onClick={() => setConsequenceProv(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={consequenceText}
                  onChange={(e) => {
                    setConsequenceText(e.target.value);
                    if (consequenceProv !== 'Added by you') setConsequenceProv('Added by you');
                  }}
                  placeholder="Describe consequence of missing deadline (late fee, service cutoff, penalty rate)..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cfc7b6' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setIsEditingConsequence(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={handleSaveConsequence}
                  >
                    Save Consequence
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: provenance === 'Unknown' ? '#5c6048' : '#85523f', marginTop: 6, lineHeight: 1.5 }}>
                {task.consequence || 'No documented consequence cited in source document.'}
              </div>
            )}

            <div style={{ fontSize: 11, color: '#686759', marginTop: 6 }}>
              Consequence Engine: Never invents penalties or savings. Grounded in source or user confirmation.
            </div>
          </div>
        </div>

        {/* DEADLINE BACKPLANNER SECTION */}
        {backplan && (
          <div
            style={{
              padding: 16,
              background: backplan.scheduleHealth === 'overrun' ? '#f6ece3' : '#f5f1e8',
              borderRadius: 10,
              border: `1.5px solid ${backplan.scheduleHealth === 'overrun' ? '#cfab93' : '#e3ddcf'}`,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CalendarClock size={18} color={backplan.scheduleHealth === 'overrun' ? '#85523f' : '#5c6048'} />
                <strong style={{ fontSize: 13.5, color: backplan.scheduleHealth === 'overrun' ? '#85523f' : '#5c6048', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Deadline Backplanner
                </strong>
              </div>

              {/* Schedule Health Badge */}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 12,
                  background:
                    backplan.scheduleHealth === 'overrun'
                      ? '#f6ece3'
                      : backplan.scheduleHealth === 'tight'
                      ? '#ead8c8'
                      : '#dce0cb',
                  color:
                    backplan.scheduleHealth === 'overrun'
                      ? '#85523f'
                      : backplan.scheduleHealth === 'tight'
                      ? '#85523f'
                      : '#555d3d',
                  border: `1px solid ${
                    backplan.scheduleHealth === 'overrun'
                      ? '#cfab93'
                      : backplan.scheduleHealth === 'tight'
                      ? '#cfab93'
                      : '#dce0cb'
                  }`,
                }}
              >
                {backplan.scheduleHealth === 'overrun' && `⚠️ Deficit: -${backplan.deficitDays}d (Overrun)`}
                {backplan.scheduleHealth === 'tight' && `Tight schedule`}
                {backplan.scheduleHealth === 'comfortable' && `Comfortable buffer`}
              </span>
            </div>

            {/* Overrun Warning if work doesn't fit */}
            {!backplan.fitsBeforeDeadline && (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#f6ece3',
                  border: '1.5px solid #ab7659',
                  borderRadius: 8,
                  color: '#85523f',
                  fontSize: 13,
                  lineHeight: 1.5,
                  marginBottom: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#85523f' }} />
                <div>
                  <strong>Work no longer fits before deadline!</strong>
                  <div style={{ marginTop: 2 }}>
                    This task requires <strong>{backplan.totalLeadDaysRequired} days</strong> ({backplan.durationDays}d work + {backplan.bufferDays}d buffer), but only <strong>{Math.max(0, backplan.availableCalendarDays)} days</strong> remain before the deadline ({backplan.effectiveDeadline}). The schedule is short by <strong>{backplan.deficitDays} {backplan.deficitDays === 1 ? 'day' : 'days'}</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Recommended Start Date Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
                background: '#fbf8f0',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e3ddcf',
                marginBottom: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase', display: 'block' }}>
                  Recommended Start Date
                </span>
                <span style={{ fontSize: 17, fontWeight: 750, color: backplan.scheduleHealth === 'overrun' ? '#85523f' : '#5c6048' }}>
                  {backplan.recommendedStartDate}
                </span>
                <small style={{ display: 'block', color: '#5c6048', fontSize: 11, marginTop: 1 }}>
                  Working backward from {backplan.effectiveDeadline}
                </small>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase', display: 'block' }}>
                  Effective Deadline
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#292820' }}>
                  {backplan.effectiveDeadline}
                </span>
                <small style={{ display: 'block', color: backplan.constrainedByDownstream ? '#85523f' : '#5c6048', fontSize: 11, marginTop: 1 }}>
                  {backplan.constrainedByDownstream ? `Held by downstream "${backplan.constrainedByDownstream.title}"` : 'Direct due date'}
                </small>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase', display: 'block' }}>
                  Total Lead Time Needed
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#292820' }}>
                  {backplan.totalLeadDaysRequired} days
                </span>
                <small style={{ display: 'block', color: '#5c6048', fontSize: 11, marginTop: 1 }}>
                  {backplan.durationDays}d work + {backplan.bufferDays}d buffer
                </small>
              </div>
            </div>

            {/* Editable Duration, Buffer, and Due Date */}
            <div
              style={{
                background: '#fbf8f0',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e3ddcf',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#292820', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Hourglass size={14} color="#5c6048" />
                Edit Estimated Duration & Buffer Time
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {/* Estimated Duration Input */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#5c6048', display: 'block', marginBottom: 4 }}>
                    Estimated Duration:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={durationInput}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setDurationInput(val);
                        handleSaveBackplanner(val, bufferInput, dueDateInput);
                      }}
                      style={{
                        width: '70px',
                        padding: '5px 8px',
                        border: '1px solid #cfc7b6',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#5c6048' }}>days</span>
                  </div>
                </div>

                {/* Buffer Time Input */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#5c6048', display: 'block', marginBottom: 4 }}>
                    Safety Buffer Time:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={bufferInput}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setBufferInput(val);
                        handleSaveBackplanner(durationInput, val, dueDateInput);
                      }}
                      style={{
                        width: '70px',
                        padding: '5px 8px',
                        border: '1px solid #cfc7b6',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#5c6048' }}>days</span>
                  </div>
                </div>

                {/* Due Date Input (Changing prerequisite date recalculates downstream) */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#5c6048', display: 'block', marginBottom: 4 }}>
                    Due Date (Deadline):
                  </label>
                  <input
                    type="date"
                    value={dueDateInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDueDateInput(val);
                      if (val) {
                        handleSaveBackplanner(durationInput, bufferInput, val);
                      }
                    }}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #cfc7b6',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 550,
                    }}
                  />
                </div>

                {/* Estimated Hands-on Effort (Focus Mode) */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#5c6048', display: 'block', marginBottom: 4 }}>
                    Focus Effort:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={estimatedMinutesInput}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 10);
                        setEstimatedMinutesInput(val);
                        updateObligationEstimatedMinutes(task.id, val);
                        onUpdated();
                      }}
                      style={{
                        width: '65px',
                        padding: '5px 8px',
                        border: '1px solid #cfc7b6',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#5c6048' }}>mins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plain-Language Calculation Explanation */}
            <div
              style={{
                padding: '10px 12px',
                background: '#fbf8f0',
                border: '1px solid #e3ddcf',
                borderRadius: 8,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: '#3c3d30',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                Plain-Language Calculation:
              </div>
              <div>{backplan.plainLanguageExplanation}</div>

              {/* Step-by-step breakdown */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e3ddcf', fontSize: 12, color: '#5c6048' }}>
                <div><strong>1. Target Deadline:</strong> {backplan.calculationBreakdown.deadlineDate} ({backplan.calculationBreakdown.deadlineLabel})</div>
                {backplan.calculationBreakdown.downstreamConstraintNote && (
                  <div style={{ color: '#85523f', paddingLeft: 12 }}>↳ {backplan.calculationBreakdown.downstreamConstraintNote}</div>
                )}
                <div><strong>2. Work Duration:</strong> {backplan.calculationBreakdown.durationLabel}</div>
                <div><strong>3. Safety Buffer:</strong> {backplan.calculationBreakdown.bufferLabel}</div>
                <div><strong>4. Result:</strong> {backplan.calculationBreakdown.recommendedStartLabel}</div>
                <div style={{ fontWeight: 600, color: backplan.fitsBeforeDeadline ? '#555d3d' : '#85523f', marginTop: 2 }}>
                  ↳ {backplan.calculationBreakdown.fitAssessment}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PREREQUISITES MANAGEMENT SECTION */}
        <div style={{ marginTop: 10, borderTop: '1px solid #eee9df', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#292820', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={16} color="#5c6048" />
              Prerequisites (Must be completed first)
            </label>
            <span className="badge" style={{ fontSize: 11 }}>
              {currentPrereqs.length} connected
            </span>
          </div>

          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
            Connect tasks that must be finished before this obligation can begin.
          </p>

          {/* List of current prerequisites */}
          {currentPrereqs.length === 0 ? (
            <div style={{ padding: '12px 14px', background: '#fbf8f0', borderRadius: 8, border: '1px dashed #cfc7b6', fontSize: 13, color: '#5c6048', textAlign: 'center' }}>
              No prerequisites. This task can be started directly.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              {currentPrereqs.map((prereq) => {
                const isPrereqDone = prereq.status === 'completed';
                return (
                  <div
                    key={prereq.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: isPrereqDone ? '#eef0e4' : '#f6ece3',
                      border: isPrereqDone ? '1px solid #dce0cb' : '1px solid #cfab93',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isPrereqDone ? (
                        <CheckCircle2 size={16} color="#555d3d" />
                      ) : (
                        <Lock size={16} color="#85523f" />
                      )}
                      <div>
                        <strong style={{ color: '#292820' }}>{prereq.title}</strong>
                        <span style={{ fontSize: 12, color: '#5c6048', marginLeft: 6 }}>
                          (Due {prereq.dueDate})
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isPrereqDone ? (
                        <span className="badge green" style={{ fontSize: 10.5 }}>Completed</span>
                      ) : (
                        <span className="badge amber" style={{ fontSize: 10.5 }}>Holding up task</span>
                      )}

                      <button
                        type="button"
                        className="linkbutton"
                        style={{ color: '#85523f', padding: 2 }}
                        onClick={() => handleRemovePrerequisite(prereq.id)}
                        title="Remove this dependency"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Prerequisite Controls */}
          {availablePrereqs.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select
                value={selectedPrereqToAdd}
                onChange={(e) => setSelectedPrereqToAdd(e.target.value)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 7,
                  border: '1px solid #cfc7b6',
                  fontSize: 13,
                  background: '#fbf8f0',
                }}
              >
                <option value="">-- Choose prerequisite obligation to add --</option>
                {availablePrereqs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (Due {p.dueDate})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="secondary"
                style={{ padding: '7px 12px', fontSize: 13, flexShrink: 0 }}
                onClick={handleAddPrerequisite}
                disabled={!selectedPrereqToAdd}
              >
                <Plus size={14} />
                Add Prerequisite
              </button>
            </div>
          ) : (
            <small style={{ color: '#5c6048', display: 'block', marginTop: 6 }}>
              All available obligations are already connected or would create a cycle.
            </small>
          )}
        </div>

        {/* DOWNSTREAM DEPENDENTS (WHAT THIS TASK UNLOCKS) */}
        <div style={{ marginTop: 16, borderTop: '1px solid #eee9df', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13.5, fontWeight: 700, color: '#292820', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} color="#5c6048" />
              Downstream Impact (Tasks Waiting on This)
            </label>
            <span className="badge blue" style={{ fontSize: 11 }}>
              {downstreamDependents.length} direct • {transitiveUnlocked.length} total
            </span>
          </div>

          {downstreamDependents.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#5c6048', padding: '6px 0' }}>
              No other tasks currently depend on this obligation.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {downstreamDependents.map((dep) => (
                <div
                  key={dep.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: '#f5f1e8',
                    borderRadius: 6,
                    fontSize: 12.5,
                  }}
                >
                  <ArrowRight size={13} color="#5c6048" />
                  <span style={{ fontWeight: 600, color: '#292820' }}>{dep.title}</span>
                  <span className="muted">(Due {dep.dueDate})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SOURCE EXCERPT REFERENCE */}
        {task.sourceExcerpt && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#5c6048', marginBottom: 4 }}>
              Source Excerpt:
            </div>
            <div className="quote" style={{ fontSize: 12.5, padding: '8px 12px' }}>
              {inrOnly(task.sourceExcerpt)}
            </div>
          </div>
        )}

        <TaskWorkflows task={task} tasks={allTasks} onUpdated={onUpdated} />
        <div className="row spread" style={{ marginTop: 20 }}>
          <button type="button" className="secondary" onClick={() => onOpenChange(false)}>Close</button>
          {task.status === 'completed' && <button type="button" className="secondary" onClick={handleReactivate}>Reopen Task</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

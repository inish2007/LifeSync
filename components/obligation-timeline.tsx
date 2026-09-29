'use client';
import { inrOnly } from '@/lib/currency';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  IndianRupee,
  Building2,
  Trash2,
  CheckCheck,
  PauseCircle,
  Eye,
  Tag,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { Obligation, ObligationStatus } from '@/lib/types';
import { updateObligationStatus, deleteObligation } from '@/lib/storage';
import { getTaskDependencyStatus, getUnresolvedPrerequisites } from '@/lib/graph';
import { calculateUrgency, generateWhyNowExplanation, getConsequenceCategoryLabel, detectConsequenceType } from '@/lib/consequence-engine';
import { Lock, PlayCircle, GitBranch, ShieldAlert, CalendarClock } from 'lucide-react';
import { calculateAllBackplans } from '@/lib/backplanner';

interface ObligationTimelineProps {
  obligations: Obligation[];
  onSelectTask: (task: Obligation) => void;
  onOpenAddModal: () => void;
  onEnterFocusMode?: () => void;
  onRefresh: () => void;
}

export default function ObligationTimeline({
  obligations,
  onSelectTask,
  onOpenAddModal,
  onEnterFocusMode,
  onRefresh,
}: ObligationTimelineProps) {
  const [filter, setFilter] = useState<'all' | 'focus' | 'waiting' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'urgency' | 'dueDate'>('urgency');
  const [activeExcerptId, setActiveExcerptId] = useState<string | null>(null);
  // Sorting: open obligations sorted either by Consequence Engine Urgency rank or Due Date
  const sorted = [...obligations].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (sortBy === 'urgency') {
      const urgA = calculateUrgency(a, obligations).score;
      const urgB = calculateUrgency(b, obligations).score;
      if (urgB !== urgA) return urgB - urgA;
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const filtered = sorted.filter((item) => {
    if (filter === 'focus') {
      return item.status === 'confirmed' || item.status === 'waiting';
    }
    if (filter === 'waiting') return item.status === 'waiting';
    if (filter === 'completed') return item.status === 'completed';
    return true;
  });

  const displayedItems = filter === 'focus' ? filtered.slice(0, 3) : filtered;

  const openWorkflow = (id: string) => {
    const task = obligations.find(t => t.id === id);
    if (task) onSelectTask?.(task);
  };
  const handleToggleComplete = openWorkflow;
  const handleToggleWaiting = openWorkflow;

  const handleReactivate = (id: string) => {
    updateObligationStatus(id, 'confirmed');
    onRefresh();
  };

  const handleDelete = (id: string) => {
    deleteObligation(id);
    onRefresh();
  };

  // Helper for due date badge calculation
  const getDueBadge = (dueDate: string, status: ObligationStatus) => {
    if (status === 'completed') {
      return <span className="badge green"><CheckCircle2 size={12} /> Closed</span>;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="badge red"><AlertTriangle size={12} /> {Math.abs(diffDays)}d overdue</span>;
    }
    if (diffDays === 0) {
      return <span className="badge red"><Clock size={12} /> Due today</span>;
    }
    if (diffDays <= 7) {
      return <span className="badge amber"><Clock size={12} /> Due in {diffDays}d</span>;
    }
    return <span className="badge blue"><Calendar size={12} /> In {diffDays}d ({dueDate})</span>;
  };

  const backplans = calculateAllBackplans(obligations);

  return (
    <div className="panel" style={{ padding: 24 }}>
      {/* Timeline Section Head */}
      <div className="sectionhead" style={{ marginBottom: 14 }}>
        <div>
          <h2>Your timeline</h2>
          <p className="muted" style={{ fontSize: 14, margin: '2px 0 0' }}>
            Confirmed obligations connected in sequence.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {onEnterFocusMode && (
            <button
              type="button"
              className="primary"
              style={{
                padding: '6px 12px',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'linear-gradient(135deg, #5c6048 0%, #686759 100%)',
              }}
              onClick={onEnterFocusMode}
            >
              <Sparkles size={13} />
              🎯 Focus Mode
            </button>
          )}
          <button
            type="button"
            className="secondary"
            style={{ padding: '6px 12px', fontSize: 12.5 }}
            onClick={onOpenAddModal}
          >
            + Add obligation
          </button>
        </div>
      </div>

      {/* Feeling Overwhelmed? Focus Mode Callout */}
      {onEnterFocusMode && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f5f1e8 0%, #eee9df 100%)',
            border: '1.5px solid #e3ddcf',
            borderRadius: 12,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#eee9df',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5c6048',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <strong style={{ color: '#5c6048', fontSize: 13.5 }}>Feeling overwhelmed by too many tasks?</strong>
              <div style={{ fontSize: 12.5, color: '#686759' }}>
                Activate Focus Mode to hide the full timeline and see only the 3 most useful actions for today.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="primary"
            style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 700 }}
            onClick={onEnterFocusMode}
          >
            🎯 Enter Focus Mode
          </button>
        </div>
      )}

      {/* Filter and Sort Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #eee9df', paddingBottom: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filter === 'all' ? '#eee9df' : 'transparent',
              color: filter === 'all' ? '#5c6048' : '#5c6048',
            }}
            onClick={() => setFilter('all')}
          >
            All Timeline ({obligations.length})
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filter === 'focus' ? '#292820' : '#f5f1e8',
              color: filter === 'focus' ? '#fbf8f0' : '#5c6048',
              border: '1px solid #e3ddcf',
            }}
            onClick={() => {
              if (onEnterFocusMode) {
                onEnterFocusMode();
              } else {
                setFilter('focus');
              }
            }}
            title="Switch to Focus Mode"
          >
            <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
            🎯 Focus Mode (Top 3)
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filter === 'waiting' ? '#ead8c8' : 'transparent',
              color: filter === 'waiting' ? '#85523f' : '#5c6048',
            }}
            onClick={() => setFilter('waiting')}
          >
            Waiting ({obligations.filter(o => o.status === 'waiting').length})
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filter === 'completed' ? '#dce0cb' : 'transparent',
              color: filter === 'completed' ? '#555d3d' : '#5c6048',
            }}
            onClick={() => setFilter('completed')}
          >
            Closed Loops ({obligations.filter(o => o.status === 'completed').length})
          </button>
        </div>

        {/* Sort Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: '#5c6048', fontWeight: 600 }}>Sort:</span>
          <button
            type="button"
            style={{
              fontSize: 11.5,
              fontWeight: 650,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: sortBy === 'urgency' ? '#5c6048' : '#e3ddcf',
              background: sortBy === 'urgency' ? '#f5f1e8' : '#fbf8f0',
              color: sortBy === 'urgency' ? '#5c6048' : '#5c6048',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={() => setSortBy('urgency')}
            title="Rank by Consequence severity, deadline proximity, and dependency unlock impact"
          >
            <ShieldAlert size={12} />
            Urgency Rank
          </button>
          <button
            type="button"
            style={{
              fontSize: 11.5,
              fontWeight: 650,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: sortBy === 'dueDate' ? '#5c6048' : '#e3ddcf',
              background: sortBy === 'dueDate' ? '#f5f1e8' : '#fbf8f0',
              color: sortBy === 'dueDate' ? '#5c6048' : '#5c6048',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={() => setSortBy('dueDate')}
          >
            <Calendar size={12} />
            Due Date
          </button>
        </div>
      </div>

      {/* Obligations List */}
      {displayedItems.length === 0 ? (
        <div className="empty">
          <FileText size={28} color="#5c6048" />
          <h3>No obligations in this view.</h3>
          <p className="muted">
            Add a bill, renewal notice, or appointment email. LifeLoop will extract what needs doing.
          </p>
          <button type="button" className="primary" style={{ marginTop: 12 }} onClick={onOpenAddModal}>
            Add an obligation
          </button>
        </div>
      ) : (
        <div>
          {displayedItems.map((item, index) => {
            const isCompleted = item.status === 'completed';
            const isWaiting = item.status === 'waiting';
            const depStatus = getTaskDependencyStatus(item, obligations);
            const unresolved = getUnresolvedPrerequisites(item, obligations);
            const urgency = calculateUrgency(item, obligations);
            const whyNow = generateWhyNowExplanation(item, obligations);
            const prov = item.consequenceProvenance || 'From document';
            const consequenceCat = getConsequenceCategoryLabel(item.consequenceType || detectConsequenceType(item.consequence));
            const plan = backplans.get(item.id);

            return (
              <div
                key={item.id}
                className="task"
                style={{
                  opacity: isCompleted ? 0.65 : 1,
                  borderBottom: index === displayedItems.length - 1 ? 'none' : '1px solid #eee9df',
                }}
              >
                {/* Task Icon / Checkbox */}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => (isCompleted ? handleReactivate(item.id) : handleToggleComplete(item.id))}
                  title={isCompleted ? 'Reopen loop' : 'Close this loop'}
                >
                  <div
                    className="taskicon"
                    style={{
                      background: isCompleted ? '#dce0cb' : depStatus === 'blocked' ? '#f6ece3' : isWaiting ? '#f6ece3' : '#f5f1e8',
                      color: isCompleted ? '#555d3d' : depStatus === 'blocked' ? '#85523f' : isWaiting ? '#85523f' : '#5c6048',
                    }}
                  >
                    {isCompleted ? <CheckCheck size={20} /> : depStatus === 'blocked' ? <Lock size={19} /> : isWaiting ? <PauseCircle size={20} /> : <Calendar size={20} />}
                  </div>
                </button>

                {/* Task Details */}
                <div className="taskmain">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong
                          style={{
                            fontSize: 16,
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            color: '#292820',
                            cursor: 'pointer',
                          }}
                          onClick={() => onSelectTask?.(item)}
                          title="Click to view details and dependencies"
                        >
                          {item.title}
                        </strong>
                        <span className="badge" style={{ fontSize: 11 }}>
                          {item.category}
                        </span>

                        {/* Dependency Status Badge */}
                        {!isCompleted && depStatus === 'blocked' && (
                          <span className="badge red" style={{ fontSize: 11, fontWeight: 700 }}>
                            <Lock size={11} /> Blocked
                          </span>
                        )}
                        {!isCompleted && depStatus === 'ready' && (
                          <span className="badge blue" style={{ fontSize: 11, fontWeight: 700 }}>
                            <PlayCircle size={11} /> Ready
                          </span>
                        )}

                        {getDueBadge(item.dueDate, item.status)}

                        {/* Consequence Engine Urgency Badge */}
                        {!isCompleted && (
                          <span
                            className={`badge ${urgency.badgeColor}`}
                            style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={`Consequence Engine Urgency: ${urgency.reason} (Score: ${urgency.score})`}
                          >
                            <ShieldAlert size={11} /> {urgency.badgeLabel}
                          </span>
                        )}

                        {/* Backplanner Recommended Start Date */}
                        {!isCompleted && plan && (
                          <span
                            className={`badge ${plan.scheduleHealth === 'overrun' ? 'red' : 'blue'}`}
                            style={{ fontSize: 11, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={`Deadline Backplanner: Working backward requires starting by ${plan.recommendedStartDate} (${plan.totalLeadDaysRequired} lead days)`}
                          >
                            <CalendarClock size={11} /> Start by {plan.recommendedStartDate}
                          </span>
                        )}

                        {/* Overrun Warning Pill */}
                        {!isCompleted && plan?.scheduleHealth === 'overrun' && (
                          <span
                            className="badge red"
                            style={{ fontSize: 11, fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <AlertTriangle size={11} /> Overrun (-{plan.deficitDays}d)
                          </span>
                        )}
                      </div>

                      {/* Payee and Amount */}
                      <div className="taskmeta" style={{ marginTop: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={13} />
                          {item.payee}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#292820' }}>
                          <IndianRupee size={13} />
                          {inrOnly(item.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '4px 8px', fontSize: 11.5 }}
                        onClick={() => onSelectTask?.(item)}
                        title="Manage task dependencies"
                      >
                        <GitBranch size={12} />
                        Dependencies ({item.dependsOnIds?.length || 0})
                      </button>

                      {!isCompleted && !isWaiting && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 8px', fontSize: 11.5 }}
                          onClick={() => handleToggleWaiting(item.id)}
                          title="Mark as waiting on someone else"
                        >
                          Wait on step
                        </button>
                      )}
                      {isWaiting && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 8px', fontSize: 11.5, color: '#5c6048' }}
                          onClick={() => handleReactivate(item.id)}
                        >
                          Resume
                        </button>
                      )}
                      <button
                        type="button"
                        className="linkbutton"
                        style={{ padding: 4, color: '#85523f' }}
                        onClick={() => handleDelete(item.id)}
                        title="Delete obligation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Blocked by prerequisite warning */}
                  {depStatus === 'blocked' && unresolved.length > 0 && (
                    <div
                      style={{
                        padding: '6px 10px',
                        background: '#f6ece3',
                        border: '1px solid #ead8c8',
                        borderRadius: 6,
                        fontSize: 12.5,
                        color: '#85523f',
                        marginTop: 6,
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <Lock size={12} />
                      <span>
                        <strong>Blocked by:</strong> {unresolved.map(u => u.title).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Required Action */}
                  <p style={{ margin: '6px 0', fontSize: 14, color: '#3c3d30' }}>
                    <strong>Action:</strong> {inrOnly(item.requiredAction)}
                  </p>

                  {/* Waiting note if waiting */}
                  {isWaiting && item.waitingNote && (
                    <div className="notice" style={{ padding: '6px 12px', margin: '6px 0', fontSize: 12.5 }}>
                      <strong>Waiting:</strong> {item.waitingNote}
                    </div>
                  )}

                  {/* Completion proof note if completed */}
                  {isCompleted && item.completionProofNote && (
                    <div className="completion" style={{ padding: '6px 12px', margin: '6px 0', fontSize: 12.5 }}>
                      <strong>Closed loop note:</strong> {item.completionProofNote}
                    </div>
                  )}

                  <details className="quiet-details"><summary>Why this matters & source</summary>
                  {/* Documented Consequence Section */}
                  {!isCompleted && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 12px',
                        background: prov === 'Unknown' ? '#fbf8f0' : '#f6ece3',
                        border: `1px solid ${prov === 'Unknown' ? '#e3ddcf' : '#ead8c8'}`,
                        borderRadius: 7,
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShieldAlert size={13} color={prov === 'Unknown' ? '#5c6048' : '#85523f'} />
                          <span style={{ fontWeight: 700, color: prov === 'Unknown' ? '#5c6048' : '#85523f', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Documented Consequence
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 10,
                              background: prov === 'From document' ? '#dce0cb' : prov === 'Added by you' ? '#eee9df' : '#f5f1e8',
                              color: prov === 'From document' ? '#555d3d' : prov === 'Added by you' ? '#786252' : '#5c6048',
                              border: `1px solid ${prov === 'From document' ? '#dce0cb' : prov === 'Added by you' ? '#e3ddcf' : '#cfc7b6'}`,
                            }}
                          >
                            {prov === 'From document' && '✓ From document'}
                            {prov === 'Added by you' && '👤 Added by you'}
                            {prov === 'Unknown' && '? Unknown'}
                          </span>
                        </div>

                        <span style={{ fontSize: 11, color: '#5c6048', fontWeight: 600 }}>
                          {consequenceCat}
                        </span>
                      </div>

                      <div style={{ color: '#292820', fontSize: 13, lineHeight: 1.4 }}>
                        {item.consequence || 'No documented penalty or consequence recorded in source.'}
                      </div>
                    </div>
                  )}

                  {/* "Why now?" Contextual Explanation */}
                  {!isCompleted && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: '7px 11px',
                        background: '#eef0e4',
                        border: '1px solid #dce0cb',
                        borderRadius: 7,
                        fontSize: 12.5,
                        color: '#555d3d',
                        display: 'flex',
                        gap: 7,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0, color: '#555d3d' }} />
                      <div style={{ lineHeight: 1.4 }}>
                        <strong style={{ color: '#555d3d', marginRight: 4 }}>Why now?</strong>
                        {whyNow}
                      </div>
                    </div>
                  )}

                  {/* Deadline Backplanner Overrun Warning Box */}
                  {!isCompleted && plan && !plan.fitsBeforeDeadline && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: '7px 11px',
                        background: '#f6ece3',
                        border: '1px solid #cfab93',
                        borderRadius: 7,
                        fontSize: 12.5,
                        color: '#85523f',
                        display: 'flex',
                        gap: 7,
                        alignItems: 'flex-start',
                      }}
                    >
                      <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0, color: '#85523f' }} />
                      <div style={{ lineHeight: 1.4 }}>
                        <strong>Schedule Overrun Warning:</strong> Work requires {plan.totalLeadDaysRequired} days ({plan.durationDays}d work + {plan.bufferDays}d buffer), but only {Math.max(0, plan.availableCalendarDays)} days remain before deadline ({plan.effectiveDeadline}). Work is in deficit by <strong>{plan.deficitDays} {plan.deficitDays === 1 ? 'day' : 'days'}</strong> — start immediately or compress buffer.
                      </div>
                    </div>
                  )}

                  {/* Source Excerpt Toggle */}
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="linkbutton"
                      style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5c6048' }}
                      onClick={() => setActiveExcerptId(activeExcerptId === item.id ? null : item.id)}
                    >
                      <FileText size={12} />
                      {activeExcerptId === item.id ? 'Hide source excerpt' : 'View source excerpt'}
                    </button>

                    {activeExcerptId === item.id && (
                      <div className="quote" style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Extracted Source Excerpt ({item.sourceDocument?.name || 'Document'}):
                        </div>
                        {inrOnly(item.sourceExcerpt)}
                      </div>
                    )}
                  </div>

                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

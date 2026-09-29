'use client';
import { inrOnly } from '@/lib/currency';

import { useState } from 'react';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Hourglass,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  Building2,
  Calendar
} from 'lucide-react';
import { Obligation } from '@/lib/types';
import { calculateAllBackplans, daysDifference, getReferenceToday } from '@/lib/backplanner';
import { updateObligationBackplanSettings, updateObligationDueDate } from '@/lib/storage';
import { getTaskDependencyStatus } from '@/lib/graph';

interface DeadlineBackplannerViewProps {
  obligations: Obligation[];
  onSelectTask?: (task: Obligation) => void;
  onRefresh: () => void;
}

export default function DeadlineBackplannerView({
  obligations,
  onSelectTask,
  onRefresh,
}: DeadlineBackplannerViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'overruns' | 'tight' | 'comfortable'>('all');
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null);

  const backplans = calculateAllBackplans(obligations);
  const todayStr = getReferenceToday();

  // Summary counts
  const allResults = Array.from(backplans.values());
  const overrunTasks = obligations.filter(o => backplans.get(o.id)?.scheduleHealth === 'overrun' && o.status !== 'completed');
  const tightTasks = obligations.filter(o => backplans.get(o.id)?.scheduleHealth === 'tight' && o.status !== 'completed');
  const comfortableTasks = obligations.filter(o => backplans.get(o.id)?.scheduleHealth === 'comfortable' && o.status !== 'completed');
  const completedTasks = obligations.filter(o => o.status === 'completed');

  // Filter tasks
  const displayedTasks = obligations.filter(o => {
    if (o.status === 'completed') return filterMode === 'all';
    const plan = backplans.get(o.id);
    if (!plan) return true;
    if (filterMode === 'overruns') return plan.scheduleHealth === 'overrun';
    if (filterMode === 'tight') return plan.scheduleHealth === 'tight';
    if (filterMode === 'comfortable') return plan.scheduleHealth === 'comfortable';
    return true;
  });

  // Sort: overruns first, then earliest recommended start date
  const sortedTasks = [...displayedTasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;

    const planA = backplans.get(a.id);
    const planB = backplans.get(b.id);
    if (planA?.scheduleHealth === 'overrun' && planB?.scheduleHealth !== 'overrun') return -1;
    if (planA?.scheduleHealth !== 'overrun' && planB?.scheduleHealth === 'overrun') return 1;

    const startA = planA?.recommendedStartDate || a.dueDate;
    const startB = planB?.recommendedStartDate || b.dueDate;
    return startA.localeCompare(startB);
  });

  const handleAdjustDuration = (taskId: string, currentDuration: number, currentBuffer: number, delta: number) => {
    const nextVal = Math.max(1, currentDuration + delta);
    updateObligationBackplanSettings(taskId, nextVal, currentBuffer);
    onRefresh();
  };

  const handleAdjustBuffer = (taskId: string, currentDuration: number, currentBuffer: number, delta: number) => {
    const nextVal = Math.max(0, currentBuffer + delta);
    updateObligationBackplanSettings(taskId, currentDuration, nextVal);
    onRefresh();
  };

  const handleDateChange = (taskId: string, newDueDate: string) => {
    if (!newDueDate) return;
    updateObligationDueDate(taskId, newDueDate);
    onRefresh();
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* BACKPLANNER HERO OVERVIEW */}
      <div
        style={{
          background: 'linear-gradient(135deg, #292820 0%, #3c3d30 100%)',
          color: '#fbf8f0',
          padding: '24px 26px',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 18px rgba(13, 30, 61, 0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255, 255, 255, 0.18)',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: '#cfc7b6',
                }}
              >
                <CalendarClock size={14} color="#cfc7b6" />
                Deadline Backplanner
              </span>

              {overrunTasks.length > 0 && (
                <span
                  style={{
                    background: '#85523f',
                    color: '#fbf8f0',
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <AlertTriangle size={12} />
                  {overrunTasks.length} Schedule {overrunTasks.length === 1 ? 'Overrun' : 'Overruns'}
                </span>
              )}
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 750, color: '#fbf8f0', margin: '4px 0 6px' }}>
              Backward Scheduling & Safety Margin Engine
            </h2>
            <p style={{ color: '#eee9df', fontSize: 14, margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
              LifeLoop works backward from hard deadlines through prerequisite chains. It calculates the latest date you must start each task to preserve your estimated duration and safety buffer without missing downstream commitments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="secondary"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fbf8f0', border: 0, fontSize: 12.5 }}
              onClick={onRefresh}
            >
              <RefreshCw size={13} /> Recalculate
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid rgba(255, 255, 255, 0.14)',
          }}
        >
          <div
            style={{
              cursor: 'pointer',
              background: filterMode === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
              padding: '10px 14px',
              borderRadius: 8,
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFilterMode('all')}
          >
            <span style={{ fontSize: 11.5, color: '#e3ddcf', display: 'block' }}>All Obligations</span>
            <strong style={{ fontSize: 20, color: '#fbf8f0' }}>{obligations.length}</strong>
          </div>

          <div
            style={{
              cursor: 'pointer',
              background: filterMode === 'overruns' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(255,255,255,0.08)',
              padding: '10px 14px',
              borderRadius: 8,
              border: overrunTasks.length > 0 ? '1px solid rgba(248, 113, 113, 0.5)' : 'none',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFilterMode('overruns')}
          >
            <span style={{ fontSize: 11.5, color: '#cfab93', display: 'block' }}>⚠️ Schedule Overruns</span>
            <strong style={{ fontSize: 20, color: '#cfab93' }}>{overrunTasks.length}</strong>
          </div>

          <div
            style={{
              cursor: 'pointer',
              background: filterMode === 'tight' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.08)',
              padding: '10px 14px',
              borderRadius: 8,
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFilterMode('tight')}
          >
            <span style={{ fontSize: 11.5, color: '#cfab93', display: 'block' }}>Tight Schedules</span>
            <strong style={{ fontSize: 20, color: '#cfab93' }}>{tightTasks.length}</strong>
          </div>

          <div
            style={{
              cursor: 'pointer',
              background: filterMode === 'comfortable' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255,255,255,0.08)',
              padding: '10px 14px',
              borderRadius: 8,
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFilterMode('comfortable')}
          >
            <span style={{ fontSize: 11.5, color: '#b3b99c', display: 'block' }}>Comfortable Buffer</span>
            <strong style={{ fontSize: 20, color: '#b3b99c' }}>{comfortableTasks.length}</strong>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filterMode === 'all' ? '#eee9df' : '#fbf8f0',
              color: filterMode === 'all' ? '#5c6048' : '#5c6048',
              border: '1px solid #e3ddcf',
            }}
            onClick={() => setFilterMode('all')}
          >
            All Tasks ({obligations.length})
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filterMode === 'overruns' ? '#f6ece3' : '#fbf8f0',
              color: filterMode === 'overruns' ? '#85523f' : '#5c6048',
              border: '1px solid #cfab93',
            }}
            onClick={() => setFilterMode('overruns')}
          >
            ⚠️ Overruns ({overrunTasks.length})
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filterMode === 'tight' ? '#ead8c8' : '#fbf8f0',
              color: filterMode === 'tight' ? '#85523f' : '#5c6048',
              border: '1px solid #cfab93',
            }}
            onClick={() => setFilterMode('tight')}
          >
            Tight ({tightTasks.length})
          </button>
          <button
            type="button"
            className="taskbutton"
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '4px 10px',
              borderRadius: 6,
              background: filterMode === 'comfortable' ? '#dce0cb' : '#fbf8f0',
              color: filterMode === 'comfortable' ? '#555d3d' : '#5c6048',
              border: '1px solid #dce0cb',
            }}
            onClick={() => setFilterMode('comfortable')}
          >
            Comfortable ({comfortableTasks.length})
          </button>
        </div>

        <span style={{ fontSize: 12, color: '#5c6048' }}>
          Reference date: <strong>{todayStr}</strong> (today)
        </span>
      </div>

      {/* BACKPLANNER CARDS LIST */}
      <div style={{ display: 'grid', gap: 14 }}>
        {sortedTasks.length === 0 ? (
          <div className="panel" style={{ padding: 36, textAlign: 'center' }}>
            <CalendarClock size={32} color="#5c6048" style={{ margin: '0 auto 8px' }} />
            <h3>No tasks in this filter view</h3>
            <p className="muted">All your obligations have active schedules.</p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const plan = backplans.get(task.id);
            if (!plan) return null;

            const isCompleted = task.status === 'completed';
            const isOverrun = plan.scheduleHealth === 'overrun' && !isCompleted;
            const isTight = plan.scheduleHealth === 'tight' && !isCompleted;
            const daysToStart = daysDifference(todayStr, plan.recommendedStartDate);
            const isExpanded = expandedExplanationId === task.id;

            return (
              <div
                key={task.id}
                className="panel"
                style={{
                  padding: 18,
                  border: isOverrun
                    ? '2px solid #ab7659'
                    : isTight
                    ? '1.5px solid #85523f'
                    : '1px solid #e3ddcf',
                  background: isOverrun
                    ? '#fbf8f0'
                    : isCompleted
                    ? '#fbf8f0'
                    : '#fbf8f0',
                  opacity: isCompleted ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* CARD HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          fontSize: 16,
                          color: '#292820',
                          cursor: 'pointer',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}
                        onClick={() => onSelectTask?.(task)}
                        title="Click to view task details and edit dependencies"
                      >
                        {task.title}
                      </strong>

                      <span className="badge" style={{ fontSize: 11 }}>
                        {task.category}
                      </span>

                      {/* Schedule Health Pill */}
                      {isCompleted ? (
                        <span className="badge green" style={{ fontSize: 11, fontWeight: 700 }}>
                          <CheckCircle2 size={11} /> Completed
                        </span>
                      ) : isOverrun ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 750,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: '#f6ece3',
                            color: '#85523f',
                            border: '1px solid #cfab93',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <AlertTriangle size={12} />
                          ⚠️ Overrun: Deficit -{plan.deficitDays}d
                        </span>
                      ) : isTight ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: '#ead8c8',
                            color: '#85523f',
                            border: '1px solid #cfab93',
                          }}
                        >
                          Tight schedule
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: '#dce0cb',
                            color: '#555d3d',
                            border: '1px solid #dce0cb',
                          }}
                        >
                          Comfortable buffer
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12.5, color: '#5c6048', marginTop: 4, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Building2 size={13} />
                        {task.payee}
                      </span>
                      <span>•</span>
                      <span>
                        Action: <strong>{inrOnly(task.requiredAction)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* QUICK DETAIL BUTTON */}
                  <button
                    type="button"
                    className="secondary"
                    style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
                    onClick={() => onSelectTask?.(task)}
                  >
                    Manage Task <ChevronRight size={13} />
                  </button>
                </div>

                {/* OVERRUN CRITICAL WARNING BANNER */}
                {isOverrun && (
                  <div
                    style={{
                      margin: '12px 0',
                      padding: '10px 14px',
                      background: '#f6ece3',
                      border: '1.5px solid #ab7659',
                      borderRadius: 8,
                      color: '#85523f',
                      fontSize: 13,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <AlertTriangle size={18} style={{ color: '#85523f', flexShrink: 0, marginTop: 1 }} />
                    <div style={{ lineHeight: 1.5 }}>
                      <strong>Work no longer fits before deadline!</strong>
                      <div>
                        Requires <strong>{plan.totalLeadDaysRequired} days</strong> ({plan.durationDays}d duration + {plan.bufferDays}d buffer), but only <strong>{Math.max(0, plan.availableCalendarDays)} calendar days</strong> remain before {plan.effectiveDeadline}. Schedule has a <strong>{plan.deficitDays} day deficit</strong>. Compress your safety buffer or request an extension.
                      </div>
                    </div>
                  </div>
                )}

                {/* BACKPLAN TIMELINE VISUAL STRIP */}
                <div
                  style={{
                    margin: '12px 0',
                    padding: '12px 14px',
                    background: '#fbf8f0',
                    borderRadius: 8,
                    border: '1px solid #e3ddcf',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                  }}
                >
                  {/* Recommended Start */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase' }}>
                      Recommended Start
                    </span>
                    <div style={{ fontSize: 17, fontWeight: 750, color: isOverrun ? '#85523f' : '#5c6048', marginTop: 2 }}>
                      {plan.recommendedStartDate}
                    </div>
                    <small style={{ color: '#5c6048', fontSize: 11.5 }}>
                      {isCompleted
                        ? 'Task completed'
                        : daysToStart < 0
                        ? `Overdue by ${Math.abs(daysToStart)}d`
                        : daysToStart === 0
                        ? 'Must start today!'
                        : `Start in ${daysToStart} days`}
                    </small>
                  </div>

                  {/* Effective Deadline */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase' }}>
                      Effective Deadline
                    </span>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#292820', marginTop: 2 }}>
                      {plan.effectiveDeadline}
                    </div>
                    <small style={{ color: plan.constrainedByDownstream ? '#85523f' : '#5c6048', fontSize: 11.5 }}>
                      {plan.constrainedByDownstream
                        ? `Prereq for "${plan.constrainedByDownstream.title}"`
                        : `Direct due date`}
                    </small>
                  </div>

                  {/* Total Lead Time */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase' }}>
                      Required Lead Time
                    </span>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#292820', marginTop: 2 }}>
                      {plan.totalLeadDaysRequired} days
                    </div>
                    <small style={{ color: '#5c6048', fontSize: 11.5 }}>
                      {plan.durationDays}d work + {plan.bufferDays}d buffer
                    </small>
                  </div>

                  {/* Available Time */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#5c6048', textTransform: 'uppercase' }}>
                      Time Available
                    </span>
                    <div style={{ fontSize: 17, fontWeight: 700, color: plan.availableCalendarDays < plan.totalLeadDaysRequired ? '#85523f' : '#555d3d', marginTop: 2 }}>
                      {plan.availableCalendarDays} days
                    </div>
                    <small style={{ color: '#5c6048', fontSize: 11.5 }}>
                      From today ({todayStr})
                    </small>
                  </div>
                </div>

                {/* EDITABLE DURATION, BUFFER & DUE DATE CONTROLS */}
                {!isCompleted && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 16,
                      padding: '8px 12px',
                      background: '#fbf8f0',
                      border: '1px solid #eee9df',
                      borderRadius: 8,
                      fontSize: 12.5,
                    }}
                  >
                    {/* Duration Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#5c6048', fontWeight: 600 }}>Work Duration:</span>
                      <button
                        type="button"
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          borderRadius: 4,
                          border: '1px solid #cfc7b6',
                          background: '#fbf8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => handleAdjustDuration(task.id, plan.durationDays, plan.bufferDays, -1)}
                        title="Decrease estimated duration by 1 day"
                      >
                        <Minus size={11} />
                      </button>
                      <strong style={{ minWidth: 42, textAlign: 'center', color: '#292820' }}>
                        {plan.durationDays}d
                      </strong>
                      <button
                        type="button"
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          borderRadius: 4,
                          border: '1px solid #cfc7b6',
                          background: '#fbf8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => handleAdjustDuration(task.id, plan.durationDays, plan.bufferDays, 1)}
                        title="Increase estimated duration by 1 day"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Buffer Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#5c6048', fontWeight: 600 }}>Safety Buffer:</span>
                      <button
                        type="button"
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          borderRadius: 4,
                          border: '1px solid #cfc7b6',
                          background: '#fbf8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => handleAdjustBuffer(task.id, plan.durationDays, plan.bufferDays, -1)}
                        title="Decrease buffer margin by 1 day"
                      >
                        <Minus size={11} />
                      </button>
                      <strong style={{ minWidth: 42, textAlign: 'center', color: '#292820' }}>
                        {plan.bufferDays}d
                      </strong>
                      <button
                        type="button"
                        style={{
                          width: 22,
                          height: 22,
                          padding: 0,
                          borderRadius: 4,
                          border: '1px solid #cfc7b6',
                          background: '#fbf8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => handleAdjustBuffer(task.id, plan.durationDays, plan.bufferDays, 1)}
                        title="Increase buffer margin by 1 day"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Edit Due Date directly */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#5c6048', fontWeight: 600 }}>Due Date:</span>
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => handleDateChange(task.id, e.target.value)}
                        style={{
                          padding: '3px 6px',
                          border: '1px solid #cfc7b6',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                        title="Change prerequisite date to automatically recalculate downstream recommendations"
                      />
                    </div>
                  </div>
                )}

                {/* PLAIN LANGUAGE EXPLANATION BOX */}
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    background: '#eef0e4',
                    border: '1px solid #dce0cb',
                    borderRadius: 6,
                    fontSize: 12.5,
                    color: '#555d3d',
                    lineHeight: 1.4,
                  }}
                >
                  <strong style={{ color: '#555d3d', marginRight: 4 }}>Calculation Rationale:</strong>
                  {plan.plainLanguageExplanation}

                  {/* Toggle Step-by-Step Details */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="linkbutton"
                      style={{ fontSize: 11.5, color: '#555d3d', fontWeight: 600 }}
                      onClick={() => setExpandedExplanationId(isExpanded ? null : task.id)}
                    >
                      {isExpanded ? 'Hide mathematical breakdown ▲' : 'Show step-by-step breakdown ▼'}
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: 8,
                          background: '#fbf8f0',
                          borderRadius: 6,
                          border: '1px solid #dce0cb',
                          fontSize: 12,
                          color: '#3c3d30',
                          display: 'grid',
                          gap: 3,
                        }}
                      >
                        <div>
                          <strong>1. Baseline Deadline:</strong> {plan.calculationBreakdown.deadlineDate} ({plan.calculationBreakdown.deadlineLabel})
                        </div>
                        {plan.calculationBreakdown.downstreamConstraintNote && (
                          <div style={{ color: '#85523f', paddingLeft: 10 }}>
                            ↳ {plan.calculationBreakdown.downstreamConstraintNote}
                          </div>
                        )}
                        <div>
                          <strong>2. Estimated Work:</strong> {plan.calculationBreakdown.durationLabel}
                        </div>
                        <div>
                          <strong>3. Safety Buffer:</strong> {plan.calculationBreakdown.bufferLabel}
                        </div>
                        <div>
                          <strong>4. Recommended Start:</strong> {plan.calculationBreakdown.recommendedStartLabel}
                        </div>
                        <div style={{ fontWeight: 650, color: plan.fitsBeforeDeadline ? '#555d3d' : '#85523f' }}>
                          ↳ {plan.calculationBreakdown.fitAssessment}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

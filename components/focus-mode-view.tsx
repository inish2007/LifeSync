'use client';

import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  PlayCircle,
  Building2,
  DollarSign,
  Calendar,
  CalendarClock,
  ShieldAlert,
  ChevronRight,
  Zap,
  CheckCheck,
  Check,
  Coffee,
  HelpCircle,
  Timer
} from 'lucide-react';
import { Obligation } from '@/lib/types';
import {
  calculateFocusPriorities,
  FocusRecommendation,
  formatEstimatedTime,
  getEffortTier
} from '@/lib/focus-mode';
import { EnergyStepsView } from '@/components/workflow-views';
import { getConsequenceCategoryLabel, detectConsequenceType } from '@/lib/consequence-engine';

interface FocusModeViewProps {
  obligations: Obligation[];
  onExitFocusMode: () => void;
  onSelectTask: (task: Obligation) => void;
  onRefresh: () => void;
}

export default function FocusModeView({
  obligations,
  onExitFocusMode,
  onSelectTask,
}: FocusModeViewProps) {
  // Calculate top 3 actions and critical overdue tasks
  const { topThree, criticalOverdueTasks, allActiveCount } = calculateFocusPriorities(obligations);

  // Compute total focus time for top 3 actions
  const totalFocusMinutes = topThree.reduce((acc, curr) => acc + curr.estimatedTimeMinutes, 0);

  const handleStartComplete = (taskId: string) => {
    const task = obligations.find(t => t.id === taskId);
    if (task) onSelectTask(task);
  };

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 940, margin: '0 auto', paddingBottom: 40 }}>
      {/* FOCUS MODE HERO BANNER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #292820 0%, #3c3d30 60%, #3c3d30 100%)',
          color: '#fbf8f0',
          borderRadius: 16,
          padding: '28px 32px',
          boxShadow: '0 8px 30px rgba(50,44,33, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255, 255, 255, 0.18)',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={13} color="#cfc7b6" />
                Focus Mode Active
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.75)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Coffee size={13} />
                Distraction-Free
              </span>
            </div>

            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '6px 0 10px', letterSpacing: '-0.5px' }}>
              Feeling overwhelmed? Breathe. Here are your 3 actions for today.
            </h2>
            <p style={{ margin: 0, fontSize: 14.5, color: 'rgba(255, 255, 255, 0.88)', lineHeight: 1.55 }}>
              LifeLoop filtered out all background clutter. These 3 tasks are prioritized using deadline proximity,
              documented consequence severity, dependency unlock power, and quick-win effort.
            </p>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.12)', padding: '5px 12px', borderRadius: 8 }}>
                <Timer size={14} color="#b1aa97" />
                <span>Est. total focus time: <strong>~{formatEstimatedTime(totalFocusMinutes)}</strong></span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.12)', padding: '5px 12px', borderRadius: 8 }}>
                <CheckCircle2 size={14} color="#777d55" />
                <span>{allActiveCount} total active obligations ({Math.max(0, allActiveCount - topThree.length)} safely stowed away)</span>
              </div>
            </div>
          </div>

          {/* EXIT FOCUS MODE BUTTON */}
          <button
            type="button"
            onClick={onExitFocusMode}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#fbf8f0',
              color: '#292820',
              border: 0,
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Return to the full timeline and all views"
          >
            <ArrowLeft size={16} />
            Return to Full Timeline
          </button>
        </div>
      </div>

      <EnergyStepsView obligations={obligations} onSelectTask={onSelectTask} />

      {/* CRITICAL OVERDUE TASKS BANNER (RULE: NEVER HIDE CRITICAL OVERDUE TASKS!) */}
      {criticalOverdueTasks.length > 0 && (
        <div
          style={{
            background: '#f6ece3',
            border: '1.5px solid #ead8c8',
            borderRadius: 14,
            padding: '20px 24px',
            boxShadow: '0 4px 14px rgba(133,82,63, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#f6ece3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#85523f',
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#85523f' }}>
                  Critical Overdue Tasks ({criticalOverdueTasks.length}) — Never Hidden
                </h3>
                <span
                  style={{
                    background: '#85523f',
                    color: '#fbf8f0',
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 12,
                    textTransform: 'uppercase',
                  }}
                >
                  Requires Immediate Attention
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#85523f' }}>
                LifeLoop never hides overdue obligations, even in Focus Mode. Clear these immediately to stop escalating late surcharges and service cutoff orders.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {criticalOverdueTasks.map(rec => {
              const task = rec.task;
              const prov = task.consequenceProvenance || 'From document';
              return (
                <div
                  key={task.id}
                  style={{
                    background: '#fbf8f0',
                    border: '1px solid #cfab93',
                    borderRadius: 10,
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="badge red" style={{ fontWeight: 800, fontSize: 11 }}>
                        ⚠️ Overdue by {rec.daysOverdue} {rec.daysOverdue === 1 ? 'day' : 'days'}
                      </span>
                      <span className="badge" style={{ fontSize: 11 }}>
                        {task.category}
                      </span>
                      <span style={{ fontSize: 12, color: '#5c6048' }}>
                        Due was {task.dueDate}
                      </span>
                    </div>

                    <h4 style={{ margin: '2px 0 4px', fontSize: 16, fontWeight: 750, color: '#292820' }}>
                      {task.title}
                    </h4>

                    <p style={{ margin: '3px 0 6px', fontSize: 13, color: '#3c3d30' }}>
                      <strong>Action:</strong> {task.requiredAction}
                    </p>

                    {task.consequence && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#85523f',
                          background: '#f6ece3',
                          border: '1px solid #f6ece3',
                          borderRadius: 6,
                          padding: '4px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AlertTriangle size={11} />
                        <span><strong>Documented Consequence [{prov}]:</strong> {task.consequence}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#5c6048' }}>
                      <div>⏱️ {rec.estimatedTimeDisplay}</div>
                      <div style={{ fontWeight: 700, color: '#292820' }}>{task.amount}</div>
                    </div>

                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#85523f', borderColor: '#85523f', padding: '7px 14px', fontSize: 12.5 }}
                      onClick={() => handleStartComplete(task.id)}
                    >
                      <Check size={14} /> Resolve & Close Loop
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ padding: '7px 12px', fontSize: 12.5 }}
                      onClick={() => onSelectTask(task)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TOP THREE MOST USEFUL ACTIONS FOR TODAY */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#292820' }}>
              Your 3 Most Useful Actions For Today
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13.5, color: '#5c6048' }}>
              Take them in order. Each action includes an estimated time and why it matters right now.
            </p>
          </div>

          <div style={{ fontSize: 12.5, color: '#5c6048', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#555d3d' }} />
              Quick Win (&le;15m)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5c6048' }} />
              Moderate (&le;35m)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#85523f' }} />
              Deep Focus (45m+)
            </span>
          </div>
        </div>

        {topThree.length === 0 ? (
          <div
            style={{
              background: '#fbf8f0',
              border: '1.5px dashed #cfc7b6',
              borderRadius: 14,
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <CheckCircle2 size={36} color="#555d3d" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: 18, color: '#292820' }}>All active obligations are closed!</h3>
            <p style={{ color: '#5c6048', fontSize: 14, maxWidth: 440, margin: '4px auto 16px' }}>
              You have no pending tasks requiring focus today. Great job keeping your life loops closed.
            </p>
            <button type="button" className="primary" onClick={onExitFocusMode}>
              Return to Full Timeline
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {topThree.map((rec) => {
              const task = rec.task;
              const effort = getEffortTier(rec.estimatedTimeMinutes);
              const prov = task.consequenceProvenance || 'From document';
              const consequenceCat = getConsequenceCategoryLabel(task.consequenceType || detectConsequenceType(task.consequence));
              const isFirst = rec.rank === 1;

              return (
                <div
                  key={task.id}
                  style={{
                    background: '#fbf8f0',
                    border: isFirst ? '2px solid #686759' : '1.5px solid #e3ddcf',
                    borderRadius: 14,
                    padding: 22,
                    boxShadow: isFirst
                      ? '0 6px 22px rgba(37, 99, 235, 0.12)'
                      : '0 2px 8px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Card Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Priority Rank Badge */}
                      <span
                        style={{
                          background: isFirst ? '#686759' : rec.rank === 2 ? '#807c6e' : '#5c6048',
                          color: '#fbf8f0',
                          fontWeight: 800,
                          fontSize: 11.5,
                          padding: '3px 10px',
                          borderRadius: 20,
                          letterSpacing: '0.3px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isFirst ? '⭐ Action #1 (Do This First)' : rec.rank === 2 ? '⚡ Action #2 (Next Best)' : '🎯 Action #3 (High Leverage)'}
                      </span>

                      <span className="badge" style={{ fontSize: 11 }}>
                        {task.category}
                      </span>

                      {/* Ready / Blocked Badge */}
                      {rec.dependencyStatus === 'ready' && (
                        <span className="badge blue" style={{ fontSize: 11, fontWeight: 700 }}>
                          <PlayCircle size={11} /> Ready to act
                        </span>
                      )}
                      {rec.dependencyStatus === 'blocked' && (
                        <span className="badge red" style={{ fontSize: 11, fontWeight: 700 }}>
                          <Lock size={11} /> Blocked by prerequisite
                        </span>
                      )}

                      {/* Unlock Impact Badge */}
                      {rec.unlocksCount > 0 && (
                        <span
                          style={{
                            background: '#f5f1e8',
                            border: '1px solid #e3ddcf',
                            color: '#5c6048',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Zap size={11} color="#686759" /> Unlocks {rec.unlocksCount} downstream {rec.unlocksCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>

                    {/* Estimated Time Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className={`badge ${effort.badgeClass}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 750,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 10px',
                        }}
                        title={`Estimated hands-on time: ${rec.estimatedTimeMinutes} minutes`}
                      >
                        <Clock size={13} />
                        Est. Time: {rec.estimatedTimeDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Task Title */}
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      margin: '12px 0 6px',
                      color: '#292820',
                      cursor: 'pointer',
                    }}
                    onClick={() => onSelectTask(task)}
                    title="Click to view details"
                  >
                    {task.title}
                  </h3>

                  {/* Task Meta (Payee, Amount, Due Date) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 13,
                      color: '#5c6048',
                      marginBottom: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={13} /> {task.payee}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#292820' }}>
                      <DollarSign size={13} /> {task.amount}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} /> Due: <strong>{task.dueDate}</strong>
                    </span>
                  </div>

                  {/* Required Action Instruction */}
                  <div
                    style={{
                      background: '#fbf8f0',
                      border: '1px solid #e3ddcf',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13.5,
                      color: '#292820',
                      marginBottom: 10,
                      lineHeight: 1.45,
                    }}
                  >
                    <strong style={{ color: '#292820' }}>What to do:</strong> {task.requiredAction}
                  </div>

                  {/* WHY THIS MATTERS NOW CALLOUT (REQUIRED) */}
                  <div
                    style={{
                      background: isFirst ? '#f5f1e8' : '#eef0e4',
                      border: `1.5px solid ${isFirst ? '#e3ddcf' : '#dce0cb'}`,
                      borderRadius: 9,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: isFirst ? '#5c6048' : '#555d3d',
                      marginBottom: 12,
                      display: 'flex',
                      gap: 9,
                      alignItems: 'flex-start',
                      lineHeight: 1.45,
                    }}
                  >
                    <Sparkles size={16} color={isFirst ? '#686759' : '#555d3d'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: isFirst ? '#5c6048' : '#555d3d', marginRight: 4 }}>
                        Why this matters now:
                      </strong>
                      {rec.whyThisMattersNow}
                    </div>
                  </div>

                  {/* Documented Consequence Box */}
                  {task.consequence && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#f6ece3',
                        border: '1px solid #cfab93',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#85523f',
                        marginBottom: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <ShieldAlert size={14} color="#85523f" />
                        <span>
                          <strong>Documented Consequence:</strong> {task.consequence}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 8,
                          background: prov === 'From document' ? '#dce0cb' : prov === 'Added by you' ? '#eee9df' : '#f5f1e8',
                          color: prov === 'From document' ? '#555d3d' : prov === 'Added by you' ? '#786252' : '#5c6048',
                          border: `1px solid ${prov === 'From document' ? '#dce0cb' : prov === 'Added by you' ? '#e3ddcf' : '#cfc7b6'}`,
                        }}
                      >
                        {prov === 'From document' ? '✓ From document' : prov === 'Added by you' ? '👤 Added by you' : '? Unknown'}
                      </span>
                    </div>
                  )}

                  {/* Interactive Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      paddingTop: 12,
                      borderTop: '1px solid #f5f1e8',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          background: isFirst ? '#686759' : '#292820',
                          borderColor: isFirst ? '#5c6048' : '#292820',
                        }}
                        onClick={() => handleStartComplete(task.id)}
                      >
                        <Check size={15} /> Mark Done / Close Loop
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '8px 14px', fontSize: 13 }}
                        onClick={() => onSelectTask(task)}
                      >
                        Inspect & Edit Dependencies
                      </button>
                    </div>

                    <span style={{ fontSize: 12, color: '#5c6048' }}>
                      Priority Score: <strong>{rec.priorityScore}</strong> pts
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER ZEN ADVICE & RETURN BUTTON */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fbf8f0',
          border: '1px solid #e3ddcf',
          borderRadius: 12,
          padding: '16px 20px',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Coffee size={20} color="#5c6048" />
          <div style={{ fontSize: 13, color: '#5c6048', lineHeight: 1.4 }}>
            <strong>One loop at a time.</strong> Completing Action #1 creates immediate forward momentum.
            All other {Math.max(0, allActiveCount - topThree.length)} obligations are safely monitored in the background.
          </div>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={onExitFocusMode}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Return to Full Timeline
        </button>
      </div>
    </div>
  );
}

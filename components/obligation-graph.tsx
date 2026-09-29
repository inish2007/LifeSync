'use client';

import { useState } from 'react';
import {
  GitBranch,
  Lock,
  PlayCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign,
  Building2,
  ChevronRight,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  CalendarClock
} from 'lucide-react';
import { Obligation } from '@/lib/types';
import { calculateAllBackplans } from '@/lib/backplanner';
import {
  TaskGraphNode,
  NextBestActionRecommendation,
  buildGraphNodes,
  calculateNextBestAction,
  getTaskDependencyStatus
} from '@/lib/graph';
import {
  calculateUrgency,
  generateWhyNowExplanation,
  getConsequenceCategoryLabel,
  detectConsequenceType
} from '@/lib/consequence-engine';

interface ObligationGraphProps {
  obligations: Obligation[];
  onSelectTask: (task: Obligation) => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export default function ObligationGraph({
  obligations,
  onSelectTask,
  onOpenAddModal,
  onRefresh,
}: ObligationGraphProps) {
  const [filter, setFilter] = useState<'all' | 'ready' | 'blocked' | 'completed'>('all');
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const graphNodes = buildGraphNodes(obligations);
  const nextBestAction = calculateNextBestAction(obligations);
  const backplans = calculateAllBackplans(obligations);

  const nextBestWhyNow = nextBestAction ? generateWhyNowExplanation(nextBestAction.task, obligations) : '';
  const nextBestUrgency = nextBestAction ? calculateUrgency(nextBestAction.task, obligations) : null;
  const nextBestProvenance = nextBestAction ? (nextBestAction.task.consequenceProvenance || 'From document') : 'From document';

  // Group nodes by level (Topological Depth: 0 = root/independent, 1 = depends on level 0, etc.)
  const maxLevel = Math.max(0, ...graphNodes.map(n => n.level));
  const levelsArray = Array.from({ length: maxLevel + 1 }, (_, i) => i);

  const filteredNodes = graphNodes.filter(node => {
    if (filter === 'ready') return node.status === 'ready';
    if (filter === 'blocked') return node.status === 'blocked';
    if (filter === 'completed') return node.status === 'completed';
    return true;
  });

  const readyCount = graphNodes.filter(n => n.status === 'ready').length;
  const blockedCount = graphNodes.filter(n => n.status === 'blocked').length;
  const completedCount = graphNodes.filter(n => n.status === 'completed').length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* NEXT BEST ACTION HERO RECOMMENDATION CARD */}
      {nextBestAction && nextBestUrgency ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #292820 0%, #3c3d30 100%)',
            color: '#fbf8f0',
            padding: '24px 26px',
            borderRadius: 14,
            boxShadow: '0 4px 18px rgba(50,44,33, 0.18)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
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
                    color: '#cfab93',
                  }}
                >
                  <Sparkles size={13} color="#cfab93" />
                  Next Best Action
                </span>

                <span
                  style={{
                    background: nextBestUrgency.level === 'critical' ? '#85523f' : '#5c6048',
                    color: '#fbf8f0',
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {nextBestUrgency.badgeLabel}
                </span>

                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: '#cfc7b6',
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  Consequence: {nextBestProvenance}
                </span>
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#fbf8f0', margin: '4px 0 6px' }}>
                {nextBestAction.task.title}
              </h3>

              {/* Explicit "Why now?" Explanation */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderLeft: '3px solid #b1aa97',
                  padding: '10px 14px',
                  borderRadius: '0 8px 8px 0',
                  margin: '10px 0 12px',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: '#eee9df',
                }}
              >
                <strong style={{ color: '#cfc7b6', display: 'block', marginBottom: 2 }}>Why now?</strong>
                {nextBestWhyNow}
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: '#cfc7b6' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={13} />
                  {nextBestAction.task.payee}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} />
                  Due {nextBestAction.task.dueDate}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <DollarSign size={13} />
                  {nextBestAction.task.amount}
                </span>
                {nextBestAction.unlockCount > 0 && (
                  <span
                    style={{
                      background: '#5c6048',
                      color: '#fbf8f0',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    Unlocks {nextBestAction.unlockCount} task{nextBestAction.unlockCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="primary"
              style={{
                background: '#fbf8f0',
                color: '#292820',
                fontWeight: 700,
                padding: '10px 18px',
                fontSize: 13.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
              onClick={() => onSelectTask(nextBestAction.task)}
            >
              Inspect & Act
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 20, textAlign: 'center' }}>
          <Sparkles size={24} color="#5c6048" style={{ margin: '0 auto 8px' }} />
          <h3>All current obligations are closed or waiting!</h3>
          <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>
            Add a new document to the Universal Inbox to queue up your next life-admin sequence.
          </p>
        </div>
      )}

      {/* GRAPH PANEL HEADER & FILTER BAR */}
      <div className="panel" style={{ padding: 24 }}>
        <div className="sectionhead" style={{ marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={20} color="#5c6048" />
                Obligation Dependency Graph
              </h2>
              <span className="badge blue">Interactive Chain</span>
            </div>
            <p className="muted" style={{ fontSize: 14, margin: '2px 0 0' }}>
              See blocked tasks, ready tasks, and what prerequisite is holding up another step.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

        {/* Status Legend & Filter Tabs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #eee9df',
            paddingBottom: 12,
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
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
              All Graph Nodes ({graphNodes.length})
            </button>
            <button
              type="button"
              className="taskbutton"
              style={{
                fontSize: 13,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 6,
                background: filter === 'ready' ? '#f5f1e8' : 'transparent',
                color: filter === 'ready' ? '#5c6048' : '#5c6048',
              }}
              onClick={() => setFilter('ready')}
            >
              <PlayCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
              Ready ({readyCount})
            </button>
            <button
              type="button"
              className="taskbutton"
              style={{
                fontSize: 13,
                fontWeight: 650,
                padding: '4px 10px',
                borderRadius: 6,
                background: filter === 'blocked' ? '#f6ece3' : 'transparent',
                color: filter === 'blocked' ? '#85523f' : '#5c6048',
              }}
              onClick={() => setFilter('blocked')}
            >
              <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
              Blocked ({blockedCount})
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
              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
              Completed ({completedCount})
            </button>
          </div>

          {/* Micro Legend */}
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#5c6048' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5c6048' }} />
              Ready
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#85523f' }} />
              Blocked
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#555d3d' }} />
              Completed
            </span>
          </div>
        </div>

        {/* CONNECTED MULTI-LEVEL DEPENDENCY PIPELINE */}
        <div style={{ display: 'grid', gap: 24 }}>
          {levelsArray.map((levelIndex) => {
            const nodesAtLevel = filteredNodes.filter(n => n.level === levelIndex);
            if (nodesAtLevel.length === 0) return null;

            return (
              <div key={levelIndex} style={{ position: 'relative' }}>
                {/* Level Header Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      background: levelIndex === 0 ? '#292820' : '#eee9df',
                      color: levelIndex === 0 ? '#fbf8f0' : '#5c6048',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    Level {levelIndex + 1}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 650, color: '#5c6048' }}>
                    {levelIndex === 0
                      ? 'Root Obligations (No prerequisites — can start immediately)'
                      : `Downstream Stage (Depends on Level ${levelIndex} prerequisites)`}
                  </span>
                </div>

                {/* Level Nodes Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 14,
                  }}
                >
                  {nodesAtLevel.map((node) => {
                    const isSelected = highlightedTaskId === node.obligation.id;
                    const isBlocked = node.status === 'blocked';
                    const isReady = node.status === 'ready';
                    const isCompleted = node.status === 'completed';

                    const nodeUrgency = calculateUrgency(node.obligation, obligations);
                    const nodeWhyNow = generateWhyNowExplanation(node.obligation, obligations);
                    const nodeProvenance = node.obligation.consequenceProvenance || 'From document';
                    const nodeCategory = getConsequenceCategoryLabel(node.obligation.consequenceType || detectConsequenceType(node.obligation.consequence || ''));
                    const backplan = backplans.get(node.obligation.id);

                    return (
                      <div
                        key={node.obligation.id}
                        onClick={() => onSelectTask(node.obligation)}
                        onMouseEnter={() => setHighlightedTaskId(node.obligation.id)}
                        onMouseLeave={() => setHighlightedTaskId(null)}
                        style={{
                          background: isCompleted ? '#fbf8f0' : '#fbf8f0',
                          border: isSelected
                            ? '2px solid #5c6048'
                            : isBlocked
                            ? '1.5px solid #ead8c8'
                            : isReady
                            ? '1.5px solid #b1aa97'
                            : '1px solid #e3ddcf',
                          borderRadius: 12,
                          padding: 16,
                          cursor: 'pointer',
                          boxShadow: isSelected
                            ? '0 6px 20px rgba(74,72,53,0.12)'
                            : '0 1px 4px rgba(0,0,0,0.03)',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        {/* Top Node Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                          <span className="badge" style={{ fontSize: 11 }}>
                            {node.obligation.category}
                          </span>

                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {!isCompleted && (
                              <span className={`badge ${nodeUrgency.badgeColor}`} style={{ fontSize: 10.5, fontWeight: 700 }}>
                                {nodeUrgency.badgeLabel}
                              </span>
                            )}

                            {node.status === 'waiting' && <span className="badge amber">Waiting for response</span>}
                            {isReady && (
                              <span className="badge blue" style={{ fontWeight: 700, fontSize: 10.5 }}>
                                <PlayCircle size={11} />
                                Ready
                              </span>
                            )}
                            {isBlocked && (
                              <span className="badge red" style={{ fontWeight: 700, fontSize: 10.5 }}>
                                <Lock size={11} />
                                Blocked
                              </span>
                            )}
                            {isCompleted && (
                              <span className="badge green" style={{ fontWeight: 700, fontSize: 10.5 }}>
                                <CheckCircle2 size={11} />
                                Closed
                              </span>
                            )}

                            {!isCompleted && backplan && (
                              <span
                                className={`badge ${backplan.scheduleHealth === 'overrun' ? 'red' : 'blue'}`}
                                style={{ fontSize: 10, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                title={`Deadline Backplanner: Start by ${backplan.recommendedStartDate} (${backplan.totalLeadDaysRequired}d lead time)`}
                              >
                                <CalendarClock size={10} />
                                Start {backplan.recommendedStartDate}
                              </span>
                            )}
                            {!isCompleted && backplan?.scheduleHealth === 'overrun' && (
                              <span className="badge red" style={{ fontSize: 10, fontWeight: 700 }}>
                                Overrun (-{backplan.deficitDays}d)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4
                          style={{
                            fontSize: 15.5,
                            fontWeight: 700,
                            margin: '8px 0 4px',
                            color: '#292820',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                          }}
                        >
                          {node.obligation.title}
                        </h4>

                        {/* Meta info */}
                        <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#5c6048', margin: '4px 0 8px', flexWrap: 'wrap' }}>
                          <span>{node.obligation.payee}</span>
                          <span>•</span>
                          <span style={{ fontWeight: 600, color: '#292820' }}>{node.obligation.amount}</span>
                          <span>•</span>
                          <span>Due {node.obligation.dueDate}</span>
                        </div>

                        {/* Documented Consequence with Provenance */}
                        {node.obligation.consequence && !isCompleted && (
                          <div
                            style={{
                              padding: '6px 8px',
                              background: nodeProvenance === 'Unknown' ? '#fbf8f0' : '#f6ece3',
                              border: nodeProvenance === 'Unknown' ? '1px solid #e3ddcf' : '1px solid #ead8c8',
                              borderRadius: 6,
                              fontSize: 12,
                              color: nodeProvenance === 'Unknown' ? '#5c6048' : '#85523f',
                              margin: '6px 0',
                              lineHeight: 1.4,
                            }}
                          >
                            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={11} />
                              Consequence [{nodeProvenance}]:
                            </span>{' '}
                            {node.obligation.consequence}
                          </div>
                        )}

                        {/* "Why now?" explanation snippet */}
                        {!isCompleted && (
                          <div
                            style={{
                              padding: '6px 8px',
                              background: '#f5f1e8',
                              borderRadius: 6,
                              fontSize: 11.5,
                              color: '#5c6048',
                              margin: '4px 0 8px',
                              lineHeight: 1.45,
                            }}
                          >
                            <strong>Why now?</strong> {nodeWhyNow}
                          </div>
                        )}

                        {/* Deadline Backplanner Overrun Warning */}
                        {!isCompleted && backplan && !backplan.fitsBeforeDeadline && (
                          <div
                            style={{
                              padding: '6px 8px',
                              background: '#f6ece3',
                              border: '1px solid #cfab93',
                              borderRadius: 6,
                              fontSize: 11.5,
                              color: '#85523f',
                              margin: '6px 0',
                              lineHeight: 1.4,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                              <AlertTriangle size={12} color="#85523f" />
                              <span>Schedule Overrun Warning</span>
                            </div>
                            <div style={{ marginTop: 2 }}>
                              Work requires <strong>{backplan.totalLeadDaysRequired} days</strong> lead time ({node.obligation.estimatedDurationDays || 1}d work + {node.obligation.bufferDays || 1}d buffer), but only <strong>{backplan.availableCalendarDays} days</strong> remain. Short by <strong>{backplan.deficitDays} days</strong>.
                            </div>
                          </div>
                        )}

                        {/* BLOCKED NOTICE (SHOWING WHICH PREREQUISITE IS HOLDING IT UP) */}
                        {isBlocked && node.unresolvedPrerequisites.length > 0 && (
                          <div
                            style={{
                              padding: '8px 10px',
                              background: '#f6ece3',
                              border: '1px solid #ead8c8',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#85523f',
                              margin: '6px 0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                              <Lock size={12} />
                              Blocked by prerequisite:
                            </div>
                            <div style={{ marginTop: 3 }}>
                              {node.unresolvedPrerequisites.map(p => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <ArrowRight size={10} />
                                  <strong>{p.title}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* READY NOTICE (SHOWING WHAT IT UNLOCKS) */}
                        {isReady && node.transitiveUnlockCount > 0 && (
                          <div
                            style={{
                              padding: '6px 10px',
                              background: '#f5f1e8',
                              border: '1px solid #e3ddcf',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#5c6048',
                              margin: '8px 0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Sparkles size={13} color="#5c6048" />
                            <span>
                              Unlocks <strong>{node.transitiveUnlockCount} downstream {node.transitiveUnlockCount === 1 ? 'task' : 'tasks'}</strong>
                            </span>
                          </div>
                        )}

                        {/* Node Footer */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: '1px solid #eee9df',
                            fontSize: 12,
                            color: '#5c6048',
                          }}
                        >
                          <span>
                            {node.prerequisites.length} prereq{node.prerequisites.length === 1 ? '' : 's'} • {node.downstreamDependents.length} downstream
                          </span>
                          <span style={{ color: '#5c6048', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            Edit Dependencies <ChevronRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Infinity as Loop,
  Plus,
  Upload,
  FileText,
  ShieldCheck,
  GitBranch,
  CheckCheck,
  Inbox,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  ArrowRight,
  Lock,
  PlayCircle,
  ShieldAlert,
  CalendarClock
} from 'lucide-react';
import AddObligationDialog from '@/components/add-obligation-dialog';
import UniversalInboxView from '@/components/universal-inbox-view';
import ObligationTimeline from '@/components/obligation-timeline';
import ObligationGraph from '@/components/obligation-graph';
import DeadlineBackplannerView from '@/components/deadline-backplanner-view';
import TaskDetailDialog from '@/components/task-detail-dialog';
import FocusModeView from '@/components/focus-mode-view';
import { EnergyStepsView, CollisionView, WaitingRoomView, ProofLibraryView } from '@/components/workflow-views';
import { Obligation, UniversalInboxItem } from '@/lib/types';
import {
  getObligations,
  getInboxItems,
  resetAllStorageToDefaults
} from '@/lib/storage';
import {
  getTaskDependencyStatus,
  calculateNextBestAction,
  getDirectDownstreamDependents
} from '@/lib/graph';
import {
  calculateUrgency,
  generateWhyNowExplanation,
  getConsequenceCategoryLabel
} from '@/lib/consequence-engine';
import { calculateAllBackplans } from '@/lib/backplanner';

export default function LifeLoop() {
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewingInboxItem, setReviewingInboxItem] = useState<UniversalInboxItem | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'timeline' | 'graph' | 'backplanner' | 'inbox' | 'energy' | 'collisions' | 'waiting' | 'proof'>('timeline');
  const [focusModeActive, setFocusModeActive] = useState(false);

  // Selected task for dependency & detail panel
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Obligation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // State loaded from browser storage
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [inboxItems, setInboxItems] = useState<UniversalInboxItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Sync data from browser localStorage
  const loadData = useCallback(() => {
    const obls = getObligations();
    const inboxes = getInboxItems();
    setObligations(obls);
    setInboxItems(inboxes);

    // Keep selected detail task refreshed if open
    setSelectedTaskForDetail(prev => {
      if (!prev) return null;
      return obls.find(o => o.id === prev.id) || null;
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadData();

    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener('lifeloop_storage_changed', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('lifeloop_storage_changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadData]);

  // Handler to open "Add obligation" modal fresh
  const handleOpenAddModal = () => {
    setReviewingInboxItem(null);
    setModalOpen(true);
  };

  // Handler to review an existing inbox item
  const handleReviewInboxItem = (item: UniversalInboxItem) => {
    setReviewingInboxItem(item);
    setModalOpen(true);
  };

  // Handler to inspect/manage task dependencies
  const handleSelectTask = (task: Obligation) => {
    setSelectedTaskForDetail(task);
    setDetailDialogOpen(true);
  };

  // Reset demo data handler
  const handleResetData = () => {
    if (confirm('Reset prototype storage to initial demonstration data?')) {
      resetAllStorageToDefaults();
      loadData();
    }
  };

  // Calculated stats based on dependency status
  const readyTasks = obligations.filter(o => o.status === 'confirmed' && getTaskDependencyStatus(o, obligations) === 'ready');
  const blockedTasks = obligations.filter(o => getTaskDependencyStatus(o, obligations) === 'blocked');
  const closedTasks = obligations.filter(o => o.status === 'completed');
  const inboxPendingCount = inboxItems.filter(i => i.status === 'pending_review').length;

  const nextBestAction = calculateNextBestAction(obligations);
  const backplans = calculateAllBackplans(obligations);
  const overrunTasks = obligations.filter(
    o => backplans.get(o.id)?.scheduleHealth === 'overrun' && o.status !== 'completed'
  );
  const overrunsCount = overrunTasks.length;

  return (
    <>
      {/* TOPBAR */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div className="brand">
            <span className="brandmark">
              <Loop size={28} />
            </span>
            LifeLoop
          </div>
          <span className="topnote">A little less on your mind.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* View Mode Buttons in Header */}
          <button
            type="button"
            className="secondary"
            style={{
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: 650,
              backgroundColor: activeMainTab === 'graph' ? '#292820' : '#eee9df',
              color: activeMainTab === 'graph' ? '#fbf8f0' : '#3c3d30',
              border: 0,
            }}
            onClick={() => setActiveMainTab('graph')}
          >
            <GitBranch size={15} />
            Obligation Graph
            {blockedTasks.length > 0 && (
              <span
                style={{
                  background: activeMainTab === 'graph' ? 'rgba(255,255,255,0.2)' : '#85523f',
                  color: '#fbf8f0',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                {blockedTasks.length} blocked
              </span>
            )}
          </button>

          <button
            type="button"
            className="secondary"
            style={{
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: 650,
              backgroundColor: activeMainTab === 'backplanner' ? '#292820' : '#eee9df',
              color: activeMainTab === 'backplanner' ? '#fbf8f0' : '#3c3d30',
              border: 0,
            }}
            onClick={() => setActiveMainTab('backplanner')}
          >
            <CalendarClock size={15} />
            Deadline Backplanner
            {overrunsCount > 0 && (
              <span
                style={{
                  background: activeMainTab === 'backplanner' ? '#85523f' : '#85523f',
                  color: '#fbf8f0',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                {overrunsCount} overrun
              </span>
            )}
          </button>

          <button
            type="button"
            className="secondary"
            style={{
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: 650,
              backgroundColor: activeMainTab === 'inbox' ? '#292820' : '#eee9df',
              color: activeMainTab === 'inbox' ? '#fbf8f0' : '#3c3d30',
              border: 0,
            }}
            onClick={() => setActiveMainTab('inbox')}
          >
            <Inbox size={15} />
            Universal Inbox
            {inboxPendingCount > 0 && (
              <span
                style={{
                  background: '#5c6048',
                  color: '#fbf8f0',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                {inboxPendingCount}
              </span>
            )}
          </button>

          {/* FOCUS MODE TOGGLE BUTTON */}
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: focusModeActive
                ? 'linear-gradient(135deg, #5c6048 0%, #686759 100%)'
                : 'linear-gradient(135deg, #f5f1e8 0%, #eee9df 100%)',
              color: focusModeActive ? '#fbf8f0' : '#5c6048',
              border: '1.5px solid',
              borderColor: focusModeActive ? '#5c6048' : '#cfc7b6',
              padding: '7px 14px',
              borderRadius: 8,
              fontWeight: 750,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: focusModeActive
                ? '0 2px 10px rgba(74,72,53,0.3)'
                : '0 1px 3px rgba(74,72,53,0.08)',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFocusModeActive(!focusModeActive)}
            title="Feeling overwhelmed? Hide the full timeline and see only the 3 most useful actions for today"
          >
            <Sparkles size={14} color={focusModeActive ? '#cfc7b6' : '#686759'} />
            {focusModeActive ? 'Exit Focus Mode' : '🎯 Focus Mode'}
          </button>

          <button className="primary" onClick={handleOpenAddModal} style={{ boxShadow: '0 2px 8px rgba(74,72,53,0.2)' }}>
            <Plus size={18} />
            Add obligation
          </button>

          <span className="badge blue">
            <ShieldCheck size={14} />
            Private workspace
          </span>
        </div>
      </header>

      {/* MAIN CONTENT SHELL */}
      <main className="shell">
        {focusModeActive ? (
          <FocusModeView
            obligations={obligations}
            onExitFocusMode={() => setFocusModeActive(false)}
            onSelectTask={handleSelectTask}
            onRefresh={loadData}
          />
        ) : (
          <>
            {/* HEADING SECTION */}
            <div className="heading">
          <div>
            <div className="eyebrow">The life admin edit · A little less on your mind</div>
            <h1>Make room for <em>life.</em></h1>
            <p className="muted">Your obligations, connected. Your consequences, documented. Your next step, clear.</p>
          </div>

          {/* VIEW SWITCHER TABS */}
          <div className="main-view-tabs" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {([{ id: 'energy', label: 'Micro-Steps' }, { id: 'collisions', label: 'Collisions' }, { id: 'waiting', label: `Waiting Room (${obligations.filter(t => t.status === 'waiting').length})` }, { id: 'proof', label: 'Completion Proof' }] as const).map(tab => <button key={tab.id} type="button" className={activeMainTab === tab.id ? 'primary' : 'secondary'} aria-pressed={activeMainTab === tab.id} onClick={() => setActiveMainTab(tab.id)}>{tab.label}</button>)}
            <button
              type="button"
              className={activeMainTab === 'timeline' ? 'primary' : 'secondary'}
              onClick={() => setActiveMainTab('timeline')}
              style={{ fontSize: 13 }}
            >
              <Clock size={15} />
              Timeline
            </button>
            <button
              type="button"
              className={activeMainTab === 'graph' ? 'primary' : 'secondary'}
              onClick={() => setActiveMainTab('graph')}
              style={{ fontSize: 13 }}
            >
              <GitBranch size={15} />
              Obligation Graph
            </button>
            <button
              type="button"
              className={activeMainTab === 'backplanner' ? 'primary' : 'secondary'}
              onClick={() => setActiveMainTab('backplanner')}
              style={{ fontSize: 13 }}
            >
              <CalendarClock size={15} />
              Deadline Backplanner
              {overrunsCount > 0 && (
                <span
                  style={{
                    backgroundColor: activeMainTab === 'backplanner' ? '#fbf8f0' : '#85523f',
                    color: activeMainTab === 'backplanner' ? '#85523f' : '#fbf8f0',
                    borderRadius: 9,
                    padding: '0 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    marginLeft: 4,
                  }}
                >
                  {overrunsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className={activeMainTab === 'inbox' ? 'primary' : 'secondary'}
              onClick={() => setActiveMainTab('inbox')}
              style={{ fontSize: 13 }}
            >
              <Inbox size={15} />
              Universal Inbox
              {inboxPendingCount > 0 && (
                <span
                  style={{
                    backgroundColor: activeMainTab === 'inbox' ? '#fbf8f0' : '#5c6048',
                    color: activeMainTab === 'inbox' ? '#292820' : '#fbf8f0',
                    borderRadius: 9,
                    padding: '0 6px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {inboxPendingCount}
                </span>
              )}
            </button>

            {/* QUICK FOCUS MODE BUTTON IN TABS */}
            <button
              type="button"
              className="secondary"
              onClick={() => setFocusModeActive(true)}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#5c6048',
                background: '#f5f1e8',
                border: '1.5px solid #e3ddcf',
              }}
              title="Feeling overwhelmed? Hide the full timeline and see only the 3 most useful actions for today"
            >
              <Sparkles size={13} color="#686759" />
              🎯 Focus Mode
            </button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid">
          {/* PRIMARY COLUMN */}
          <section>
            {/* HERO FOCUS PROMO CARD */}
            <div className="focus editorial-focus">
              <div className="editorial-note" aria-hidden="true"><span>THE DAILY EDIT</span><em>Small steps.<br />A softer pace.</em><div className="editorial-swatches"><i /><i /><i /><i /></div><small>LESS NOISE. MORE LIFE.</small></div>
              <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} />
                Consequence Engine & Dependency Network
              </div>
              <h2>Connect the steps. Prevent documented consequences.</h2>
              <p>
                LifeLoop tracks documented penalties, due date urgency, and prerequisite blockers.
                {nextBestAction && (
                  <> Your next best move is <strong>{nextBestAction.task.title}</strong> to avoid downstream consequences and keep your loops closed.</>
                )}
              </p>
              <div className="focusfooter">
                <button className="primary" onClick={handleOpenAddModal} style={{ fontWeight: 700 }}>
                  <Upload size={16} />
                  Add an obligation
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{ background: 'rgba(255,255,255,0.22)', color: '#fbf8f0', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 700 }}
                  onClick={() => setFocusModeActive(true)}
                  title="Hide full timeline and show top 3 actions for today"
                >
                  <Sparkles size={15} color="#cfc7b6" />
                  Feeling Overwhelmed? 🎯 Focus Mode
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#fbf8f0', border: 0 }}
                  onClick={() => setActiveMainTab('graph')}
                >
                  <GitBranch size={15} />
                  Explore Obligation Graph
                </button>
              </div>
            </div>

            {/* LIVE DYNAMIC STATS */}
            <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <div
                className="stat"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setActiveMainTab('graph')}
              >
                <span>Ready to act</span>
                <strong style={{ color: '#5c6048' }}>{isMounted ? readyTasks.length : 3}</strong>
              </div>
              <div
                className="stat"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setActiveMainTab('graph')}
              >
                <span>Blocked by steps</span>
                <strong style={{ color: '#85523f' }}>{isMounted ? blockedTasks.length : 2}</strong>
              </div>
              <div
                className="stat"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setActiveMainTab('backplanner')}
              >
                <span>Schedule overruns</span>
                <strong style={{ color: overrunsCount > 0 ? '#85523f' : '#555d3d' }}>
                  {isMounted ? overrunsCount : 1}
                </strong>
              </div>
              <div
                className="stat"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setActiveMainTab('timeline')}
              >
                <span>Loops closed</span>
                <strong style={{ color: '#555d3d' }}>{isMounted ? closedTasks.length : 1}</strong>
              </div>
              <div
                className="stat"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setActiveMainTab('inbox')}
              >
                <span>Inbox queue</span>
                <strong style={{ color: '#85523f' }}>{isMounted ? inboxPendingCount : 1}</strong>
              </div>
            </div>

            {/* ACTIVE VIEW RENDERER */}
            {activeMainTab === 'energy' && <EnergyStepsView obligations={obligations} onSelectTask={handleSelectTask} />}
            {activeMainTab === 'collisions' && <CollisionView obligations={obligations} onSelectTask={handleSelectTask} />}
            {activeMainTab === 'waiting' && <WaitingRoomView obligations={obligations} onSelectTask={handleSelectTask} />}
            {activeMainTab === 'proof' && <ProofLibraryView obligations={obligations} onSelectTask={handleSelectTask} />}
            {activeMainTab === 'timeline' && (
              <ObligationTimeline
                obligations={obligations}
                onSelectTask={handleSelectTask}
                onOpenAddModal={handleOpenAddModal}
                onEnterFocusMode={() => setFocusModeActive(true)}
                onRefresh={loadData}
              />
            )}

            {activeMainTab === 'graph' && (
              <ObligationGraph
                obligations={obligations}
                onSelectTask={handleSelectTask}
                onOpenAddModal={handleOpenAddModal}
                onRefresh={loadData}
              />
            )}

            {activeMainTab === 'backplanner' && (
              <DeadlineBackplannerView
                obligations={obligations}
                onSelectTask={handleSelectTask}
                onRefresh={loadData}
              />
            )}

            {activeMainTab === 'inbox' && (
              <div className="panel" style={{ padding: 24 }}>
                <UniversalInboxView
                  items={inboxItems}
                  onReviewItem={handleReviewInboxItem}
                  onAddNew={handleOpenAddModal}
                  onItemDeleted={loadData}
                />
              </div>
            )}
          </section>

          {/* ASIDE / SIDEBAR */}
          <aside className="side">
            {/* NEXT BEST ACTION SIDEBAR SPOTLIGHT (CONSEQUENCE ENGINE) */}
            {nextBestAction && (() => {
              const urgency = calculateUrgency(nextBestAction.task, obligations);
              const whyNow = generateWhyNowExplanation(nextBestAction.task, obligations);
              const prov = nextBestAction.task.consequenceProvenance || 'From document';

              return (
                <div className="panel" style={{ border: '1.5px solid #5c6048', background: '#f5f1e8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: '#5c6048' }}>
                      <Sparkles size={16} color="#5c6048" />
                      Next Best Action
                    </span>
                    <span className={`badge ${urgency.badgeColor}`} style={{ fontSize: 11, fontWeight: 700 }}>
                      <ShieldAlert size={11} /> {urgency.badgeLabel}
                    </span>
                  </div>

                  <strong style={{ display: 'block', fontSize: 15, color: '#292820', marginTop: 8 }}>
                    {nextBestAction.task.title}
                  </strong>

                  {/* Documented Consequence Pill with Provenance */}
                  <div
                    style={{
                      marginTop: 6,
                      padding: '6px 10px',
                      background: prov === 'Unknown' ? '#f5f1e8' : '#f6ece3',
                      border: `1px solid ${prov === 'Unknown' ? '#cfc7b6' : '#ead8c8'}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <strong style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, color: prov === 'Unknown' ? '#5c6048' : '#85523f' }}>
                        Consequence:
                      </strong>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 6,
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
                    <div style={{ color: '#292820', fontSize: 12, lineHeight: 1.4 }}>
                      {nextBestAction.task.consequence || 'No documented penalty in source.'}
                    </div>
                  </div>

                  {/* "Why now?" Box */}
                  <div
                    style={{
                      marginTop: 6,
                      padding: '7px 10px',
                      background: '#eef0e4',
                      border: '1px solid #dce0cb',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#555d3d',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong style={{ color: '#555d3d' }}>Why now? </strong>
                    {whyNow}
                  </div>

                  <button
                    type="button"
                    className="primary"
                    style={{ width: '100%', marginTop: 10, padding: '7px 0', fontSize: 12.5 }}
                    onClick={() => handleSelectTask(nextBestAction.task)}
                  >
                    Act on this task →
                  </button>
                </div>
              );
            })()}

            {/* LIVE CHAIN VISUALIZER (DYNAMIC PREREQUISITE CHAIN) */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <GitBranch size={22} color="#5c6048" />
                <button
                  type="button"
                  className="linkbutton"
                  style={{ fontSize: 12 }}
                  onClick={() => setActiveMainTab('graph')}
                >
                  Full Graph →
                </button>
              </div>
              <h2 style={{ marginTop: 12 }}>See the whole chain.</h2>
              <p>
                A renewal might need an inspection. An inspection needs a photo verification. LifeLoop maps what unlocks what:
              </p>

              {/* Real live sequence from data */}
              <div className="steps">
                {obligations.slice(0, 3).map((item, i) => {
                  const status = getTaskDependencyStatus(item, obligations);
                  const isBlocked = status === 'blocked';
                  const isDone = status === 'completed';

                  return (
                    <div
                      className="step"
                      key={item.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectTask(item)}
                    >
                      <span
                        className="stepnumber"
                        style={{
                          background: isDone ? '#dce0cb' : isBlocked ? '#f6ece3' : '#f5f1e8',
                          borderColor: isDone ? '#dce0cb' : isBlocked ? '#ead8c8' : '#e3ddcf',
                          color: isDone ? '#555d3d' : isBlocked ? '#85523f' : '#5c6048',
                        }}
                      >
                        {isDone ? '✓' : isBlocked ? '🔒' : i + 1}
                      </span>
                      <div>
                        <strong style={{ color: isDone ? '#5c6048' : '#292820' }}>{item.title}</strong>
                        <small style={{ color: isBlocked ? '#85523f' : isDone ? '#555d3d' : '#5c6048' }}>
                          {isDone ? 'Completed' : item.status === 'waiting' ? 'Waiting for response' : isBlocked ? 'Blocked by prerequisite' : 'Ready to act'}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="badge">Auto-updated sequence</span>
            </div>

            {/* INBOX QUICK SUMMARY CARD */}
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: '#292820' }}>
                  <Inbox size={17} color="#5c6048" />
                  Inbox Queue
                </span>
                <span className="badge amber">{inboxPendingCount} awaiting</span>
              </div>
              <p style={{ marginTop: 6, fontSize: 12.5, color: '#5c6048' }}>
                Review incoming documents before adding them to your dependency network.
              </p>
              <button
                type="button"
                className="secondary"
                style={{ width: '100%', marginTop: 8, padding: '6px 0', fontSize: 12.5 }}
                onClick={() => setActiveMainTab('inbox')}
              >
                Go to Universal Inbox ({inboxItems.length})
              </button>
            </div>

            {/* CLOSE THE LOOP EVIDENCE CARD */}
            <div className="panel">
              <CheckCheck size={22} color="#5c6048" />
              <h3 style={{ marginTop: 10, fontSize: 16 }}>Close the loop</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                Keep an obligation open until you have an inspection certificate, receipt, or confirmation code.
              </p>
            </div>

            {/* PROTOTYPE RESET UTILITY */}
            <div style={{ textAlign: 'center', paddingTop: 4 }}>
              <button
                type="button"
                className="linkbutton"
                style={{ fontSize: 12, color: '#686759', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={handleResetData}
              >
                <RotateCcw size={12} />
                Reset prototype storage to demo data
              </button>
            </div>
          </aside>
        </div>
        </>
        )}
      </main>

      {/* PROMINENT ADD OBLIGATION MODAL */}
      <AddObligationDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onObligationCreated={loadData}
        initialInboxItem={reviewingInboxItem}
      />

      {/* TASK DETAIL & DEPENDENCY EDITOR DIALOG */}
      <TaskDetailDialog
        key={`${selectedTaskForDetail?.id || 'none'}-${detailDialogOpen}`}
        task={selectedTaskForDetail}
        allTasks={obligations}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdated={loadData}
      />
    </>
  );
}

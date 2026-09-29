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
import WhatsAppReminders from '@/components/whatsapp-reminders';
import { accountApi, type Account } from '@/lib/account-client';
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

export default function LifeLoop({account=null,onAccountUpdated=()=>{}}:{account?:Account|null;onAccountUpdated?:(user:Account)=>void}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewingInboxItem, setReviewingInboxItem] = useState<UniversalInboxItem | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'timeline' | 'graph' | 'backplanner' | 'inbox' | 'energy' | 'collisions' | 'waiting' | 'proof' | 'whatsapp'>('timeline');
  const [syncError,setSyncError]=useState('');
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

  useEffect(()=>{
    if(!account || !isMounted)return;
    let disposed=false;
    const sync=async()=>{try{await accountApi('tasks',{tasks:obligations.map(({id,title,dueDate,status,followUpDate})=>({id,title,dueDate,status,followUpDate}))});await accountApi('run',{});if(!disposed)setSyncError('');}catch(err){if(!disposed)setSyncError(err instanceof Error?err.message:'Reminder sync failed.');}};
    const delay=setTimeout(sync,800);const interval=setInterval(sync,60000);
    return()=>{disposed=true;clearTimeout(delay);clearInterval(interval);};
  },[account?.id,isMounted,obligations]);

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
          <button className="secondary" onClick={()=>setActiveMainTab('whatsapp')}>WhatsApp reminders</button>
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
            <p className="muted">One place for what’s due and what to do next.</p>
          </div>

          {/* VIEW SWITCHER TABS */}
          <div className="main-view-tabs" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {([{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'energy', label: 'Micro-Steps' }, { id: 'collisions', label: 'Collisions' }, { id: 'waiting', label: `Waiting Room (${obligations.filter(t => t.status === 'waiting').length})` }, { id: 'proof', label: 'Completion Proof' }] as const).map(tab => <button key={tab.id} type="button" className={activeMainTab === tab.id ? 'primary' : 'secondary'} aria-pressed={activeMainTab === tab.id} onClick={() => setActiveMainTab(tab.id)}>{tab.label}</button>)}
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
            {syncError&&<p className="notice error" role="alert">Reminder sync: {syncError}</p>}
            {activeMainTab === 'whatsapp' && <WhatsAppReminders account={account} tasks={obligations} onAccountUpdated={onAccountUpdated}/>}
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

          <aside className="side compact-aside"><div className="panel"><div className="eyebrow">Your next move</div><h3>{nextBestAction?.task.title || 'All clear.'}</h3><p className="helper">{nextBestAction ? 'One step now can unlock the next.' : 'Add an obligation to get started.'}</p>{nextBestAction&&<button className="primary" onClick={()=>handleSelectTask(nextBestAction.task)}>Open task</button>}</div><div className="panel"><h3>A gentle nudge.</h3><p className="helper">Try your free WhatsApp-style reminder preview.</p><button className="secondary" onClick={()=>setActiveMainTab('whatsapp')}>Open reminders</button></div><details className="quiet-details"><summary>Demo settings</summary><button className="linkbutton" onClick={handleResetData}>Reset demo data</button></details></aside>
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

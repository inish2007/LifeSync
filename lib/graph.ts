import { Obligation } from './types';
import { getObligations, saveObligation } from './storage';

export type TaskDependencyStatus = 'ready' | 'blocked' | 'completed' | 'waiting';

export interface TaskGraphNode {
  obligation: Obligation;
  status: TaskDependencyStatus;
  prerequisites: Obligation[];
  unresolvedPrerequisites: Obligation[];
  downstreamDependents: Obligation[];
  transitiveUnlockCount: number;
  level: number;
}

export interface NextBestActionRecommendation {
  task: Obligation;
  unlockCount: number;
  unlockedTasks: Obligation[];
  mostUrgentDownstreamTask?: Obligation;
  explanation: string;
}

/**
 * Computes the dependency status of a single task.
 */
export function getTaskDependencyStatus(
  task: Obligation,
  allTasks: Obligation[]
): TaskDependencyStatus {
  if (task.status === 'completed') {
    return 'completed';
  }
  if (task.status === 'waiting') return 'waiting';

  const dependsOn = task.dependsOnIds || [];
  if (dependsOn.length === 0) {
    return 'ready';
  }

  // Check if every prerequisite task is completed
  const hasIncompletePrereq = dependsOn.some(prereqId => {
    const prereq = allTasks.find(t => t.id === prereqId);
    return !prereq || prereq.status !== 'completed';
  });

  return hasIncompletePrereq ? 'blocked' : 'ready';
}

/**
 * Returns which prerequisite obligations are currently holding up this task.
 */
export function getUnresolvedPrerequisites(
  task: Obligation,
  allTasks: Obligation[]
): Obligation[] {
  const dependsOn = task.dependsOnIds || [];
  return dependsOn
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Obligation => t !== undefined && t.status !== 'completed');
}

/**
 * Returns all direct downstream obligations that list this task as a prerequisite.
 */
export function getDirectDownstreamDependents(
  taskId: string,
  allTasks: Obligation[]
): Obligation[] {
  return allTasks.filter(t => (t.dependsOnIds || []).includes(taskId));
}

/**
 * Computes all transitive downstream tasks unlocked by completing this task.
 */
export function getTransitiveUnlockedTasks(
  taskId: string,
  allTasks: Obligation[]
): Obligation[] {
  const visited = new Set<string>();
  const queue: string[] = [taskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const directDownstream = getDirectDownstreamDependents(currentId, allTasks);

    for (const downstream of directDownstream) {
      if (!visited.has(downstream.id)) {
        visited.add(downstream.id);
        queue.push(downstream.id);
      }
    }
  }

  return Array.from(visited)
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Obligation => t !== undefined);
}

/**
 * Validates whether adding targetPrerequisiteId to sourceTaskId would create a cycle or invalid reference.
 */
export function canAddDependency(
  sourceTaskId: string,
  targetPrerequisiteId: string,
  allTasks: Obligation[]
): { allowed: boolean; reason?: string } {
  if (sourceTaskId === targetPrerequisiteId) {
    return { allowed: false, reason: 'A task cannot depend on itself.' };
  }

  const sourceTask = allTasks.find(t => t.id === sourceTaskId);
  if (!sourceTask) {
    return { allowed: false, reason: 'Source task not found.' };
  }

  if ((sourceTask.dependsOnIds || []).includes(targetPrerequisiteId)) {
    return { allowed: false, reason: 'This prerequisite is already connected.' };
  }

  // Cycle check: verify if sourceTaskId is already in the upstream or downstream path
  // If targetPrerequisiteId already transitively depends on sourceTaskId, adding this creates a cycle!
  const downstreamOfSource = getTransitiveUnlockedTasks(sourceTaskId, allTasks);
  if (downstreamOfSource.some(t => t.id === targetPrerequisiteId)) {
    return {
      allowed: false,
      reason: 'Circular dependency: the target task is already downstream of this task.',
    };
  }

  return { allowed: true };
}

/**
 * Adds a prerequisite dependency and persists to localStorage.
 */
export function addDependency(taskId: string, prerequisiteId: string): boolean {
  const obligations = getObligations();
  const validation = canAddDependency(taskId, prerequisiteId, obligations);
  if (!validation.allowed) return false;

  const task = obligations.find(t => t.id === taskId);
  if (!task) return false;

  task.dependsOnIds = [...(task.dependsOnIds || []), prerequisiteId];
  saveObligation(task);
  return true;
}

/**
 * Removes a prerequisite dependency and persists to localStorage.
 */
export function removeDependency(taskId: string, prerequisiteId: string): void {
  const obligations = getObligations();
  const task = obligations.find(t => t.id === taskId);
  if (!task || !task.dependsOnIds) return;

  task.dependsOnIds = task.dependsOnIds.filter(id => id !== prerequisiteId);
  saveObligation(task);
}

/**
 * Builds full graph node representation for all obligations.
 */
export function buildGraphNodes(allTasks: Obligation[]): TaskGraphNode[] {
  // Compute topological level
  const levels = new Map<string, number>();

  function getLevel(task: Obligation, depth = 0): number {
    if (depth > 20) return 0; // Guard against unexpected cycles
    if (levels.has(task.id)) return levels.get(task.id)!;

    const prereqIds = task.dependsOnIds || [];
    if (prereqIds.length === 0) {
      levels.set(task.id, 0);
      return 0;
    }

    let maxPrereqLevel = 0;
    for (const pid of prereqIds) {
      const prereq = allTasks.find(t => t.id === pid);
      if (prereq) {
        maxPrereqLevel = Math.max(maxPrereqLevel, getLevel(prereq, depth + 1) + 1);
      }
    }

    levels.set(task.id, maxPrereqLevel);
    return maxPrereqLevel;
  }

  allTasks.forEach(t => getLevel(t));

  return allTasks.map(task => {
    const status = getTaskDependencyStatus(task, allTasks);
    const prereqIds = task.dependsOnIds || [];
    const prerequisites = prereqIds
      .map(id => allTasks.find(t => t.id === id))
      .filter((t): t is Obligation => t !== undefined);

    const unresolvedPrerequisites = prerequisites.filter(p => p.status !== 'completed');
    const downstreamDependents = getDirectDownstreamDependents(task.id, allTasks);
    const transitiveUnlocked = getTransitiveUnlockedTasks(task.id, allTasks);

    return {
      obligation: task,
      status,
      prerequisites,
      unresolvedPrerequisites,
      downstreamDependents,
      transitiveUnlockCount: transitiveUnlocked.length,
      level: levels.get(task.id) || 0,
    };
  });
}

/**
 * Calculates the "Next Best Action" recommendation:
 * Ranks all READY tasks by how many and how urgent the downstream tasks they unlock are.
 */
export function calculateNextBestAction(
  allTasks: Obligation[]
): NextBestActionRecommendation | null {
  const readyTasks = allTasks.filter(t => t.status === 'confirmed' && getTaskDependencyStatus(t, allTasks) === 'ready');
  if (readyTasks.length === 0) return null;

  let bestTask: Obligation | null = null;
  let bestScore = -1;
  let bestUnlocked: Obligation[] = [];
  let bestMostUrgentDownstream: Obligation | undefined;

  const now = new Date().getTime();

  for (const task of readyTasks) {
    const transitiveUnlocked = getTransitiveUnlockedTasks(task.id, allTasks);
    const incompleteUnlocked = transitiveUnlocked.filter(t => t.status !== 'completed');

    // Score based on:
    // 1. Number of incomplete downstream tasks unlocked (high weight: 50 pts each)
    // 2. Proximity of downstream tasks' due dates
    // 3. Proximity of the ready task's own due date
    let score = incompleteUnlocked.length * 50;

    let mostUrgentDownstream: Obligation | undefined;
    let closestDownstreamDiff = Infinity;

    for (const downstream of incompleteUnlocked) {
      const dueTime = new Date(downstream.dueDate).getTime();
      const daysUntil = (dueTime - now) / (1000 * 60 * 60 * 24);
      if (daysUntil < closestDownstreamDiff) {
        closestDownstreamDiff = daysUntil;
        mostUrgentDownstream = downstream;
      }
      if (daysUntil <= 14) score += 30;
      if (daysUntil <= 7) score += 50;
      if (daysUntil <= 0) score += 80; // Overdue downstream
    }

    // Own due date urgency
    const ownDueTime = new Date(task.dueDate).getTime();
    const ownDaysUntil = (ownDueTime - now) / (1000 * 60 * 60 * 24);
    if (ownDaysUntil <= 7) score += 40;
    if (ownDaysUntil <= 0) score += 60;

    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
      bestUnlocked = incompleteUnlocked;
      bestMostUrgentDownstream = mostUrgentDownstream;
    }
  }

  if (!bestTask) return null;

  // Build natural explanation
  let explanation = '';
  if (bestUnlocked.length > 0) {
    if (bestMostUrgentDownstream) {
      explanation = `Completing "${bestTask.title}" unblocks ${bestUnlocked.length} downstream ${
        bestUnlocked.length === 1 ? 'obligation' : 'obligations'
      }, including "${bestMostUrgentDownstream.title}" (Due ${bestMostUrgentDownstream.dueDate}).`;
    } else {
      explanation = `Completing "${bestTask.title}" unlocks ${bestUnlocked.length} downstream ${
        bestUnlocked.length === 1 ? 'task' : 'tasks'
      } on your critical path.`;
    }
  } else {
    explanation = `"${bestTask.title}" is ready to act upon with no dependencies holding it up (Due ${bestTask.dueDate}).`;
  }

  return {
    task: bestTask,
    unlockCount: bestUnlocked.length,
    unlockedTasks: bestUnlocked,
    mostUrgentDownstreamTask: bestMostUrgentDownstream,
    explanation,
  };
}

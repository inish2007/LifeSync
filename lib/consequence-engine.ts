import { Obligation, ConsequenceProvenance, ConsequenceType } from './types';
import { getTaskDependencyStatus, getTransitiveUnlockedTasks } from './graph';

export interface UrgencyAssessment {
  score: number;
  level: 'critical' | 'high' | 'moderate' | 'standard';
  badgeColor: 'red' | 'amber' | 'blue' | 'gray';
  badgeLabel: string;
  reason: string;
}

/**
 * Classifies the type of consequence based on text semantics.
 */
export function detectConsequenceType(text?: string | null): ConsequenceType {
  if (!text) return 'general';
  const lower = text.toLowerCase();
  if (
    lower.includes('lapse') ||
    lower.includes('cancellation') ||
    lower.includes('disconnect') ||
    lower.includes('shutoff') ||
    lower.includes('downgrade') ||
    lower.includes('interruption') ||
    lower.includes('service suspended')
  ) {
    return 'service_interruption';
  }

  if (
    lower.includes('late fee') ||
    lower.includes('surcharge') ||
    lower.includes('late payment') ||
    lower.includes('interest charge') ||
    lower.includes('monetary penalty') ||
    /(\$\d+|₹\d+|€\d+)/.test(text)
  ) {
    return 'late_fee';
  }

  if (
    lower.includes('eligibility') ||
    lower.includes('month-to-month') ||
    lower.includes('forfeit') ||
    lower.includes('discount lost') ||
    lower.includes('rate bump') ||
    lower.includes('holdover')
  ) {
    return 'missed_eligibility';
  }

  if (
    lower.includes('collection') ||
    lower.includes('dmv') ||
    lower.includes('reconnection charge') ||
    lower.includes('inspection') ||
    lower.includes('follow-up')
  ) {
    return 'required_followup';
  }

  return 'general';
}

/**
 * Returns a human-friendly label for the consequence category.
 */
export function getConsequenceCategoryLabel(type?: ConsequenceType): string {
  switch (type) {
    case 'service_interruption':
      return 'Service Interruption';
    case 'late_fee':
      return 'Late Fee / Surcharge';
    case 'missed_eligibility':
      return 'Missed Eligibility / Rate Increase';
    case 'required_followup':
      return 'Required Follow-up / Collections';
    default:
      return 'General Notice';
  }
}

/**
 * Calculates a comprehensive urgency assessment using:
 * 1. Documented consequence severity (never inventing penalties for Unknown)
 * 2. Due date proximity
 * 3. Dependency status (Ready tasks score higher; tasks unblocking critical ones inherit urgency)
 */
export function calculateUrgency(
  task: Obligation,
  allTasks: Obligation[]
): UrgencyAssessment {
  if (task.status === 'completed') {
    return {
      score: 0,
      level: 'standard',
      badgeColor: 'gray',
      badgeLabel: 'Closed Loop',
      reason: 'Obligation has been completed.',
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const depStatus = getTaskDependencyStatus(task, allTasks);
  const isReady = depStatus === 'ready';

  const provenance = task.consequenceProvenance || 'From document';
  const isUnknown =
    provenance === 'Unknown' ||
    !task.consequence ||
    task.consequence.toLowerCase().includes('no specific financial penalty') ||
    task.consequence.toLowerCase().includes('no documented consequence');

  const consequenceType = task.consequenceType || detectConsequenceType(task.consequence);

  let score = 50;

  // 1. Due date urgency
  if (diffDays < 0) {
    score += 120; // Overdue
  } else if (diffDays === 0) {
    score += 100; // Due today
  } else if (diffDays <= 2) {
    score += 80;
  } else if (diffDays <= 5) {
    score += 60;
  } else if (diffDays <= 10) {
    score += 40;
  } else if (diffDays <= 20) {
    score += 20;
  }

  // 2. Consequence weighting (ONLY for confirmed/documented consequences — never invent penalties!)
  if (!isUnknown) {
    switch (consequenceType) {
      case 'service_interruption':
        score += 85; // Highest impact (coverage lapse, utility disconnect)
        break;
      case 'late_fee':
        score += 65; // Financial loss
        break;
      case 'missed_eligibility':
        score += 55; // Long term cost / lost fixed rate
        break;
      case 'required_followup':
        score += 45; // Friction / bureaucracy
        break;
      default:
        score += 25;
    }
  }

  // 3. Dependency status bonus
  if (isReady) {
    score += 35; // Actionable now

    // Check downstream unblocking impact
    const unlocked = getTransitiveUnlockedTasks(task.id, allTasks).filter(
      t => t.status !== 'completed'
    );
    if (unlocked.length > 0) {
      score += unlocked.length * 20;

      // If this ready task unblocks a task with an imminent service interruption or late fee:
      const hasCriticalDownstream = unlocked.some(u => {
        const uDue = new Date(u.dueDate).getTime();
        const days = (uDue - now.getTime()) / (1000 * 60 * 60 * 24);
        const uType = u.consequenceType || detectConsequenceType(u.consequence);
        return days <= 14 && (uType === 'service_interruption' || uType === 'late_fee');
      });

      if (hasCriticalDownstream) {
        score += 50;
      }
    }
  } else {
    // Blocked tasks are slightly dampened since you cannot act on them directly yet
    score -= 15;
  }

  // Determine Level and Label
  let level: 'critical' | 'high' | 'moderate' | 'standard' = 'standard';
  let badgeColor: 'red' | 'amber' | 'blue' | 'gray' = 'blue';
  let badgeLabel = 'Standard Urgency';
  let reason = '';

  if (score >= 170 || diffDays <= 1) {
    level = 'critical';
    badgeColor = 'red';
    badgeLabel = 'Critical Urgency';
    reason = diffDays < 0
      ? `Overdue by ${Math.abs(diffDays)} days with active consequence risk.`
      : diffDays === 0
      ? 'Due today — immediate action required to prevent documented consequences.'
      : 'Immediate deadline combined with severe documented consequence.';
  } else if (score >= 120 || diffDays <= 5) {
    level = 'high';
    badgeColor = 'amber';
    badgeLabel = 'High Urgency';
    reason = `Due in ${diffDays} days with active consequence (${getConsequenceCategoryLabel(consequenceType)}).`;
  } else if (score >= 80 || diffDays <= 14) {
    level = 'moderate';
    badgeColor = 'blue';
    badgeLabel = 'Moderate Urgency';
    reason = `Upcoming deadline in ${diffDays} days.`;
  } else {
    level = 'standard';
    badgeColor = 'gray';
    badgeLabel = 'Low Urgency';
    reason = `Sufficient time remaining (${diffDays} days).`;
  }

  return {
    score,
    level,
    badgeColor,
    badgeLabel,
    reason,
  };
}

/**
 * Generates a clear, contextual "Why now?" explanation for any task.
 * Synthesizes:
 * - Deadline timing
 * - Documented consequence and its provenance ("From document", "Added by you", or "Unknown")
 * - Immediate dependency unblocking impact
 */
export function generateWhyNowExplanation(
  task: Obligation,
  allTasks: Obligation[]
): string {
  if (task.status === 'completed') {
    return 'Loop closed: this obligation was already completed and verified.';
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const depStatus = getTaskDependencyStatus(task, allTasks);
  const isReady = depStatus === 'ready';

  const provenance = task.consequenceProvenance || 'From document';
  const isUnknown =
    provenance === 'Unknown' ||
    !task.consequence ||
    task.consequence.toLowerCase().includes('no specific financial penalty') ||
    task.consequence.toLowerCase().includes('no documented consequence');

  const transitiveUnlocked = isReady
    ? getTransitiveUnlockedTasks(task.id, allTasks).filter(t => t.status !== 'completed')
    : [];

  let timingText = '';
  if (diffDays < 0) {
    timingText = `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`;
  } else if (diffDays === 0) {
    timingText = 'Due today';
  } else if (diffDays === 1) {
    timingText = 'Due tomorrow';
  } else {
    timingText = `Due in ${diffDays} days (${task.dueDate})`;
  }

  // 1. If task is Ready and unblocks downstream tasks with high consequences
  if (isReady && transitiveUnlocked.length > 0) {
    const nextTask = transitiveUnlocked[0];
    const nextConsequence = nextTask.consequence;
    const nextProvenance = nextTask.consequenceProvenance || 'From document';

    if (nextConsequence && !nextConsequence.toLowerCase().includes('no specific')) {
      return `${timingText}: Ready to act immediately. Completing this unblocks "${nextTask.title}", which carries a documented consequence ("${nextConsequence}" [${nextProvenance}]) on ${nextTask.dueDate}.`;
    }

    return `${timingText}: Unblocks ${transitiveUnlocked.length} downstream ${
      transitiveUnlocked.length === 1 ? 'obligation' : 'obligations'
    } on your critical path, including "${nextTask.title}".`;
  }

  // 2. If task has a documented consequence from document or user
  if (!isUnknown && task.consequence) {
    return `${timingText}: Acting now avoids "${task.consequence}" [${provenance}].`;
  }

  // 3. If consequence is unknown (never invent fake consequences!)
  return `${timingText}: Consequence is unconfirmed [Unknown]. Acting now keeps your account current with ${task.payee} and prevents administrative delays.`;
}

/**
 * Sorts obligations by Consequence Engine urgency rank (highest urgency first).
 */
export function rankTasksByUrgency(
  tasks: Obligation[]
): Array<{ task: Obligation; urgency: UrgencyAssessment; whyNow: string }> {
  return tasks
    .map(task => ({
      task,
      urgency: calculateUrgency(task, tasks),
      whyNow: generateWhyNowExplanation(task, tasks),
    }))
    .sort((a, b) => b.urgency.score - a.urgency.score);
}

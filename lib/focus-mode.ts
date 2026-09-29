import { Obligation, FocusRecommendation } from './types';
import { getTaskDependencyStatus, getTransitiveUnlockedTasks, getUnresolvedPrerequisites } from './graph';
import { calculateAllBackplans, daysDifference, getReferenceToday } from './backplanner';
import { detectConsequenceType } from './consequence-engine';

export type { FocusRecommendation };

/**
 * Returns estimated hands-on time in minutes for an obligation.
 * Uses user-set estimatedMinutes if present, or derives an intelligent estimate
 * based on the action description and category.
 */
export function getEstimatedTimeMinutes(task: Obligation): number {
  if (task.estimatedMinutes && task.estimatedMinutes > 0) {
    return task.estimatedMinutes;
  }

  const text = `${task.requiredAction} ${task.title} ${task.category}`.toLowerCase();

  // Quick online tasks (< 10 mins)
  if (
    text.includes('photo') ||
    text.includes('odometer') ||
    text.includes('upi') ||
    text.includes('portal') ||
    text.includes('quickpay') ||
    text.includes('call') ||
    text.includes('schedule') ||
    text.includes('pay online') ||
    text.includes('confirm stall')
  ) {
    return 10;
  }

  // Document review & digital sign (15-20 mins)
  if (
    text.includes('docusign') ||
    text.includes('sign') ||
    text.includes('addendum') ||
    text.includes('form') ||
    text.includes('review')
  ) {
    return 15;
  }

  // In-person appointments, inspections (45 mins)
  if (
    text.includes('inspection') ||
    text.includes('station') ||
    text.includes('appointment') ||
    text.includes('drive') ||
    text.includes('hygiene') ||
    text.includes('exam')
  ) {
    return 45;
  }

  // Bureaucratic, passport, notarization, courier (60-90 mins)
  if (
    text.includes('passport') ||
    text.includes('notarize') ||
    text.includes('courier') ||
    text.includes('biometric') ||
    text.includes('hearing') ||
    text.includes('audit')
  ) {
    return 60;
  }

  // Fallback based on estimatedDurationDays (e.g. 1 day of backplanner work translates to ~25 min hands-on action)
  const duration = task.estimatedDurationDays ?? 1;
  return Math.min(90, Math.max(15, duration * 20));
}

/**
 * Formats minutes into human-readable label (e.g., "10 mins", "45 mins", "1 hr 15 mins")
 */
export function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours}h ${remaining}m`;
}

/**
 * Returns an effort categorization label for overwhelmed users
 */
export function getEffortTier(minutes: number): {
  label: string;
  badgeClass: string;
  isQuickWin: boolean;
} {
  if (minutes <= 15) {
    return { label: 'Quick Win (~15m)', badgeClass: 'green', isQuickWin: true };
  }
  if (minutes <= 35) {
    return { label: 'Moderate (~30m)', badgeClass: 'blue', isQuickWin: false };
  }
  return { label: 'Deep Focus (45m+)', badgeClass: 'amber', isQuickWin: false };
}

/**
 * Generates a concise, high-clarity "Why this matters now" explanation
 * combining consequence, deadline, effort, and dependency unlock benefits.
 */
export function generateFocusWhyThisMatters(
  task: Obligation,
  allTasks: Obligation[],
  diffDays: number,
  estimatedMinutes: number,
  unlocksCount: number,
  backplanOverrun: boolean
): string {
  const estText = formatEstimatedTime(estimatedMinutes);
  const consequenceType = task.consequenceType || detectConsequenceType(task.consequence);
  const provenance = task.consequenceProvenance || 'From document';
  const isDocumented = provenance !== 'Unknown' && task.consequence && !task.consequence.toLowerCase().includes('no documented consequence');

  // Case 1: Overdue Task (Critical emergency)
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    if (isDocumented) {
      return `Critically overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}. Takes ~${estText} to resolve now and prevent further escalating consequence: "${task.consequence}".`;
    }
    return `Critically overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}. Immediate resolution (~${estText}) restores your schedule and clears past-due liability.`;
  }

  // Case 2: Schedule Overrun from Deadline Backplanner
  if (backplanOverrun) {
    return `Lead-time emergency: Work required exceeds calendar days left before ${task.dueDate}. Takes ~${estText} today to compress delay and protect against: "${task.consequence || 'deadline lapse'}".`;
  }

  // Case 3: Ready Task that Unlocks Downstream Obligations
  if (unlocksCount > 0) {
    const unlockedTitles = getTransitiveUnlockedTasks(task.id, allTasks)
      .map(t => t.title)
      .slice(0, 2)
      .join(' and ');

    if (estimatedMinutes <= 15) {
      return `High-leverage quick win: Takes just ~${estText} and immediately unblocks ${unlocksCount} downstream ${unlocksCount === 1 ? 'step' : 'steps'} (${unlockedTitles}), keeping your whole chain on track.`;
    }
    return `Key bottleneck: Takes ~${estText} and directly unblocks ${unlocksCount} downstream ${unlocksCount === 1 ? 'task' : 'tasks'} (${unlockedTitles}) before upcoming deadlines.`;
  }

  // Case 4: Imminent Deadline with Severe Consequence (Service Interruption or Late Fee)
  if (diffDays <= 3) {
    if (consequenceType === 'service_interruption') {
      return `Imminent cutoff: Due in ${diffDays === 0 ? 'today' : `${diffDays} days`}. Takes ~${estText} to secure continuous service and avoid interruption.`;
    }
    if (consequenceType === 'late_fee') {
      return `Save unnecessary money: Takes only ~${estText} to complete before ${task.dueDate} and avoid documented late penalties.`;
    }
    if (consequenceType === 'missed_eligibility') {
      return `Preserve favorable terms: Takes ~${estText} to submit before ${task.dueDate} and lock in renewal eligibility.`;
    }
  }

  // Case 5: Quick win for general tasks
  if (estimatedMinutes <= 15) {
    return `Fast mental win: Requires only ~${estText} of hands-on effort to close this loop completely and reduce mental clutter today.`;
  }

  // Standard fallback
  return `Due on ${task.dueDate}. Takes ~${estText} to complete and eliminate pending obligation with ${task.payee}.`;
}

export interface FocusCalculationResult {
  topThree: FocusRecommendation[];
  criticalOverdueTasks: FocusRecommendation[];
  allActiveCount: number;
}

/**
 * Calculates Focus Mode priorities using:
 * 1. Deadline (Overdue, due today, proximity, Backplanner deficit)
 * 2. Documented Consequence (Service interruption, late fee, eligibility, proven provenance)
 * 3. Blocked Dependencies (Ready tasks prioritized; blocked tasks penalized)
 * 4. Available Effort (Quick wins get momentum boost for overwhelmed users)
 * 5. Tasks that Unlock Others (Prerequisites unlocking downstream tasks scored higher)
 *
 * CRITICAL RULE: Never hide critical overdue tasks!
 */
export function calculateFocusPriorities(
  obligations: Obligation[],
  customToday?: Date | string
): FocusCalculationResult {
  const todayStr = getReferenceToday(customToday);
  const backplans = calculateAllBackplans(obligations, customToday);

  // Filter only active / open obligations
  const activeTasks = obligations.filter(o => o.status === 'confirmed' || o.status === 'waiting');

  const scoredRecommendations: FocusRecommendation[] = activeTasks.map(task => {
    const diffDays = daysDifference(todayStr, task.dueDate);
    const isOverdue = diffDays < 0;
    const daysOverdue = isOverdue ? Math.abs(diffDays) : 0;
    const depStatus = getTaskDependencyStatus(task, obligations);
    const isReady = depStatus === 'ready';
    const isBlocked = depStatus === 'blocked';
    const backplan = backplans.get(task.id);
    const backplanOverrun = backplan ? !backplan.fitsBeforeDeadline : false;
    const estimatedMinutes = getEstimatedTimeMinutes(task);
    const unlocked = getTransitiveUnlockedTasks(task.id, obligations).filter(t => t.status !== 'completed');
    const unlocksCount = isReady ? unlocked.length : 0;

    // 1. DEADLINE SCORING
    let deadlineScore = 0;
    if (isOverdue) {
      deadlineScore = 200 + Math.min(60, daysOverdue * 15); // Massive priority for overdue
    } else if (diffDays === 0) {
      deadlineScore = 150; // Due today
    } else if (diffDays === 1) {
      deadlineScore = 130;
    } else if (diffDays <= 3) {
      deadlineScore = 110;
    } else if (diffDays <= 7) {
      deadlineScore = 80;
    } else if (diffDays <= 14) {
      deadlineScore = 50;
    } else {
      deadlineScore = 25;
    }

    // Backplanner urgency bonus
    if (backplanOverrun) {
      deadlineScore += 75; // Schedule deficit!
    } else if (backplan && backplan.recommendedStartDate <= todayStr) {
      deadlineScore += 45; // Start date has arrived
    }

    // 2. DOCUMENTED CONSEQUENCE SCORING (Never invent penalties for Unknown)
    let consequenceScore = 0;
    const provenance = task.consequenceProvenance || 'From document';
    const isKnown = provenance !== 'Unknown' && task.consequence && !task.consequence.toLowerCase().includes('no documented');
    const consequenceType = task.consequenceType || detectConsequenceType(task.consequence);

    if (isKnown) {
      switch (consequenceType) {
        case 'service_interruption':
          consequenceScore = 120; // Critical loss of utility/coverage
          break;
        case 'late_fee':
          consequenceScore = 90;  // Financial loss
          break;
        case 'missed_eligibility':
          consequenceScore = 80;  // Rent increase / loss of rate
          break;
        case 'required_followup':
          consequenceScore = 60;  // DMV inspection / bureaucracy
          break;
        default:
          consequenceScore = 40;
      }
      if (provenance === 'From document') {
        consequenceScore += 20; // Verified directly from upload
      }
    } else {
      consequenceScore = 15; // Modest baseline, no invented penalties
    }

    // 3. BLOCKED DEPENDENCIES SCORING
    let dependencyScore = 0;
    if (isReady) {
      dependencyScore = 100; // Ready to act today
    } else if (isBlocked) {
      dependencyScore = -80; // Cannot act yet, blocked by earlier step
    }

    // 4. AVAILABLE EFFORT SCORING (Quick wins give immediate psychological relief)
    let effortScore = 0;
    if (estimatedMinutes <= 10) {
      effortScore = 55; // Under 10 minutes: extreme quick win
    } else if (estimatedMinutes <= 20) {
      effortScore = 40;
    } else if (estimatedMinutes <= 40) {
      effortScore = 25;
    } else if (estimatedMinutes <= 60) {
      effortScore = 10;
    } else {
      effortScore = 0;
    }

    // 5. TASKS THAT UNLOCK OTHERS SCORING
    let unlockScore = 0;
    if (isReady && unlocksCount > 0) {
      unlockScore = unlocksCount * 45; // Huge boost for unblocking downstream tasks

      // Extra bonus if any unlocked task has a critical consequence or tight deadline
      const hasCriticalDownstream = unlocked.some(u => {
        const uDiff = daysDifference(todayStr, u.dueDate);
        const uType = u.consequenceType || detectConsequenceType(u.consequence);
        return uDiff <= 10 || uType === 'service_interruption' || uType === 'late_fee';
      });

      if (hasCriticalDownstream) {
        unlockScore += 50;
      }
    }

    const priorityScore = deadlineScore + consequenceScore + dependencyScore + effortScore + unlockScore;

    const whyThisMattersNow = generateFocusWhyThisMatters(
      task,
      obligations,
      diffDays,
      estimatedMinutes,
      unlocksCount,
      backplanOverrun
    );

    return {
      task,
      rank: 0, // Assigned after sorting
      whyThisMattersNow,
      estimatedTimeDisplay: formatEstimatedTime(estimatedMinutes),
      estimatedTimeMinutes: estimatedMinutes,
      isOverdue,
      daysOverdue: isOverdue ? daysOverdue : undefined,
      dependencyStatus: depStatus,
      unlocksCount,
      priorityScore,
      breakdown: {
        deadlineScore,
        consequenceScore,
        dependencyScore,
        effortScore,
        unlockScore,
      },
    };
  });

  // Sort: Overdue tasks ALWAYS first, then by total priority score descending
  scoredRecommendations.sort((a, b) => {
    // Overdue tasks take absolute precedence
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Both overdue: sort by most overdue days + priority
    if (a.isOverdue && b.isOverdue) {
      return (b.daysOverdue || 0) - (a.daysOverdue || 0) || b.priorityScore - a.priorityScore;
    }

    return b.priorityScore - a.priorityScore;
  });

  // Assign ranks
  scoredRecommendations.forEach((rec, idx) => {
    rec.rank = idx + 1;
  });

  // Top 3 most useful actions for today
  const topThree = scoredRecommendations.filter(r => r.task.status === 'confirmed' && r.dependencyStatus === 'ready').slice(0, 3);
  topThree.forEach((rec, index) => { rec.rank = index + 1; });

  // Any critical overdue tasks: MUST NEVER BE HIDDEN!
  // Find all overdue tasks across all active tasks
  const criticalOverdueTasks = scoredRecommendations.filter(r => r.isOverdue);

  return {
    topThree,
    criticalOverdueTasks,
    allActiveCount: activeTasks.length,
  };
}

import { Obligation, BackplannerResult } from './types';
import { getDirectDownstreamDependents } from './graph';

/**
 * Standard date formatting helper (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD safely into a local midnight Date object
 */
export function parseDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    const d = new Date(dateInput.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (typeof dateInput !== 'string') {
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const [year, month, day] = dateInput.split('-').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string
 */
export function offsetDate(dateStr: string | Date, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * Calculates calendar day difference between two dates (date2 - date1)
 */
export function daysDifference(fromDateStr: string | Date, toDateStr: string | Date): number {
  const from = parseDate(fromDateStr);
  const to = parseDate(toDateStr);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns today's date formatted as YYYY-MM-DD at local midnight
 */
export function getReferenceToday(customDate?: string | Date): string {
  if (customDate) {
    return typeof customDate === 'string' ? customDate : formatDate(customDate);
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return formatDate(now);
}

/**
 * Calculates Deadline Backplanner results for all obligations in the workspace.
 * Recursively resolves backward constraints:
 * If Task A unlocks Task B, Task A must be completed before Task B's recommended start date.
 */
export function calculateAllBackplans(
  obligations: Obligation[],
  customToday?: string | Date
): Map<string, BackplannerResult> {
  const results = new Map<string, BackplannerResult>();
  const visiting = new Set<string>(); // Cycle prevention
  const todayStr = getReferenceToday(customToday);

  function resolveBackplan(task: Obligation): BackplannerResult {
    if (results.has(task.id)) {
      return results.get(task.id)!;
    }

    visiting.add(task.id);

    const duration = Math.max(1, task.estimatedDurationDays ?? 1);
    const buffer = Math.max(0, task.bufferDays ?? 1);
    const totalRequiredLeadDays = duration + buffer;

    // Start with the task's own due date as the baseline deadline
    let effectiveDeadline = task.dueDate;
    let constrainedByDownstream: BackplannerResult['constrainedByDownstream'] = undefined;

    // Find all direct downstream tasks that depend on this task
    const downstreamTasks = getDirectDownstreamDependents(task.id, obligations).filter(
      d => d.status !== 'completed'
    );

    // For each downstream task, it must start AFTER this task is done
    for (const downstream of downstreamTasks) {
      // Prevent circular recursion if user configured cyclic dependencies
      if (visiting.has(downstream.id)) continue;

      const downstreamPlan = resolveBackplan(downstream);
      // Downstream task needs to start on downstreamPlan.recommendedStartDate.
      // Therefore, this prerequisite task must finish on or before that date.
      if (downstreamPlan.recommendedStartDate < effectiveDeadline) {
        effectiveDeadline = downstreamPlan.recommendedStartDate;
        constrainedByDownstream = {
          id: downstream.id,
          title: downstream.title,
          requiredByDate: downstreamPlan.recommendedStartDate,
        };
      }
    }

    visiting.delete(task.id);

    // Calculate recommended start date = effectiveDeadline - totalRequiredLeadDays
    const recommendedStartDate = offsetDate(effectiveDeadline, -totalRequiredLeadDays);

    // Available calendar days from today until effective deadline
    const availableCalendarDays = daysDifference(todayStr, effectiveDeadline);

    // Check if the work fits before the deadline
    const fitsBeforeDeadline = availableCalendarDays >= totalRequiredLeadDays;
    const deficitDays = fitsBeforeDeadline ? 0 : totalRequiredLeadDays - availableCalendarDays;

    // Determine schedule health
    let scheduleHealth: 'comfortable' | 'tight' | 'overrun';
    if (!fitsBeforeDeadline || recommendedStartDate < todayStr) {
      scheduleHealth = 'overrun';
    } else if (availableCalendarDays <= totalRequiredLeadDays + 2 || recommendedStartDate === todayStr) {
      scheduleHealth = 'tight';
    } else {
      scheduleHealth = 'comfortable';
    }

    // Generate plain language explanation
    const plainLanguageExplanation = generatePlainLanguageBackplan(
      task,
      effectiveDeadline,
      duration,
      buffer,
      recommendedStartDate,
      availableCalendarDays,
      fitsBeforeDeadline,
      deficitDays,
      constrainedByDownstream,
      todayStr
    );

    const calculationBreakdown = {
      deadlineLabel: constrainedByDownstream
        ? `Downstream Start Constraint (for "${constrainedByDownstream.title}")`
        : `Target Due Date`,
      deadlineDate: effectiveDeadline,
      downstreamConstraintNote: constrainedByDownstream
        ? `Own due date is ${task.dueDate}, but downstream task "${constrainedByDownstream.title}" requires this by ${constrainedByDownstream.requiredByDate}.`
        : undefined,
      durationLabel: `${duration} ${duration === 1 ? 'day' : 'days'} estimated work duration`,
      bufferLabel: `${buffer} ${buffer === 1 ? 'day' : 'days'} safety buffer margin`,
      recommendedStartLabel: `Start by ${recommendedStartDate} (${totalRequiredLeadDays} lead ${totalRequiredLeadDays === 1 ? 'day' : 'days'} required)`,
      fitAssessment: fitsBeforeDeadline
        ? `Fits comfortably with ${availableCalendarDays - totalRequiredLeadDays} days slack.`
        : `⚠️ Overrun: Schedule is in deficit by ${deficitDays} ${deficitDays === 1 ? 'day' : 'days'}. Work does not fit before deadline.`,
    };

    const result: BackplannerResult = {
      taskId: task.id,
      recommendedStartDate,
      effectiveDeadline,
      durationDays: duration,
      bufferDays: buffer,
      totalLeadDaysRequired: totalRequiredLeadDays,
      availableCalendarDays,
      fitsBeforeDeadline,
      deficitDays,
      constrainedByDownstream,
      scheduleHealth,
      plainLanguageExplanation,
      calculationBreakdown,
    };

    results.set(task.id, result);
    return result;
  }

  for (const obligation of obligations) {
    resolveBackplan(obligation);
  }

  return results;
}

/**
 * Formats a single obligation's backward calculation into clear plain language.
 */
export function generatePlainLanguageBackplan(
  task: Obligation,
  effectiveDeadline: string,
  duration: number,
  buffer: number,
  recommendedStartDate: string,
  availableDays: number,
  fits: boolean,
  deficitDays: number,
  downstreamConstraint: BackplannerResult['constrainedByDownstream'],
  todayStr: string
): string {
  const totalDays = duration + buffer;
  const daysUntilStart = daysDifference(todayStr, recommendedStartDate);

  // Scenario 1: Work no longer fits before deadline
  if (!fits) {
    const constraintText = downstreamConstraint
      ? `to unlock "${downstreamConstraint.title}" by ${downstreamConstraint.requiredByDate}`
      : `before deadline on ${effectiveDeadline}`;
    return `Schedule Overrun: Requires ${totalDays} days (${duration}d duration + ${buffer}d buffer), but only ${Math.max(0, availableDays)} days remain ${constraintText}. Work is in deficit by ${deficitDays} ${deficitDays === 1 ? 'day' : 'days'} — start immediately and compress buffer.`;
  }

  // Scenario 2: Must start today
  if (daysUntilStart === 0) {
    const constraintText = downstreamConstraint
      ? `to hand off to "${downstreamConstraint.title}" on ${downstreamConstraint.requiredByDate}`
      : `to finish on ${effectiveDeadline}`;
    return `Action Needed Today: Working backward from ${effectiveDeadline} (${duration}d duration + ${buffer}d buffer), recommended start is today (${recommendedStartDate}) ${constraintText}.`;
  }

  // Scenario 3: Recommended start is already in the past
  if (daysUntilStart < 0) {
    return `Schedule Behind: Working backward required starting ${Math.abs(daysUntilStart)} ${Math.abs(daysUntilStart) === 1 ? 'day' : 'days'} ago on ${recommendedStartDate} to protect your ${buffer}d buffer before ${effectiveDeadline}. Start today to avoid delay.`;
  }

  // Scenario 4: Comfortable or tight schedule in the future
  const constraintClause = downstreamConstraint
    ? ` (held by downstream "${downstreamConstraint.title}" starting on ${downstreamConstraint.requiredByDate})`
    : '';

  return `Start by ${recommendedStartDate}: Working backward from ${effectiveDeadline}${constraintClause} allows ${duration}d for work and ${buffer}d safety buffer. You have ${daysUntilStart} ${daysUntilStart === 1 ? 'day' : 'days'} before work must begin.`;
}

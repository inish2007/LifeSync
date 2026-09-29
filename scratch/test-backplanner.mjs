import { calculateAllBackplans, generatePlainLanguageBackplan, parseIsoDate, formatIsoDate, addDaysToIsoDate } from '../lib/backplanner.js';

// Simulated obligations matching seed data
const obligations = [
  {
    id: 'step-1',
    title: 'Gather Passport Documents',
    payee: 'City Records',
    dueDate: '2026-10-10',
    estimatedDurationDays: 3,
    bufferDays: 2,
    dependsOnIds: [],
    status: 'confirmed'
  },
  {
    id: 'step-2',
    title: 'Submit Expedited Passport Application',
    payee: 'US State Dept',
    dueDate: '2026-10-12',
    estimatedDurationDays: 2,
    bufferDays: 1,
    dependsOnIds: ['step-1'],
    status: 'confirmed'
  },
  {
    id: 'step-3',
    title: 'Urgent Overrun Task',
    payee: 'Embassy',
    dueDate: '2026-10-02', // Only 2 days from simulated today (2026-09-30)
    estimatedDurationDays: 4,
    bufferDays: 2, // Total lead time: 6 days, available: 2 days => Deficit 4 days!
    dependsOnIds: [],
    status: 'confirmed'
  }
];

const simulatedToday = new Date('2026-09-30T00:00:00Z');

console.log('Testing calculateAllBackplans with simulatedToday = 2026-09-30...');
const plans = calculateAllBackplans(obligations, simulatedToday);

for (const [id, plan] of plans.entries()) {
  const obl = obligations.find(o => o.id === id);
  console.log(`\n=== Task: "${obl.title}" (${id}) ===`);
  console.log(`Due Date: ${obl.dueDate}`);
  console.log(`Duration: ${plan.durationDays}d, Buffer: ${plan.bufferDays}d, Total Lead: ${plan.totalLeadDaysRequired}d`);
  console.log(`Effective Deadline: ${plan.effectiveDeadline}`);
  console.log(`Recommended Start Date: ${plan.recommendedStartDate}`);
  console.log(`Available Days: ${plan.availableCalendarDays}d`);
  console.log(`Fits Before Deadline: ${plan.fitsBeforeDeadline}`);
  console.log(`Schedule Health: ${plan.scheduleHealth}`);
  console.log(`Deficit Days: ${plan.deficitDays}d`);
  console.log(`Constrained by Downstream: ${plan.constrainedByDownstream}`);
  console.log(`Plain Language Explanation:\n  ${plan.plainLanguageExplanation}`);
  console.log(`Calculation Breakdown:\n  ${plan.calculationBreakdown.join('\n  ')}`);
}

// Test downstream constraint propagation:
// step-2 has due date 2026-10-12. Duration: 2, buffer: 1 => Total 3d lead time.
// Recommended start date of step-2 should be 2026-10-12 - 3 days = 2026-10-09.
// step-1 is prerequisite of step-2. So step-1 must finish before step-2 starts (i.e. by 2026-10-09).
// Even though step-1's own dueDate is 2026-10-10, its effective deadline must be capped at 2026-10-09!
const plan1 = plans.get('step-1');
const plan2 = plans.get('step-2');
console.log('\n--- Checking Downstream Dependency Propagation ---');
console.log(`step-2 Recommended Start: ${plan2.recommendedStartDate}`);
console.log(`step-1 Effective Deadline: ${plan1.effectiveDeadline}`);
if (plan1.effectiveDeadline === plan2.recommendedStartDate && plan1.constrainedByDownstream) {
  console.log('✅ PASS: step-1 effective deadline correctly constrained by step-2 recommended start date!');
} else {
  console.error('❌ FAIL: step-1 effective deadline was not properly constrained');
  process.exit(1);
}

// Test Overrun detection on step-3:
const plan3 = plans.get('step-3');
console.log('\n--- Checking Overrun Detection ---');
if (!plan3.fitsBeforeDeadline && plan3.scheduleHealth === 'overrun' && plan3.deficitDays > 0) {
  console.log(`✅ PASS: step-3 correctly flagged as Overrun with ${plan3.deficitDays} days deficit!`);
} else {
  console.error('❌ FAIL: step-3 was not flagged as overrun');
  process.exit(1);
}

// Test Dynamic Recalculation when prerequisite date changes:
console.log('\n--- Testing Recalculation on Downstream Due Date Change ---');
// Suppose step-2's deadline moves earlier to 2026-10-07
const updatedObligations = obligations.map(o => {
  if (o.id === 'step-2') return { ...o, dueDate: '2026-10-07' };
  return o;
});
const updatedPlans = calculateAllBackplans(updatedObligations, simulatedToday);
const updatedPlan1 = updatedPlans.get('step-1');
const updatedPlan2 = updatedPlans.get('step-2');
console.log(`step-2 New Due Date: 2026-10-07`);
console.log(`step-2 New Recommended Start: ${updatedPlan2.recommendedStartDate} (2026-10-07 - 3d = 2026-10-04)`);
console.log(`step-1 New Effective Deadline: ${updatedPlan1.effectiveDeadline} (must be 2026-10-04)`);
console.log(`step-1 New Recommended Start: ${updatedPlan1.recommendedStartDate} (2026-10-04 - 5d = 2026-09-29)`);
if (updatedPlan1.effectiveDeadline === '2026-10-04') {
  console.log('✅ PASS: Automatic recalculation correctly propagated earlier downstream date to prerequisite!');
} else {
  console.error('❌ FAIL: Recalculation failed');
  process.exit(1);
}

console.log('\n🎉 ALL DEADLINE BACKPLANNER LOGIC TESTS PASSED!');

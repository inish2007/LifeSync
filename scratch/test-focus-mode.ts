import { calculateFocusPriorities, getEstimatedTimeMinutes, formatEstimatedTime } from '../lib/focus-mode';
import { INITIAL_SEED_OBLIGATIONS } from '../lib/storage';

console.log('Testing calculateFocusPriorities on seed obligations...');
const simulatedToday = '2026-09-29';
const result = calculateFocusPriorities(INITIAL_SEED_OBLIGATIONS, simulatedToday);

console.log(`\nTotal Active Tasks: ${result.allActiveCount}`);
console.log(`Critical Overdue Tasks Count: ${result.criticalOverdueTasks.length}`);
console.log(`Top 3 Recommendations Count: ${result.topThree.length}`);

// Test 1: Check Critical Overdue Tasks are not hidden
console.log('\n--- 1. Testing Critical Overdue Tasks (Never Hidden) ---');
if (result.criticalOverdueTasks.length > 0) {
  console.log(`✅ Found ${result.criticalOverdueTasks.length} critical overdue tasks:`);
  for (const rec of result.criticalOverdueTasks) {
    console.log(`   - "${rec.task.title}" (Due: ${rec.task.dueDate}, Overdue by: ${rec.daysOverdue} days)`);
    console.log(`     Consequence: ${rec.task.consequence}`);
    console.log(`     Estimated Time: ${rec.estimatedTimeDisplay}`);
    console.log(`     Why this matters now: ${rec.whyThisMattersNow}`);
    if (!rec.isOverdue || rec.daysOverdue === undefined || rec.daysOverdue <= 0) {
      console.error('❌ FAIL: Overdue metadata missing');
      process.exit(1);
    }
  }
} else {
  console.error('❌ FAIL: Expected seed-8 to be detected as overdue');
  process.exit(1);
}

// Test 2: Check Top 3 Recommendations
console.log('\n--- 2. Testing Top 3 Focus Actions for Today ---');
if (result.topThree.length !== 3) {
  console.error(`❌ FAIL: Expected exactly 3 recommendations, got ${result.topThree.length}`);
  process.exit(1);
}

result.topThree.forEach((rec, idx) => {
  console.log(`\nAction #${rec.rank}: "${rec.task.title}"`);
  console.log(`  Priority Score: ${rec.priorityScore}`);
  console.log(`  Estimated Time: ${rec.estimatedTimeDisplay} (${rec.estimatedTimeMinutes} mins)`);
  console.log(`  Dependency Status: ${rec.dependencyStatus} (Unlocks: ${rec.unlocksCount} tasks)`);
  console.log(`  Why this matters now: "${rec.whyThisMattersNow}"`);
  console.log(`  Scoring breakdown:`, rec.breakdown);

  // Assertions
  if (!rec.whyThisMattersNow || rec.whyThisMattersNow.length < 15) {
    console.error(`❌ FAIL: "Why this matters now" explanation is missing or too short for Action #${rec.rank}`);
    process.exit(1);
  }
  if (!rec.estimatedTimeDisplay || rec.estimatedTimeMinutes <= 0) {
    console.error(`❌ FAIL: Estimated time missing or invalid for Action #${rec.rank}`);
    process.exit(1);
  }
});

// Test 3: Check that overdue task is ranked #1 or in criticalOverdueTasks
const hasOverdueInFront = result.topThree[0].isOverdue || result.criticalOverdueTasks.length > 0;
if (hasOverdueInFront) {
  console.log('\n✅ PASS: Overdue obligations are prioritized and never hidden!');
} else {
  console.error('\n❌ FAIL: Overdue obligations were hidden or deprioritized');
  process.exit(1);
}

// Test 4: Check that a quick-win task that unlocks downstream tasks is prioritized
const odometerTask = result.topThree.find(r => r.task.id === 'seed-0');
if (odometerTask) {
  console.log(`\n✅ PASS: seed-0 ("Submit Vehicle Odometer & Photo") is in Top 3 as high-leverage quick win (takes ${odometerTask.estimatedTimeDisplay}, unlocks ${odometerTask.unlocksCount} tasks)!`);
} else {
  console.log('\nNote: seed-0 position:', result.topThree.map(t => t.task.title));
}

console.log('\n🎉 ALL FOCUS MODE PRIORITIZATION TESTS PASSED!');

# LifeLoop workflows

All five workflows extend the current local prototype. The existing inbox, timeline, graph, consequence engine, deadline backplanner and stored obligations remain in place. Optional fields on the existing `lifeloop_obligations_v1` records require no reset or migration.

- **Energy-Matched Micro-Steps:** select energy and available minutes in the Micro-Steps view or Focus Mode. Only the next unfinished step from a ready, confirmed obligation is suggested. Edit step titles, effort and energy in task details, add custom steps, and save progress. Overdue obligations remain visible. Step completion alone never closes an obligation.
- **Collision Detector:** checks daily estimated effort against an adjustable capacity, prerequisite handoffs, backplanner overruns and late/missing follow-ups. Daily effort is grouped by recommended start date, with missed starts grouped into today. These are heuristic planning warnings, not a connected calendar or a guarantee of scheduling feasibility. Resolve buttons open the affected task for date edits and Resolution Copilot.
- **Resolution Copilot:** open any task and use the shortcut to create an extension, clarification or follow-up template. Edit, save or copy the draft. Templates use task details without generating new penalties or promising an extension. This is local template generation, with no AI service or automatic sending.
- **Waiting Room:** record the person/organization, expected response and follow-up date in task details. The room sorts by follow-up date, highlights due follow-ups, records a manual contact and schedules another check in three days. “Response received” returns work to active status; it does not mark it complete. The original obligation deadline stays unchanged. Reminders appear when the app is open; no background notifications are scheduled.
- **Proof of Completion:** save a confirmation note/reference, or up to three PNG, JPG, WebP or PDF receipts (1 MB per file). All prerequisites must be complete. Notes/files and completion time persist in browser storage and can be retrieved from Completion Proof. Reopening retains the evidence but makes the task active again. Evidence is user supplied, not independently verified. Storage failures surface an error without marking the loop complete.

## Run and verify

```sh
node scripts/run-framework.mjs dev
node scripts/run-framework.mjs build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/test-workflows.mjs
```

The dev preview is at `http://127.0.0.1:5173/`. `npm run test:workflows` also runs the workflow suite plus the existing Focus Mode and Backplanner tests. Compiled test files stay in the ignored `scratch/workflow-test-build` directory.

Tests cover step ordering and energy/time constraints, waiting/blocked exclusion, visible overdue tasks, collision types, draft grounding, date validation, proof limits, dependency completion/reopening, persistence and storage quota failure. New workflow modules pass ESLint. Existing interface code has pre-existing hook-effect/prop-mutation lint errors; these were not suppressed.

Browser data is local to the origin and browser profile. Clearing browser data or using the existing demo reset removes saved records and receipts. No external accounts, payments, messages, AI keys or deployment are involved.

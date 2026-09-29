export type ObligationCategory =
  | 'Insurance & Vehicle'
  | 'Housing & Utilities'
  | 'Health & Medical'
  | 'Financial & Tax'
  | 'Subscriptions & Services'
  | 'Legal & Government'
  | 'Personal Admin';

export type ObligationStatus =
  | 'pending_review' // In Universal Inbox, waiting for confirmation
  | 'confirmed'      // Confirmed, active in timeline
  | 'waiting'        // Waiting on third-party action or prerequisite
  | 'completed';     // Loop closed / finished

export interface SourceDocument {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'document';
  size?: number;
  uploadedAt: string;
  rawText: string;
  dataUrl?: string; // Optional base64 preview for images / PDFs
}

export type ConsequenceProvenance = 'From document' | 'Added by you' | 'Unknown';

export type ConsequenceType =
  | 'late_fee'             // Monetary late penalty or surcharge
  | 'service_interruption' // Insurance lapse, utility disconnect, account cutoff
  | 'missed_eligibility'   // Lost discount, forfeited promotional/fixed term, rate bump
  | 'required_followup'    // Collections referral, DMV notice, mandatory reinspection
  | 'general';             // Other documented consequence

export interface ObligationFieldProposal {
  title: string;
  category: ObligationCategory;
  payee: string;
  amount: string;
  dueDate: string;
  requiredAction: string;
  consequence: string;
  consequenceProvenance?: ConsequenceProvenance;
  consequenceType?: ConsequenceType;
  sourceExcerpt: string;
  estimatedDurationDays?: number;
  bufferDays?: number;
  estimatedMinutes?: number; // Estimated hands-on effort in minutes (e.g. 10m, 45m)
}

export interface Obligation {
  id: string;
  // Core confirmed fields
  title: string;
  category: ObligationCategory;
  payee: string;
  amount: string;
  dueDate: string;
  requiredAction: string;
  consequence: string;
  consequenceProvenance?: ConsequenceProvenance;
  consequenceType?: ConsequenceType;
  whyNowExplanation?: string;
  sourceExcerpt: string;

  // Deadline Backplanner & Effort
  estimatedDurationDays?: number; // Days required to complete the task
  bufferDays?: number;            // Safety margin buffer days
  estimatedMinutes?: number;      // Hands-on time in minutes (e.g. 15, 30, 45)

  // Review & audit state
  status: ObligationStatus;
  createdAt: string;
  confirmedAt?: string;
  completedAt?: string;
  editedFields?: Record<string, boolean>;

  // Source document linkage
  sourceDocument?: SourceDocument;

  // Dependencies & Graph
  dependsOnIds?: string[]; // IDs of prerequisite obligations that must be completed first

  // Extended workflow
  waitingNote?: string;
  completionProofNote?: string;
  completionProofUrl?: string;
  microSteps?: MicroStep[];
  waitingOn?: string;
  waitingSince?: string;
  followUpDate?: string;
  lastFollowedUpAt?: string;
  resolutionDraft?: string;
  completionProofs?: CompletionProof[];
}

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface MicroStep {
  id: string;
  title: string;
  minutes: number;
  energy: EnergyLevel;
  done: boolean;
}

export interface CompletionProof {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  uploadedAt: string;
}

export interface FocusRecommendation {
  task: Obligation;
  rank: number;
  whyThisMattersNow: string;
  estimatedTimeDisplay: string;
  estimatedTimeMinutes: number;
  isOverdue: boolean;
  daysOverdue?: number;
  dependencyStatus: 'ready' | 'blocked' | 'completed' | 'waiting';
  unlocksCount: number;
  priorityScore: number;
  breakdown: {
    deadlineScore: number;
    consequenceScore: number;
    dependencyScore: number;
    effortScore: number;
    unlockScore: number;
  };
}

export interface UniversalInboxItem {
  id: string;
  sourceDocument: SourceDocument;
  proposal: ObligationFieldProposal;
  status: 'pending_review' | 'confirmed' | 'archived';
  createdAt: string;
  linkedObligationId?: string;
}

export interface BackplannerResult {
  taskId: string;
  recommendedStartDate: string; // YYYY-MM-DD
  effectiveDeadline: string;    // YYYY-MM-DD (due date or earliest prerequisite handoff date)
  durationDays: number;
  bufferDays: number;
  totalLeadDaysRequired: number; // durationDays + bufferDays
  availableCalendarDays: number; // days from reference date to effective deadline
  fitsBeforeDeadline: boolean;
  deficitDays: number;           // number of days work exceeds available time
  constrainedByDownstream?: {
    id: string;
    title: string;
    requiredByDate: string;
  };
  scheduleHealth: 'comfortable' | 'tight' | 'overrun';
  plainLanguageExplanation: string;
  calculationBreakdown: {
    deadlineLabel: string;
    deadlineDate: string;
    downstreamConstraintNote?: string;
    durationLabel: string;
    bufferLabel: string;
    recommendedStartLabel: string;
    fitAssessment: string;
  };
}

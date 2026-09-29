import { Obligation, UniversalInboxItem, ObligationFieldProposal, ObligationStatus, CompletionProof } from './types';
import { isCalendarDate, validateCompletion } from './workflows';
import { SAMPLE_DOCUMENTS } from './extractor';

let OBLIGATIONS_KEY = 'lifeloop_obligations_v1';
let INBOX_KEY = 'lifeloop_inbox_v1';
export function setStorageAccount(id: string | null) {
  OBLIGATIONS_KEY = 'lifeloop_obligations_v1' + (id ? `_${id}` : '');
  INBOX_KEY = 'lifeloop_inbox_v1' + (id ? `_${id}` : '');
}
const EVENT_NAME = 'lifeloop_storage_changed';

export const INITIAL_SEED_OBLIGATIONS: Obligation[] = [
  {
    id: 'seed-0',
    title: 'Submit Vehicle Odometer & Photo',
    category: 'Insurance & Vehicle',
    payee: 'Progressive Casualty Insurance Company',
    amount: '₹0.00 (Verification)',
    dueDate: '2026-10-14',
    requiredAction: 'Upload clear dashboard odometer photograph to policyholder mobile portal',
    consequence: 'Prerequisite for safety inspection signoff; delay forfeits low-mileage tier discount.',
    consequenceProvenance: 'Added by you',
    consequenceType: 'missed_eligibility',
    sourceExcerpt: 'Proof of annual mileage verification must be uploaded prior to safety inspection validation.',
    status: 'confirmed',
    createdAt: '2026-09-24T09:00:00.000Z',
    confirmedAt: '2026-09-24T09:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 1,
    bufferDays: 1,
    estimatedMinutes: 10,
  },
  {
    id: 'seed-1',
    title: 'Complete Vehicle Safety & Emissions Inspection',
    category: 'Insurance & Vehicle',
    payee: 'Certified State Inspection Station',
    amount: '₹45.00',
    dueDate: '2026-10-16',
    requiredAction: 'Bring vehicle and mileage certificate to certified bay for annual certificate',
    consequence: 'Insurance renewal binder cannot be finalized without valid inspection certificate.',
    consequenceProvenance: 'Added by you',
    consequenceType: 'service_interruption',
    sourceExcerpt: 'All vehicles over 3 years old require an approved safety inspection certificate before policy renewal issuance.',
    status: 'confirmed',
    createdAt: '2026-09-24T09:15:00.000Z',
    confirmedAt: '2026-09-24T09:20:00.000Z',
    dependsOnIds: ['seed-0'], // Depends on Odometer photo
    estimatedDurationDays: 2,
    bufferDays: 2,
    estimatedMinutes: 45,
  },
  {
    id: 'seed-2',
    title: 'Progressive Auto Policy Renewal',
    category: 'Insurance & Vehicle',
    payee: 'Progressive Casualty Insurance Company',
    amount: '₹482.60',
    dueDate: '2026-10-18',
    requiredAction: 'Authorize semi-annual premium payment online before 11:59 PM EST',
    consequence: '₹25 late fee assessed if unpaid by due date; continuous coverage lapses after 10-day grace period with DMV registration suspension risk.',
    consequenceProvenance: 'From document',
    consequenceType: 'service_interruption',
    sourceExcerpt: 'If full payment or installment is not received by 11:59 PM EST on October 18, 2026, a ₹25 late payment fee will be assessed immediately. Continuous coverage will lapse after a statutory 10-day grace period ending October 28, 2026.',
    status: 'confirmed',
    createdAt: '2026-09-25T10:30:00.000Z',
    confirmedAt: '2026-09-25T10:32:00.000Z',
    dependsOnIds: ['seed-1'], // Depends on Inspection!
    estimatedDurationDays: 1,
    bufferDays: 2,
    estimatedMinutes: 5,
    sourceDocument: {
      id: 'doc-seed-1',
      name: 'Progressive_Auto_Policy_Renewal_Notice.pdf',
      type: 'pdf',
      size: 49200,
      uploadedAt: '2026-09-25T10:30:00.000Z',
      rawText: SAMPLE_DOCUMENTS[0].rawText,
    },
  },
  {
    id: 'seed-3',
    title: 'Apartment Parking Stall Appendix',
    category: 'Housing & Utilities',
    payee: 'Highland Park Residential Apartments',
    amount: '₹75.00 / mo',
    dueDate: '2026-10-01',
    requiredAction: 'Sign garage space agreement and confirm stall #28 assignment',
    consequence: 'Required prior to signing 12-month residential lease extension.',
    consequenceProvenance: 'From document',
    consequenceType: 'missed_eligibility',
    sourceExcerpt: 'Resident must confirm designated parking endorsement prior to executing final lease addendum.',
    status: 'completed',
    completedAt: '2026-09-28T16:00:00.000Z',
    completionProofNote: 'Signed digital addendum via DocuSign; confirmation #HP-STALL-28 confirmed with leasing office.',
    createdAt: '2026-09-20T11:00:00.000Z',
    confirmedAt: '2026-09-20T11:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 1,
    bufferDays: 1,
    estimatedMinutes: 15,
  },
  {
    id: 'seed-4',
    title: 'Apartment Lease Renewal Addendum',
    category: 'Housing & Utilities',
    payee: 'Highland Park Residential Apartments',
    amount: '₹2,150.00 / mo',
    dueDate: '2026-10-25',
    requiredAction: 'Sign and submit signed lease addendum via resident portal (60 days prior)',
    consequence: 'Tenancy automatically converts to month-to-month penalty rate of ₹2,450.00/month plus a ₹125.00 monthly holdover administrative fee if not returned by Oct 25.',
    consequenceProvenance: 'From document',
    consequenceType: 'missed_eligibility',
    sourceExcerpt: 'Failure to submit your signed renewal or 60-day notice to vacate by October 25, 2026 will cause your tenancy to automatically convert into month-to-month tenancy at the penalty rate of ₹2,450.00/month plus a ₹125.00 monthly holdover administrative fee.',
    status: 'confirmed',
    createdAt: '2026-09-26T14:15:00.000Z',
    confirmedAt: '2026-09-26T14:18:00.000Z',
    dependsOnIds: ['seed-3'], // Prerequisite is completed -> so this task is READY!
    estimatedDurationDays: 2,
    bufferDays: 3,
    estimatedMinutes: 15,
    sourceDocument: {
      id: 'doc-seed-2',
      name: 'Highland_Park_Lease_Renewal_Notice.pdf',
      type: 'pdf',
      size: 61500,
      uploadedAt: '2026-09-26T14:15:00.000Z',
      rawText: SAMPLE_DOCUMENTS[1].rawText,
    },
  },
  {
    id: 'seed-5',
    title: 'Pondicherry Municipal Water & Sewer Bill',
    category: 'Housing & Utilities',
    payee: 'City Water & Wastewater Resource Authority',
    amount: '₹1,400.00',
    dueDate: '2026-10-12',
    requiredAction: 'Pay quarterly balance via water.gov.in/quickpay or UPI QR code',
    consequence: '5% statutory late surcharge (₹70.00) after Oct 12; physical disconnection notice after 30 days with ₹500 reconnection charge.',
    consequenceProvenance: 'From document',
    consequenceType: 'service_interruption',
    sourceExcerpt: 'Payments received after October 12, 2026 will incur a 5% statutory late surcharge (₹70.00). If bill remains unpaid for 30 days following due date, physical disconnection notice will be issued with a mandatory ₹500 reconnection charge.',
    status: 'confirmed',
    createdAt: '2026-09-27T08:00:00.000Z',
    confirmedAt: '2026-09-27T08:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 1,
    bufferDays: 1,
    estimatedMinutes: 5,
    sourceDocument: {
      id: 'doc-seed-3',
      name: 'City_Water_Sewer_Billing_Invoice.pdf',
      type: 'pdf',
      size: 32000,
      uploadedAt: '2026-09-27T08:00:00.000Z',
      rawText: SAMPLE_DOCUMENTS[3].rawText,
    },
  },
  {
    id: 'seed-6',
    title: 'Annual Preventative Dental Hygiene Appointment',
    category: 'Health & Medical',
    payee: 'Bayside Family Dental Care',
    amount: '₹0.00 (Preventative)',
    dueDate: '2026-10-30',
    requiredAction: 'Call dental office to schedule annual preventative teeth cleaning and exam',
    consequence: 'No documented consequence cited in appointment reminder.',
    consequenceProvenance: 'Unknown',
    consequenceType: 'general',
    sourceExcerpt: 'This is a gentle reminder to schedule your bi-annual preventative hygiene exam at your convenience.',
    status: 'confirmed',
    createdAt: '2026-09-28T12:00:00.000Z',
    confirmedAt: '2026-09-28T12:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 1,
    bufferDays: 2,
    estimatedMinutes: 10,
  },
  {
    id: 'seed-7',
    title: 'Urgent Expedited Passport Renewal & Signature',
    category: 'Legal & Government',
    payee: 'U.S. Department of State Passport Agency',
    amount: '₹190.00',
    dueDate: '2026-10-02',
    requiredAction: 'Obtain notarized biometric photos, sign DS-82, and submit via certified courier',
    consequence: 'Expedited processing window expires; departure flight ticket invalidated with non-refundable rebooking surcharges.',
    consequenceProvenance: 'From document',
    consequenceType: 'missed_eligibility',
    sourceExcerpt: 'All renewal applications and verified biometric photographs must be physically received by October 2, 2026 to guarantee departure eligibility.',
    status: 'confirmed',
    createdAt: '2026-09-28T16:00:00.000Z',
    confirmedAt: '2026-09-28T16:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 3, // Requires 3 days
    bufferDays: 2,            // Buffer 2 days = 5 days lead time required (exceeds 3 available days!)
    estimatedMinutes: 60,
  },
  {
    id: 'seed-8',
    title: 'Past-Due Natural Gas Utility Notice',
    category: 'Housing & Utilities',
    payee: 'Pondicherry City Gas & Power',
    amount: '₹840.00',
    dueDate: '2026-09-26', // Overdue! Demonstrates critical overdue handling in Focus Mode
    requiredAction: 'Pay past-due balance online or scan QR to restore regular billing status',
    consequence: '₹120 late penalty assessed; 48-hour final physical service shutoff notice pending.',
    consequenceProvenance: 'From document',
    consequenceType: 'service_interruption',
    sourceExcerpt: 'FINAL NOTICE: Past due balance of ₹840.00 was due September 26, 2026. Non-payment triggers immediate 48-hour service disconnection order with mandatory reconnect surcharge.',
    status: 'confirmed',
    createdAt: '2026-09-20T08:00:00.000Z',
    confirmedAt: '2026-09-20T08:05:00.000Z',
    dependsOnIds: [],
    estimatedDurationDays: 1,
    bufferDays: 0,
    estimatedMinutes: 10,
  },
];

export const INITIAL_SEED_INBOX: UniversalInboxItem[] = [
  {
    id: 'inbox-seed-1',
    sourceDocument: {
      id: 'doc-inbox-1',
      name: 'Quest_Diagnostics_Billing_Statement.pdf',
      type: 'pdf',
      size: 41200,
      uploadedAt: '2026-09-28T09:12:00.000Z',
      rawText: SAMPLE_DOCUMENTS[2].rawText,
    },
    proposal: SAMPLE_DOCUMENTS[2].expectedProposal,
    status: 'pending_review',
    createdAt: '2026-09-28T09:12:00.000Z',
  },
];

function notifyStorageChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function getObligations(): Obligation[] {
  if (typeof window === 'undefined') return INITIAL_SEED_OBLIGATIONS;
  try {
    const raw = localStorage.getItem(OBLIGATIONS_KEY);
    if (!raw) {
      localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(INITIAL_SEED_OBLIGATIONS));
      return INITIAL_SEED_OBLIGATIONS;
    }
    return (JSON.parse(raw) as Obligation[]).map(item => {
      const seed = INITIAL_SEED_OBLIGATIONS.find(s => s.id === item.id);
      if (!seed) return item;
      const updated = { ...item };
      // Only relabel untouched legacy demo text. Never convert a user's real money silently.
      for (const field of ['amount','consequence','sourceExcerpt','requiredAction'] as const) {
        if (item[field]?.replace(/\$(?=\d)/g, '₹') === seed[field]) updated[field] = seed[field];
      }
      return updated;
    });
  } catch (err) {
    console.error('Failed reading obligations from localStorage:', err);
    return INITIAL_SEED_OBLIGATIONS;
  }
}

export function saveObligation(obligation: Obligation): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getObligations();
    const existingIndex = list.findIndex(o => o.id === obligation.id);
    if (existingIndex >= 0) {
      list[existingIndex] = obligation;
    } else {
      list.unshift(obligation);
    }
    localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(list));
    notifyStorageChanged();
  } catch (err) {
    console.error('Failed saving obligation to localStorage:', err);
  }
}

export function deleteObligation(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getObligations().filter(o => o.id !== id);
    localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(list));
    notifyStorageChanged();
  } catch (err) {
    console.error('Failed deleting obligation from localStorage:', err);
  }
}

export function updateObligationStatus(id: string, status: ObligationStatus, note?: string): void {
  if (status === 'completed') {
    completeObligation(id, note || '', []);
    return;
  }
  if (typeof window === 'undefined') return;
  const list = getObligations();
  const item = list.find(o => o.id === id);
  if (!item) return;

  item.status = status;
  if (status === 'waiting') {
    if (note) item.waitingNote = note;
  }
  item.completedAt = undefined;
  saveObligation(item);
}

// Workflow writes report failures so the UI never claims a receipt or draft was saved when storage is full.
export function updateWorkflow(id: string, changes: Partial<Obligation>): Obligation {
  if (typeof window === 'undefined') throw new Error('Open LifeLoop in a browser to save changes.');
  const list = getObligations();
  const index = list.findIndex(task => task.id === id);
  if (index < 0) throw new Error('This obligation no longer exists.');
  const updated = { ...list[index], ...changes, id };
  list[index] = updated;
  try {
    localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(list));
  } catch {
    throw new Error('Could not save. Browser storage may be full or unavailable. Try a smaller attachment; your existing data is unchanged.');
  }
  notifyStorageChanged();
  return updated;
}

export function putInWaitingRoom(id: string, waitingOn: string, note: string, followUpDate: string): void {
  if (!waitingOn.trim() || !note.trim() || !isCalendarDate(followUpDate)) throw new Error('Enter who you are waiting on, what you need, and a valid follow-up date.');
  const task = getObligations().find(t => t.id === id);
  if (!task || task.status === 'completed' || task.status === 'pending_review') throw new Error('Only an open, confirmed obligation can enter the Waiting Room.');
  updateWorkflow(id, { status: 'waiting', waitingOn: waitingOn.trim(), waitingNote: note.trim(), followUpDate, waitingSince: task.waitingSince || new Date().toISOString() });
}

export function completeObligation(id: string, note: string, proofs: CompletionProof[]): void {
  const tasks = getObligations();
  const task = tasks.find(t => t.id === id);
  if (!task) throw new Error('This obligation no longer exists.');
  const error = validateCompletion(task, tasks, note, proofs);
  if (error) throw new Error(error);
  updateWorkflow(id, { status: 'completed', completedAt: new Date().toISOString(), completionProofNote: note.trim(), completionProofs: proofs });
}

/**
 * Updates backplanner duration and buffer time for a task and triggers automatic recalculation.
 */
export function updateObligationBackplanSettings(
  id: string,
  estimatedDurationDays: number,
  bufferDays: number
): Obligation | null {
  if (typeof window === 'undefined') return null;
  const list = getObligations();
  const item = list.find(o => o.id === id);
  if (!item) return null;

  item.estimatedDurationDays = Math.max(1, estimatedDurationDays);
  item.bufferDays = Math.max(0, bufferDays);
  saveObligation(item);
  return item;
}

/**
 * Updates the due date of an obligation, which automatically recalculates
 * downstream backplanner recommendations across all connected tasks.
 */
export function updateObligationDueDate(id: string, newDueDate: string): Obligation | null {
  if (typeof window === 'undefined') return null;
  const list = getObligations();
  const item = list.find(o => o.id === id);
  if (!item) return null;

  item.dueDate = newDueDate;
  saveObligation(item);
  return item;
}

/**
 * Updates the estimated hands-on time in minutes for an obligation.
 */
export function updateObligationEstimatedMinutes(id: string, estimatedMinutes: number): Obligation | null {
  if (typeof window === 'undefined') return null;
  const list = getObligations();
  const item = list.find(o => o.id === id);
  if (!item) return null;

  item.estimatedMinutes = Math.max(1, estimatedMinutes);
  saveObligation(item);
  return item;
}

export function getInboxItems(): UniversalInboxItem[] {
  if (typeof window === 'undefined') return INITIAL_SEED_INBOX;
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    if (!raw) {
      localStorage.setItem(INBOX_KEY, JSON.stringify(INITIAL_SEED_INBOX));
      return INITIAL_SEED_INBOX;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading inbox from localStorage:', err);
    return INITIAL_SEED_INBOX;
  }
}

export function saveInboxItem(item: UniversalInboxItem): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getInboxItems();
    const existingIndex = list.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(INBOX_KEY, JSON.stringify(list));
    notifyStorageChanged();
  } catch (err) {
    console.error('Failed saving inbox item to localStorage:', err);
  }
}

export function deleteInboxItem(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getInboxItems().filter(i => i.id !== id);
    localStorage.setItem(INBOX_KEY, JSON.stringify(list));
    notifyStorageChanged();
  } catch (err) {
    console.error('Failed deleting inbox item from localStorage:', err);
  }
}

export function confirmInboxItemToObligation(
  inboxItemId: string,
  confirmedProposal: ObligationFieldProposal,
  editedFields?: Record<string, boolean>
): Obligation {
  const inboxItems = getInboxItems();
  const item = inboxItems.find(i => i.id === inboxItemId);

  // Consequence provenance resolution:
  let provenance = confirmedProposal.consequenceProvenance || 'From document';
  if (editedFields?.consequence) {
    provenance = 'Added by you';
  } else if (!confirmedProposal.consequence || confirmedProposal.consequence.toLowerCase().includes('no documented')) {
    provenance = 'Unknown';
  }

  const newObligation: Obligation = {
    id: 'obl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title: confirmedProposal.title,
    category: confirmedProposal.category,
    payee: confirmedProposal.payee,
    amount: confirmedProposal.amount,
    dueDate: confirmedProposal.dueDate,
    requiredAction: confirmedProposal.requiredAction,
    consequence: confirmedProposal.consequence,
    consequenceProvenance: provenance,
    consequenceType: confirmedProposal.consequenceType,
    sourceExcerpt: confirmedProposal.sourceExcerpt,
    estimatedDurationDays: confirmedProposal.estimatedDurationDays ?? 1,
    bufferDays: confirmedProposal.bufferDays ?? 1,
    estimatedMinutes: confirmedProposal.estimatedMinutes ?? 15,
    status: 'confirmed',
    createdAt: item ? item.createdAt : new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    editedFields,
    sourceDocument: item ? item.sourceDocument : undefined,
  };

  saveObligation(newObligation);

  if (item) {
    item.status = 'confirmed';
    item.linkedObligationId = newObligation.id;
    saveInboxItem(item);
  }

  return newObligation;
}

export function resetAllStorageToDefaults(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(INITIAL_SEED_OBLIGATIONS));
  localStorage.setItem(INBOX_KEY, JSON.stringify(INITIAL_SEED_INBOX));
  notifyStorageChanged();
}

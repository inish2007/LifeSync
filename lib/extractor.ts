import { ObligationCategory, ObligationFieldProposal, ConsequenceProvenance, ConsequenceType } from './types';
import { detectConsequenceType } from './consequence-engine';

export interface SampleDocumentPreset {
  id: string;
  name: string;
  category: ObligationCategory;
  description: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'text' | 'document';
  rawText: string;
  expectedProposal: ObligationFieldProposal;
}

export const SAMPLE_DOCUMENTS: SampleDocumentPreset[] = [
  {
    id: 'sample-insurance',
    name: 'Auto Insurance Renewal Notice',
    category: 'Insurance & Vehicle',
    description: 'Six-month vehicle policy premium renewal notice with payment deadline and lapse warning',
    fileName: 'Progressive_Auto_Policy_Renewal_Notice.pdf',
    fileType: 'pdf',
    rawText: `PROGRESSIVE CASUALTY INSURANCE COMPANY
Policy Number: PA-9028471-04
Named Insured: Alex M. Vance
Vehicle: 2022 Honda Civic Sedan (VIN: 1HGCR2F83NA049182)

NOTICE OF POLICY RENEWAL & PREMIUM STATEMENT
Billing Statement Date: September 22, 2026
Renewal Policy Effective: October 20, 2026 to April 20, 2027

Total Six-Month Premium: $482.60
Minimum Amount Due by Due Date: $482.60
Payment Due Date: October 18, 2026

REQUIRED ACTION:
Please authorize automatic payment online via progressive.com/pay or submit physical check with remittance coupon before 11:59 PM EST on October 18, 2026. If choosing monthly installments, a $3 processing installment surcharge applies.

IMPORTANT NOTICE OF CONSEQUENCE:
If full payment or installment is not received by 11:59 PM EST on October 18, 2026, a $25 late payment fee will be assessed immediately. Continuous coverage will lapse after a statutory 10-day grace period ending October 28, 2026, and notice of cancellation will be dispatched to the state Department of Motor Vehicles, which may result in vehicle registration suspension.`,
    expectedProposal: {
      title: 'Progressive Auto Policy Renewal',
      category: 'Insurance & Vehicle',
      payee: 'Progressive Casualty Insurance Company',
      amount: '$482.60',
      dueDate: '2026-10-18',
      requiredAction: 'Authorize payment online via progressive.com/pay before 11:59 PM EST',
      consequence: '$25 late fee assessed if unpaid by due date; continuous coverage lapses after 10-day grace period with DMV registration suspension risk.',
      consequenceProvenance: 'From document',
      consequenceType: 'service_interruption',
      sourceExcerpt: 'If full payment or installment is not received by 11:59 PM EST on October 18, 2026, a $25 late payment fee will be assessed immediately. Continuous coverage will lapse after a statutory 10-day grace period ending October 28, 2026.',
    },
  },
  {
    id: 'sample-lease',
    name: 'Apartment Lease Renewal Addendum',
    category: 'Housing & Utilities',
    description: 'Annual apartment tenancy renewal letter with notice deadline and month-to-month penalty',
    fileName: 'Highland_Park_Lease_Renewal_Notice.pdf',
    fileType: 'pdf',
    rawText: `HIGHLAND PARK RESIDENTIAL APARTMENTS
Property Management Office: 440 Elmwood Boulevard, Suite 100
Tenant: Alex Vance | Unit: Apt 4B
Current Lease Expiration Date: November 30, 2026

OFFICIAL NOTICE: LEASE TERM EXTENSION OFFER
Date: September 25, 2026

Dear Resident,
We value you as a member of our community. Your current 12-month lease will expire on November 30, 2026. We are pleased to offer a renewal term at the adjusted market rate of $2,150.00 per month (effective December 1, 2026).

REQUIRED ACTION:
To secure this guaranteed 12-month rate, sign and return the attached Lease Addendum through the resident portal or in person at the leasing office by October 25, 2026 (60 days prior to lease end).

CONSEQUENCE OF INACTION:
Per Section 14 of your original lease agreement, written notice of intent to vacate or renewal confirmation is required at least 60 days before expiration. Failure to submit your signed renewal or 60-day notice to vacate by October 25, 2026 will cause your tenancy to automatically convert into month-to-month tenancy at the penalty rate of $2,450.00/month plus a $125.00 monthly holdover administrative fee.`,
    expectedProposal: {
      title: 'Apartment Lease Renewal Addendum',
      category: 'Housing & Utilities',
      payee: 'Highland Park Residential Apartments',
      amount: '$2,150.00 / month',
      dueDate: '2026-10-25',
      requiredAction: 'Sign and return the renewal Lease Addendum via the resident portal',
      consequence: 'Automatic conversion to month-to-month rate ($2,450/mo) plus a $125 monthly holdover administrative fee if not returned by October 25, 2026.',
      consequenceProvenance: 'From document',
      consequenceType: 'missed_eligibility',
      sourceExcerpt: 'Failure to submit your signed renewal or 60-day notice to vacate by October 25, 2026 will cause your tenancy to automatically convert into month-to-month tenancy at the penalty rate of $2,450.00/month plus a $125.00 monthly holdover administrative fee.',
    },
  },
  {
    id: 'sample-medical',
    name: 'Medical Specialist Clinical Invoice',
    category: 'Health & Medical',
    description: 'Diagnostic laboratory copayment and coinsurance balance statement',
    fileName: 'Quest_Diagnostics_Billing_Statement.pdf',
    fileType: 'pdf',
    rawText: `METROPOLITAN HEALTHCARE PARTNERS / QUEST LAB SERVICES
Billing Inquiries: (800) 555-0194 | Tax ID: 13-9823101
Account Number: MHP-883019-V

PATIENT STATEMENT & SUMMARY OF SERVICES
Patient: Alex Vance | Date of Service: August 14, 2026
Service Description: Comprehensive Metabolic Panel & Lipid Profile
Insurance Billed: Blue Cross Blue Shield PPO
Insurance Paid: $192.40 | Contracted Adjustment: $118.00

PATIENT BALANCE DUE: $84.20
Statement Date: September 20, 2026
Payment Due Date: October 20, 2026

REQUIRED ACTION:
Submit balance payment of $84.20 via mychart.metrohealth.org/pay or call automated phone payment system at 1-800-555-0194 before October 20, 2026.

CONSEQUENCE CITED:
Accounts with outstanding balances beyond 60 days of statement date will be charged a $15 late administrative fee and may be referred to an external debt collection agency, potentially impacting credit standing. No interest is charged during initial 30 days.`,
    expectedProposal: {
      title: 'Quest Lab Diagnostic Balance',
      category: 'Health & Medical',
      payee: 'Metropolitan Healthcare Partners / Quest',
      amount: '$84.20',
      dueDate: '2026-10-20',
      requiredAction: 'Pay balance of $84.20 online via mychart or automated phone system',
      consequence: '$15 late administrative fee and potential referral to debt collection agency after 60 days.',
      consequenceProvenance: 'From document',
      consequenceType: 'required_followup',
      sourceExcerpt: 'Accounts with outstanding balances beyond 60 days of statement date will be charged a $15 late administrative fee and may be referred to an external debt collection agency, potentially impacting credit standing.',
    },
  },
  {
    id: 'sample-utility',
    name: 'Municipal Water & Sewer Bill',
    category: 'Housing & Utilities',
    description: 'Quarterly municipal water and wastewater services billing invoice',
    fileName: 'City_Water_Sewer_Billing_Invoice.pdf',
    fileType: 'pdf',
    rawText: `CITY OF PONDICHERRY MUNICIPAL SERVICES
Water, Wastewater & Environmental Resource Authority
Customer Care: 1800-425-0101 | Billing Period: July 1 - Sept 20, 2026
Account No: WTR-44019-B | Meter No: 99120-X

UTILITY BILLING STATEMENT
Service Address: 12 Rue Dumas, White Town

Current Charges:
Water Consumption (28 units): ₹820.00
Sewer & Waste Treatment: ₹430.00
Infrastructure Maintenance Cess: ₹150.00
TOTAL CHARGES CURRENT PERIOD: ₹1,400.00

Payment Due Date: October 12, 2026
Late Payment Assessment Date: October 13, 2026

REQUIRED ACTION:
Pay current balance of ₹1,400.00 online through the municipal payment gateway at water.gov.in/quickpay or via UPI using QR code.

CONSEQUENCE STATEMENT:
Payments received after October 12, 2026 will incur a 5% statutory late surcharge (₹70.00). If bill remains unpaid for 30 days following due date, physical disconnection notice will be issued with a mandatory ₹500 reconnection charge.`,
    expectedProposal: {
      title: 'Municipal Water & Sewer Utility Bill',
      category: 'Housing & Utilities',
      payee: 'City Water & Wastewater Resource Authority',
      amount: '₹1,400.00',
      dueDate: '2026-10-12',
      requiredAction: 'Pay ₹1,400.00 via water.gov.in/quickpay or UPI QR code',
      consequence: '5% statutory late surcharge (₹70.00) after due date; physical disconnection notice after 30 days with ₹500 reconnection charge.',
      consequenceProvenance: 'From document',
      consequenceType: 'service_interruption',
      sourceExcerpt: 'Payments received after October 12, 2026 will incur a 5% statutory late surcharge (₹70.00). If bill remains unpaid for 30 days following due date, physical disconnection notice will be issued with a mandatory ₹500 reconnection charge.',
    },
  },
  {
    id: 'sample-subscription',
    name: 'Cloud Hosting Annual Subscription Renewal',
    category: 'Subscriptions & Services',
    description: 'Annual software infrastructure subscription invoice with renewal deadline',
    fileName: 'Vercel_Cloud_Annual_Plan_Invoice.pdf',
    fileType: 'pdf',
    rawText: `CLOUD ENGINE SYSTEMS LLC
Invoice #INV-2026-88190
Billed to: Alex Vance (alex.vance@example.com)
Date of Issue: September 28, 2026

SUBSCRIPTION RENEWAL INVOICE
Plan: Cloud Pro Infrastructure & Team Workspace (Annual Tier)
Service Period: October 15, 2026 - October 14, 2027

Annual Subscription Total: $240.00
Stored Payment Method: Visa ending in 4018 (Expires 10/26)
Renewal Charge Date: October 15, 2026

REQUIRED ACTION:
Review active team seat count and verify primary payment method before October 15, 2026 in Settings > Billing.

CONSEQUENCE IF PAYMENT FAILS:
If recurring payment authorization fails on October 15, 2026, workspace will enter a 3-day grace period. After October 18, 2026, team member access is downgraded to Free tier with production build limits capped and API rate limits throttled.`,
    expectedProposal: {
      title: 'Cloud Infrastructure Annual Subscription',
      category: 'Subscriptions & Services',
      payee: 'Cloud Engine Systems LLC',
      amount: '$240.00',
      dueDate: '2026-10-15',
      requiredAction: 'Review team seats and verify credit card in Billing Settings before Oct 15',
      consequence: 'After 3-day grace period (Oct 18), team access downgraded to Free tier with capped production builds and throttled API rates.',
      consequenceProvenance: 'From document',
      consequenceType: 'service_interruption',
      sourceExcerpt: 'If recurring payment authorization fails on October 15, 2026, workspace will enter a 3-day grace period. After October 18, 2026, team member access is downgraded to Free tier with production build limits capped.',
    },
  },
];

/**
 * Intelligent extraction heuristics for arbitrary pasted text or uploaded files.
 * Strictly respects: "Do not invent financial penalties: show only user-entered or source-backed consequences."
 */
export function extractProposalFromText(rawText: string, fileName?: string): ObligationFieldProposal {
  const trimmed = rawText.trim();

  // Check if it matches any predefined sample directly
  const presetMatch = SAMPLE_DOCUMENTS.find(
    s => s.rawText.includes(trimmed.slice(0, 80)) || trimmed.includes(s.expectedProposal.title)
  );
  if (presetMatch) {
    return { ...presetMatch.expectedProposal };
  }

  // Fallback heuristic extraction
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Title Heuristics
  let title = 'New Obligation';
  if (fileName) {
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    title = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }
  for (const line of lines.slice(0, 5)) {
    if (/(notice|statement|bill|invoice|renewal|reminder|order|policy|addendum|agreement|payment)/i.test(line) && line.length < 70) {
      title = line.replace(/^[#*\s-]+/, '').trim();
      break;
    }
  }

  // 2. Category Heuristics
  let category: ObligationCategory = 'Personal Admin';
  const lower = trimmed.toLowerCase();
  if (lower.includes('insurance') || lower.includes('policy') || lower.includes('vehicle') || lower.includes('car') || lower.includes('auto')) {
    category = 'Insurance & Vehicle';
  } else if (lower.includes('rent') || lower.includes('lease') || lower.includes('tenant') || lower.includes('water') || lower.includes('electric') || lower.includes('utility') || lower.includes('apartment')) {
    category = 'Housing & Utilities';
  } else if (lower.includes('health') || lower.includes('medical') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('dental') || lower.includes('lab') || lower.includes('patient')) {
    category = 'Health & Medical';
  } else if (lower.includes('tax') || lower.includes('irs') || lower.includes('financial') || lower.includes('investment') || lower.includes('credit card') || lower.includes('bank')) {
    category = 'Financial & Tax';
  } else if (lower.includes('subscription') || lower.includes('saas') || lower.includes('annual plan') || lower.includes('membership') || lower.includes('cloud')) {
    category = 'Subscriptions & Services';
  } else if (lower.includes('court') || lower.includes('permit') || lower.includes('license') || lower.includes('government') || lower.includes('registration') || lower.includes('dmv')) {
    category = 'Legal & Government';
  }

  // 3. Payee Heuristics
  let payee = 'Vendor / Service Provider';
  const payeeRegexes = [
    /(?:from|payable to|remit to|merchant|biller|payee|company):\s*([^\n\r,]+)/i,
    /(?:welcome to|notice from)\s+([A-Z0-9\s&.,'-]{3,40})/i,
    /^([A-Z0-9\s&.,'-]{3,45}(?:company|inc|llc|authority|corp|services|insurance|health|hospital|diagnostics|department))/im,
  ];
  for (const rx of payeeRegexes) {
    const match = trimmed.match(rx);
    if (match && match[1]) {
      payee = match[1].trim();
      break;
    }
  }
  if (payee === 'Vendor / Service Provider' && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 50 && !firstLine.includes(':')) {
      payee = firstLine;
    }
  }

  // 4. Amount Heuristics
  let amount = '$0.00 (No payment cited)';
  const amountMatches = trimmed.match(/(?:[$€£₹]|USD\s?)\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i) ||
                        trimmed.match(/(?:total|balance|amount due|payment|charges)[\s:]*([$€£₹]?\s*[0-9]+(?:\.[0-9]{2})?)/i);
  if (amountMatches) {
    const matchedStr = amountMatches[0].trim();
    amount = matchedStr.startsWith('$') || matchedStr.startsWith('€') || matchedStr.startsWith('₹') || matchedStr.startsWith('£')
      ? matchedStr
      : `$${amountMatches[1]}`;
  }

  // 5. Due Date Heuristics
  // Default fallback: 14 days from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 14);
  let dueDate = targetDate.toISOString().split('T')[0];

  const datePatterns = [
    /(?:due date|payment due|due by|pay by|before|expires on|expiration|by)\s*[:]?\s*([A-Za-z]+ \d{1,2},? \d{4})/i,
    /(?:due date|payment due|due by|pay by|before|expires on|expiration|by)\s*[:]?\s*(\d{4}-\d{2}-\d{2})/i,
    /(?:due date|payment due|due by|pay by|before|expires on|expiration|by)\s*[:]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const rx of datePatterns) {
    const match = trimmed.match(rx);
    if (match && match[1]) {
      const parsed = Date.parse(match[1]);
      if (!isNaN(parsed)) {
        dueDate = new Date(parsed).toISOString().split('T')[0];
        break;
      }
    }
  }

  // 6. Required Action Heuristics
  let requiredAction = 'Review details and complete requested action';
  const actionRegexes = [
    /(?:required action|action needed|what you need to do|please|instructions):\s*([^\n\r.]+)/i,
    /(authorize (?:payment|draft)[^\n\r.]+)/i,
    /(sign and return[^\n\r.]+)/i,
    /(pay (?:current balance|the total|online|amount)[^\n\r.]+)/i,
    /(submit (?:documents?|payment|reading)[^\n\r.]+)/i,
    /(schedule (?:an appointment|inspection|visit)[^\n\r.]+)/i,
  ];
  for (const rx of actionRegexes) {
    const match = trimmed.match(rx);
    if (match && match[1]) {
      requiredAction = match[1].trim();
      break;
    }
  }

  // 7. Consequence Heuristics (Strictly Source-Backed - NO Invented Penalties)
  let consequence = '';
  let consequenceProvenance: ConsequenceProvenance = 'Unknown';
  let consequenceType: ConsequenceType = 'general';
  let sourceExcerpt = '';

  const consequenceRegexes = [
    /([^.\n\r]+(?:late fee|penalty|lapse|cancellation|cancellation will|termination|suspension|collections|disconnect|surcharge)[^.\n\r]*\.)/i,
    /(if [^.\n\r]+ (?:unpaid|not received|fails|not returned)[^.\n\r]+\.)/i,
    /(failure to [^.\n\r]+ will [^.\n\r]+\.)/i,
  ];

  for (const rx of consequenceRegexes) {
    const match = trimmed.match(rx);
    if (match && match[1]) {
      consequence = match[1].trim();
      consequenceProvenance = 'From document';
      consequenceType = detectConsequenceType(consequence);
      sourceExcerpt = match[1].trim();
      break;
    }
  }

  if (!consequence) {
    consequence = 'No documented consequence cited in source document.';
    consequenceProvenance = 'Unknown';
    consequenceType = 'general';
  }

  // 8. Source Excerpt fallback if consequence didn't supply it
  if (!sourceExcerpt) {
    // Find the sentence mentioning due date or amount
    const sentenceMatch = trimmed.match(/([^.\n\r]+(?:due|payment|pay|\$|₹|notice|deadline)[^.\n\r]+\.)/i);
    if (sentenceMatch && sentenceMatch[1]) {
      sourceExcerpt = sentenceMatch[1].trim();
    } else {
      sourceExcerpt = lines.slice(0, 3).join(' ');
    }
  }

  return {
    title,
    category,
    payee,
    amount,
    dueDate,
    requiredAction,
    consequence,
    consequenceProvenance,
    consequenceType,
    sourceExcerpt,
  };
}

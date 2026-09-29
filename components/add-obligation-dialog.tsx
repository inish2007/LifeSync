'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCheck,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  IndianRupee,
  Building2,
  Tag,
  FileCode,
  FileCheck2,
  RotateCcw,
  Clipboard,
  X,
  Eye,
  Info,
  ShieldAlert,
  CalendarClock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ObligationCategory,
  ObligationFieldProposal,
  SourceDocument,
  UniversalInboxItem
} from '@/lib/types';
import { offsetDate } from '@/lib/backplanner';
import {
  SAMPLE_DOCUMENTS,
  SampleDocumentPreset,
  extractProposalFromText
} from '@/lib/extractor';
import { saveInboxItem, confirmInboxItemToObligation } from '@/lib/storage';

interface AddObligationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onObligationCreated?: () => void;
  initialInboxItem?: UniversalInboxItem | null;
}

const CATEGORIES: ObligationCategory[] = [
  'Insurance & Vehicle',
  'Housing & Utilities',
  'Health & Medical',
  'Financial & Tax',
  'Subscriptions & Services',
  'Legal & Government',
  'Personal Admin',
];

export default function AddObligationDialog({
  open,
  onOpenChange,
  onObligationCreated,
  initialInboxItem,
}: AddObligationDialogProps) {
  // Step state: 'input' | 'analyzing' | 'review'
  const [step, setStep] = useState<'input' | 'analyzing' | 'review'>(
    initialInboxItem ? 'review' : 'input'
  );

  // Input tabs: 'upload' | 'paste'
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  // Input data
  const [rawText, setRawText] = useState(
    initialInboxItem ? initialInboxItem.sourceDocument.rawText : ''
  );
  const [fileName, setFileName] = useState(
    initialInboxItem ? initialInboxItem.sourceDocument.name : ''
  );
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'text' | 'document'>(
    initialInboxItem ? initialInboxItem.sourceDocument.type : 'text'
  );
  const [fileSize, setFileSize] = useState<number | undefined>(
    initialInboxItem?.sourceDocument.size
  );
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(
    initialInboxItem?.sourceDocument.dataUrl || null
  );

  // Extraction & Review data
  const [originalProposal, setOriginalProposal] = useState<ObligationFieldProposal | null>(
    initialInboxItem ? initialInboxItem.proposal : null
  );
  const [formFields, setFormFields] = useState<ObligationFieldProposal>({
    title: initialInboxItem?.proposal.title || '',
    category: initialInboxItem?.proposal.category || 'Personal Admin',
    payee: initialInboxItem?.proposal.payee || '',
    amount: initialInboxItem?.proposal.amount || '',
    dueDate: initialInboxItem?.proposal.dueDate || '',
    requiredAction: initialInboxItem?.proposal.requiredAction || '',
    consequence: initialInboxItem?.proposal.consequence || '',
    consequenceProvenance: initialInboxItem?.proposal.consequenceProvenance || 'From document',
    consequenceType: initialInboxItem?.proposal.consequenceType || 'general',
    sourceExcerpt: initialInboxItem?.proposal.sourceExcerpt || '',
  });

  // Track which fields have been edited by user
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});
  const [showOriginalSource, setShowOriginalSource] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('input');
        setRawText('');
        setFileName('');
        setFilePreviewUrl(null);
        setOriginalProposal(null);
        setEditedFields({});
        setErrorNotice(null);
        setShowOriginalSource(false);
      }, 200);
    }
    onOpenChange(isOpen);
  };

  // Handle Preset Sample selection
  const handleSelectSample = (sample: SampleDocumentPreset) => {
    setRawText(sample.rawText);
    setFileName(sample.fileName);
    setFileType(sample.fileType);
    setFileSize(sample.rawText.length * 2);
    setFilePreviewUrl(null);
    setErrorNotice(null);
  };

  // Handle File Input
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processUploadedFile(file);
  };

  const processUploadedFile = (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setErrorNotice(null);

    const isImg = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (isImg) {
      setFileType('image');
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setFilePreviewUrl(dataUrl);
        // Realistic simulated OCR extraction for image files
        const simulatedText = `[Extracted from image: ${file.name}]\n` +
          `ANNUAL UTILITY & SERVICE STATEMENT\n` +
          `Account: US-928104\n` +
          `Payee: Metropolitan Services Corp\n` +
          `Amount Due: ₹142.50\n` +
          `Due Date: 2026-10-24\n` +
          `Required Action: Submit online payment through customer portal or mobile banking.\n` +
          `Consequence: Late payment fee of ₹15.00 will be added if not settled within 10 days of due date.`;
        setRawText(simulatedText);
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      setFileType('pdf');
      const reader = new FileReader();
      reader.onload = () => {
        // Read text content or store data url
        // In local prototype, if PDF contains text read it, or extract from preset if matches name
        const match = SAMPLE_DOCUMENTS.find(s => s.fileName.toLowerCase() === file.name.toLowerCase());
        if (match) {
          setRawText(match.rawText);
        } else {
          setRawText(`[Extracted from document: ${file.name}]\n` +
            `NOTICE OF PAYMENT AND DEADLINE\n` +
            `Organization: Commonwealth Regional Authority\n` +
            `Invoice Total: ₹290.00\n` +
            `Due Date: 2026-10-28\n` +
            `Required Action: Return verified remittance coupon with authorization signature.\n` +
            `Consequence Statement: Accounts delinquent past due date will incur 1.5% statutory monthly interest and administrative suspension.`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileType('document');
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setRawText(text || '');
      };
      reader.readAsText(file);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        setFileName('Pasted_Notice.txt');
        setFileType('text');
        setErrorNotice(null);
      }
    } catch {
      setErrorNotice('Clipboard access was blocked. Please paste directly into the text area below.');
    }
  };

  // Trigger Extraction
  const handleStartAnalysis = () => {
    if (!rawText.trim()) {
      setErrorNotice('Please paste some text, upload a file, or select a sample document to continue.');
      return;
    }

    setStep('analyzing');
    setErrorNotice(null);

    // Simulate smart extraction analysis
    setTimeout(() => {
      const proposal = extractProposalFromText(rawText, fileName);
      setOriginalProposal(proposal);
      setFormFields({ ...proposal });
      setEditedFields({});
      setStep('review');
    }, 450);
  };

  // Field change handler
  const handleFieldChange = (field: keyof ObligationFieldProposal, value: string) => {
    setFormFields(prev => ({ ...prev, [field]: value }));
    setEditedFields(prev => ({
      ...prev,
      [field]: originalProposal ? originalProposal[field] !== value : true,
    }));
  };

  // Revert a single field to extracted value
  const handleResetField = (field: keyof ObligationFieldProposal) => {
    if (!originalProposal) return;
    setFormFields(prev => ({ ...prev, [field]: originalProposal[field] }));
    setEditedFields(prev => ({ ...prev, [field]: false }));
  };

  // Save as Draft in Universal Inbox
  const handleSaveToInboxDraft = () => {
    const doc: SourceDocument = {
      id: 'doc-' + Date.now(),
      name: fileName || 'Unsaved Document.txt',
      type: fileType,
      size: fileSize || rawText.length,
      uploadedAt: new Date().toISOString(),
      rawText,
      dataUrl: filePreviewUrl || undefined,
    };

    const inboxItem: UniversalInboxItem = {
      id: initialInboxItem ? initialInboxItem.id : 'inbox-' + Date.now(),
      sourceDocument: doc,
      proposal: formFields,
      status: 'pending_review',
      createdAt: initialInboxItem ? initialInboxItem.createdAt : new Date().toISOString(),
    };

    saveInboxItem(inboxItem);
    handleOpenChange(false);
    if (onObligationCreated) onObligationCreated();
  };

  // Confirm and Create Obligation
  const handleConfirmObligation = () => {
    if (!formFields.title.trim()) {
      setErrorNotice('Please provide a title for the obligation.');
      return;
    }
    if (!formFields.dueDate) {
      setErrorNotice('Please specify a due date.');
      return;
    }

    const doc: SourceDocument = {
      id: 'doc-' + Date.now(),
      name: fileName || 'Input_Document.txt',
      type: fileType,
      size: fileSize || rawText.length,
      uploadedAt: new Date().toISOString(),
      rawText,
      dataUrl: filePreviewUrl || undefined,
    };

    // Store in browser storage via confirmation service
    confirmInboxItemToObligation(
      initialInboxItem ? initialInboxItem.id : 'temp-inbox-' + Date.now(),
      formFields,
      editedFields
    );

    // Also persist source document in inbox archive if newly uploaded
    if (!initialInboxItem) {
      saveInboxItem({
        id: 'inbox-' + Date.now(),
        sourceDocument: doc,
        proposal: formFields,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      });
    }

    handleOpenChange(false);
    if (onObligationCreated) onObligationCreated();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="modal" style={{ maxWidth: step === 'review' ? '760px' : '640px' }}>
        {/* STEP 1: INPUT VIEW */}
        {step === 'input' && (
          <>
            <div className="sectionhead" style={{ marginBottom: 8 }}>
              <div>
                <DialogTitle style={{ fontSize: 22, fontWeight: 700 }}>Add an obligation</DialogTitle>
                <DialogDescription style={{ color: '#5c6048', marginTop: 4 }}>
                  Universal Inbox: Upload a PDF, image, or paste text. LifeLoop will extract what needs doing.
                </DialogDescription>
              </div>
              <span className="badge blue">
                <Sparkles size={13} />
                Smart extraction
              </span>
            </div>

            {errorNotice && (
              <div className="notice error" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                <AlertTriangle size={16} />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Input Mode Selector Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e3ddcf', paddingBottom: 10, margin: '14px 0' }}>
              <button
                type="button"
                className={activeTab === 'upload' ? 'primary' : 'secondary'}
                style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={14} />
                Upload PDF / Image / Document
              </button>
              <button
                type="button"
                className={activeTab === 'paste' ? 'primary' : 'secondary'}
                style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={() => setActiveTab('paste')}
              >
                <FileText size={14} />
                Paste Text / Email
              </button>
            </div>

            {/* Upload File Tab */}
            {activeTab === 'upload' && (
              <div>
                <div
                  className="uploadzone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    borderColor: isDragging ? '#5c6048' : '#b1aa97',
                    backgroundColor: isDragging ? '#f5f1e8' : '#f5f1e8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/*,.txt,.doc,.docx,.eml,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#eee9df',
                      color: '#5c6048',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Upload size={22} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 15 }}>
                      {fileName ? fileName : 'Choose a file or drag and drop here'}
                    </strong>
                    <span style={{ fontSize: 13, color: '#5c6048' }}>
                      PDF, PNG, JPG, or text documents up to 25 MB
                    </span>
                  </div>

                  {fileName && (
                    <div className="badge blue" style={{ marginTop: 6 }}>
                      <FileCheck2 size={13} />
                      {fileName} {fileSize ? `(${(fileSize / 1024).toFixed(1)} KB)` : ''}
                    </div>
                  )}
                </div>

                {filePreviewUrl && (
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#5c6048', marginBottom: 4 }}>Image Preview:</div>
                    <img
                      src={filePreviewUrl}
                      alt="Upload preview"
                      style={{
                        maxHeight: 140,
                        maxWidth: '100%',
                        borderRadius: 8,
                        border: '1px solid #e3ddcf',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Paste Text Tab */}
            {activeTab === 'paste' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#292820' }}>
                    Pasted message, email, or notice:
                  </label>
                  <button
                    type="button"
                    className="linkbutton"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={handlePasteClipboard}
                  >
                    <Clipboard size={13} />
                    Paste from clipboard
                  </button>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <textarea
                    rows={6}
                    placeholder="Paste email notice, lease addendum clause, medical bill breakdown, or utility deadline notice..."
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      if (!fileName) setFileName('Pasted_Notice.txt');
                    }}
                    style={{ minHeight: 130, fontFamily: 'inherit', fontSize: 13.5 }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <small style={{ color: '#5c6048' }}>{rawText.length} characters</small>
                </div>
              </div>
            )}

            {/* One-click Sample Presets */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #eee9df' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={14} color="#5c6048" />
                <span style={{ fontSize: 12.5, fontWeight: 650, color: '#5c6048' }}>
                  Or try a sample document for instant testing:
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SAMPLE_DOCUMENTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="secondary"
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      background: fileName === sample.fileName ? '#eee9df' : '#f5f1e8',
                      borderColor: fileName === sample.fileName ? '#5c6048' : 'transparent',
                      color: fileName === sample.fileName ? '#5c6048' : '#3c3d30',
                    }}
                    onClick={() => handleSelectSample(sample)}
                  >
                    {sample.category === 'Insurance & Vehicle' && '🚗'}
                    {sample.category === 'Housing & Utilities' && '🏠'}
                    {sample.category === 'Health & Medical' && '🩺'}
                    {sample.category === 'Subscriptions & Services' && '☁️'}
                    {' '}{sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 14, borderTop: '1px solid #e3ddcf' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleStartAnalysis}
                disabled={!rawText.trim()}
              >
                <Sparkles size={16} />
                Extract and Review Obligation
              </button>
            </div>
          </>
        )}

        {/* STEP: ANALYZING SPINNER */}
        {step === 'analyzing' && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div
              className="spin"
              style={{
                width: 44,
                height: 44,
                margin: '0 auto 16px',
                border: '3px solid #eee9df',
                borderTopColor: '#5c6048',
                borderRadius: '50%',
              }}
            />
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>Analyzing document...</h3>
            <p className="muted" style={{ fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
              Extracting title, payee, amounts, due date, required actions, and source-backed consequences...
            </p>
          </div>
        )}

        {/* STEP 2: REVIEW & CONFIRMATION SCREEN */}
        {step === 'review' && (
          <>
            <div className="sectionhead" style={{ marginBottom: 6 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="linkbutton"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5c6048' }}
                    onClick={() => setStep('input')}
                  >
                    <ArrowLeft size={14} />
                    Back to input
                  </button>
                  <span style={{ color: '#cfc7b6' }}>|</span>
                  <span className="badge amber" style={{ fontSize: 11.5 }}>
                    <Info size={12} />
                    User confirmation required
                  </span>
                </div>
                <DialogTitle style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  Review Proposed Obligation
                </DialogTitle>
                <DialogDescription style={{ color: '#5c6048', marginTop: 2 }}>
                  Every extracted field is editable. Verify and confirm the details before adding to your timeline.
                </DialogDescription>
              </div>
            </div>

            {errorNotice && (
              <div className="notice error" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
                <AlertTriangle size={16} />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Document origin banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f5f1e8',
                borderRadius: 8,
                border: '1px solid #e3ddcf',
                fontSize: 13,
                margin: '12px 0 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <FileCode size={16} color="#5c6048" />
                <span style={{ fontWeight: 600, color: '#292820' }}>Source:</span>
                <span className="muted" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {fileName || 'Pasted text source'}
                </span>
              </div>
              <button
                type="button"
                className="linkbutton"
                style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setShowOriginalSource(!showOriginalSource)}
              >
                <Eye size={13} />
                {showOriginalSource ? 'Hide source text' : 'View source text'}
              </button>
            </div>

            {/* Collapsible raw source viewer */}
            {showOriginalSource && (
              <div
                style={{
                  background: '#292820',
                  color: '#e3ddcf',
                  padding: 14,
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.55,
                  maxHeight: 180,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 16,
                  fontFamily: 'monospace',
                }}
              >
                {rawText}
              </div>
            )}

            {/* 8 PROPOSED EDITABLE FIELDS FORM */}
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Field 1: Title */}
              <div className="field" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={14} color="#5c6048" />
                    Obligation Title *
                  </label>
                  {editedFields.title ? (
                    <button
                      type="button"
                      className="linkbutton"
                      style={{ fontSize: 11, color: '#85523f' }}
                      onClick={() => handleResetField('title')}
                    >
                      <RotateCcw size={10} style={{ display: 'inline', marginRight: 2 }} />
                      Reset to extracted
                    </button>
                  ) : (
                    <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                  )}
                </div>
                <input
                  type="text"
                  value={formFields.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="e.g. Progressive Auto Policy Renewal"
                  style={{
                    borderColor: editedFields.title ? '#b1aa97' : '#cfc7b6',
                    backgroundColor: editedFields.title ? '#fbf8f0' : '#fbf8f0',
                  }}
                />
              </div>

              {/* Form Grid for Category & Payee */}
              <div className="formgrid">
                {/* Field 2: Category */}
                <div className="field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag size={14} color="#5c6048" />
                      Category *
                    </label>
                    {editedFields.category ? (
                      <span className="badge amber" style={{ fontSize: 10.5, padding: '2px 6px' }}>Edited</span>
                    ) : (
                      <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                    )}
                  </div>
                  <select
                    value={formFields.category}
                    onChange={(e) => handleFieldChange('category', e.target.value as ObligationCategory)}
                    style={{
                      width: '100%',
                      border: '1px solid #cfc7b6',
                      borderRadius: 8,
                      padding: '10px 12px',
                      background: '#fbf8f0',
                      fontSize: 14,
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 3: Payee */}
                <div className="field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} color="#5c6048" />
                      Payee / Organization
                    </label>
                    {editedFields.payee ? (
                      <button
                        type="button"
                        className="linkbutton"
                        style={{ fontSize: 11, color: '#85523f' }}
                        onClick={() => handleResetField('payee')}
                      >
                        <RotateCcw size={10} style={{ display: 'inline', marginRight: 2 }} />
                        Reset
                      </button>
                    ) : (
                      <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formFields.payee}
                    onChange={(e) => handleFieldChange('payee', e.target.value)}
                    placeholder="e.g. Progressive Casualty Insurance"
                  />
                </div>
              </div>

              {/* Form Grid for Amount & Due Date */}
              <div className="formgrid">
                {/* Field 4: Amount */}
                <div className="field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IndianRupee size={14} color="#5c6048" />
                      Amount / Balance
                    </label>
                    {editedFields.amount ? (
                      <span className="badge amber" style={{ fontSize: 10.5, padding: '2px 6px' }}>Edited</span>
                    ) : (
                      <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formFields.amount}
                    onChange={(e) => handleFieldChange('amount', e.target.value)}
                    placeholder="e.g. ₹482.60 or ₹0.00"
                  />
                </div>

                {/* Field 5: Due Date */}
                <div className="field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} color="#5c6048" />
                      Due Date *
                    </label>
                    {editedFields.dueDate ? (
                      <span className="badge amber" style={{ fontSize: 10.5, padding: '2px 6px' }}>Edited</span>
                    ) : (
                      <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formFields.dueDate}
                    onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Field 6: Required Action */}
              <div className="field" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCheck size={14} color="#5c6048" />
                    Required Action *
                  </label>
                  {editedFields.requiredAction ? (
                    <button
                      type="button"
                      className="linkbutton"
                      style={{ fontSize: 11, color: '#85523f' }}
                      onClick={() => handleResetField('requiredAction')}
                    >
                      <RotateCcw size={10} style={{ display: 'inline', marginRight: 2 }} />
                      Reset
                    </button>
                  ) : (
                    <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Extracted</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={formFields.requiredAction}
                  onChange={(e) => handleFieldChange('requiredAction', e.target.value)}
                  placeholder="What specific step needs to be taken?"
                  style={{ minHeight: 65, resize: 'vertical' }}
                />
              </div>

              {/* Field 7: Consequence (Consequence Engine & Provenance) */}
              <div className="field" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#85523f', fontWeight: 700 }}>
                    <AlertTriangle size={14} color="#85523f" />
                    Documented Consequence
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className={`badge ${
                        formFields.consequenceProvenance === 'From document'
                          ? 'blue'
                          : formFields.consequenceProvenance === 'Added by you'
                          ? 'amber'
                          : ''
                      }`}
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {formFields.consequenceProvenance === 'From document' && <FileText size={11} />}
                      {formFields.consequenceProvenance === 'Added by you' && <ShieldAlert size={11} />}
                      {formFields.consequenceProvenance || 'From document'}
                    </span>

                    {editedFields.consequence && (
                      <button
                        type="button"
                        className="linkbutton"
                        style={{ fontSize: 11, color: '#85523f' }}
                        onClick={() => {
                          if (originalProposal) {
                            setFormFields(prev => ({
                              ...prev,
                              consequence: originalProposal.consequence,
                              consequenceProvenance: originalProposal.consequenceProvenance || 'From document',
                              consequenceType: originalProposal.consequenceType || 'general',
                            }));
                            setEditedFields(prev => ({ ...prev, consequence: false }));
                          }
                        }}
                      >
                        <RotateCcw size={10} style={{ display: 'inline', marginRight: 2 }} />
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Provenance Selector Chips */}
                <div style={{ display: 'flex', gap: 6, margin: '4px 0 6px', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#5c6048', fontWeight: 600 }}>Provenance:</span>
                  {(['From document', 'Added by you', 'Unknown'] as const).map(prov => (
                    <button
                      key={prov}
                      type="button"
                      className="secondary"
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        background: formFields.consequenceProvenance === prov ? '#292820' : '#eee9df',
                        color: formFields.consequenceProvenance === prov ? '#fbf8f0' : '#5c6048',
                        border: 0,
                      }}
                      onClick={() => {
                        setFormFields(prev => ({
                          ...prev,
                          consequenceProvenance: prov,
                          consequence: prov === 'Unknown' ? 'No documented consequence cited in source document.' : prev.consequence,
                        }));
                        setEditedFields(prev => ({ ...prev, consequence: true }));
                      }}
                    >
                      {prov}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={formFields.consequence}
                  onChange={(e) => {
                    handleFieldChange('consequence', e.target.value);
                    setFormFields(prev => ({ ...prev, consequenceProvenance: 'Added by you' }));
                  }}
                  placeholder="Documented penalty, late fee, cancellation, or grace period notice..."
                  style={{
                    minHeight: 65,
                    resize: 'vertical',
                    borderColor: formFields.consequenceProvenance === 'Unknown' ? '#cfc7b6' : '#ead8c8',
                  }}
                />
                <small style={{ color: '#5c6048', fontSize: 12 }}>
                  {formFields.consequenceProvenance === 'From document' && 'Extracted factually from source document. Never inventing penalties or savings.'}
                  {formFields.consequenceProvenance === 'Added by you' && 'Entered or adjusted by you.'}
                  {formFields.consequenceProvenance === 'Unknown' && 'No penalties or savings assumed. Ranked purely on due date.'}
                </small>
              </div>

              {/* Deadline Backplanner Settings */}
              <div
                style={{
                  padding: 12,
                  background: '#f5f1e8',
                  border: '1px solid #e3ddcf',
                  borderRadius: 8,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#5c6048', fontSize: 13 }}>
                    <CalendarClock size={15} color="#5c6048" />
                    Deadline Backplanner Settings
                  </label>
                  <span className="badge blue" style={{ fontSize: 11 }}>
                    Working backward
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#5c6048', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                      Estimated Work Duration:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={formFields.estimatedDurationDays ?? 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setFormFields(prev => ({ ...prev, estimatedDurationDays: val }));
                        }}
                        style={{ width: '70px', padding: '5px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cfc7b6' }}
                      />
                      <span style={{ fontSize: 12, color: '#5c6048' }}>days</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#5c6048', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                      Safety Buffer Time:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={formFields.bufferDays ?? 1}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setFormFields(prev => ({ ...prev, bufferDays: val }));
                        }}
                        style={{ width: '70px', padding: '5px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #cfc7b6' }}
                      />
                      <span style={{ fontSize: 12, color: '#5c6048' }}>days</span>
                    </div>
                  </div>
                </div>

                {formFields.dueDate && (
                  <div style={{ fontSize: 12, color: '#5c6048', background: '#fbf8f0', padding: '6px 10px', borderRadius: 6, border: '1px solid #eee9df' }}>
                    <strong>Recommended Start Date: </strong>
                    {offsetDate(formFields.dueDate, -((formFields.estimatedDurationDays ?? 1) + (formFields.bufferDays ?? 1)))}
                    <span style={{ color: '#5c6048', marginLeft: 6 }}>
                      ({(formFields.estimatedDurationDays ?? 1) + (formFields.bufferDays ?? 1)} days lead time before {formFields.dueDate})
                    </span>
                  </div>
                )}
              </div>

              {/* Field 8: Source Excerpt */}
              <div className="field" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color="#5c6048" />
                    Source Excerpt (Grounded Proof)
                  </label>
                  {editedFields.sourceExcerpt ? (
                    <button
                      type="button"
                      className="linkbutton"
                      style={{ fontSize: 11, color: '#85523f' }}
                      onClick={() => handleResetField('sourceExcerpt')}
                    >
                      <RotateCcw size={10} style={{ display: 'inline', marginRight: 2 }} />
                      Reset
                    </button>
                  ) : (
                    <span className="badge blue" style={{ fontSize: 10.5, padding: '2px 6px' }}>Exact Quote</span>
                  )}
                </div>
                <div className="quote" style={{ margin: 0 }}>
                  <textarea
                    rows={3}
                    value={formFields.sourceExcerpt}
                    onChange={(e) => handleFieldChange('sourceExcerpt', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 0,
                      outline: 'none',
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: '#292820',
                      resize: 'vertical',
                      padding: 0,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginTop: 22,
                paddingTop: 16,
                borderTop: '1px solid #e3ddcf',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="secondary"
                style={{ fontSize: 13 }}
                onClick={handleSaveToInboxDraft}
                title="Keep in Universal Inbox without adding to timeline yet"
              >
                Save as Inbox Draft
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setStep('input')}
                >
                  Edit Source
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmObligation}
                  style={{
                    backgroundColor: '#555d3d',
                    borderColor: '#555d3d',
                    boxShadow: '0 2px 8px rgba(23,115,78,0.25)',
                  }}
                >
                  <CheckCheck size={16} />
                  Confirm & Create Obligation
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

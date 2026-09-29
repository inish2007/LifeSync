'use client';

import { useState } from 'react';
import {
  Inbox,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Trash2,
  Calendar,
  IndianRupee,
  Building2,
  AlertTriangle,
  Eye,
  FileCheck2,
  CheckCircle2
} from 'lucide-react';
import { UniversalInboxItem } from '@/lib/types';
import { deleteInboxItem } from '@/lib/storage';

interface UniversalInboxViewProps {
  items: UniversalInboxItem[];
  onReviewItem: (item: UniversalInboxItem) => void;
  onAddNew: () => void;
  onItemDeleted?: () => void;
}

export default function UniversalInboxView({
  items,
  onReviewItem,
  onAddNew,
  onItemDeleted,
}: UniversalInboxViewProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [selectedRawSource, setSelectedRawSource] = useState<UniversalInboxItem | null>(null);

  const filteredItems = items.filter((item) => {
    if (filter === 'pending') return item.status === 'pending_review';
    if (filter === 'confirmed') return item.status === 'confirmed';
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'pending_review').length;
  const confirmedCount = items.filter((i) => i.status === 'confirmed').length;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteInboxItem(id);
    if (onItemDeleted) onItemDeleted();
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Header Bar */}
      <div className="sectionhead" style={{ marginBottom: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Inbox size={20} color="#5c6048" />
              Universal Inbox
            </h2>
            {pendingCount > 0 && (
              <span className="badge amber">
                {pendingCount} awaiting review
              </span>
            )}
          </div>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
            All incoming documents, pasted notices, and extracted drafts land here before joining your timeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={onAddNew}
          >
            + Add to Inbox
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eee9df', paddingBottom: 10 }}>
        <button
          type="button"
          className="taskbutton"
          style={{
            fontSize: 13,
            fontWeight: 650,
            padding: '4px 10px',
            borderRadius: 6,
            background: filter === 'all' ? '#eee9df' : 'transparent',
            color: filter === 'all' ? '#5c6048' : '#5c6048',
          }}
          onClick={() => setFilter('all')}
        >
          All Inbox Items ({items.length})
        </button>
        <button
          type="button"
          className="taskbutton"
          style={{
            fontSize: 13,
            fontWeight: 650,
            padding: '4px 10px',
            borderRadius: 6,
            background: filter === 'pending' ? '#ead8c8' : 'transparent',
            color: filter === 'pending' ? '#85523f' : '#5c6048',
          }}
          onClick={() => setFilter('pending')}
        >
          Awaiting Review ({pendingCount})
        </button>
        <button
          type="button"
          className="taskbutton"
          style={{
            fontSize: 13,
            fontWeight: 650,
            padding: '4px 10px',
            borderRadius: 6,
            background: filter === 'confirmed' ? '#dce0cb' : 'transparent',
            color: filter === 'confirmed' ? '#555d3d' : '#5c6048',
          }}
          onClick={() => setFilter('confirmed')}
        >
          Confirmed ({confirmedCount})
        </button>
      </div>

      {/* Inbox Items List */}
      {filteredItems.length === 0 ? (
        <div className="empty" style={{ textAlign: 'center', padding: '36px 16px' }}>
          <Inbox size={36} color="#b1aa97" style={{ margin: '0 auto 12px' }} />
          <h3>No documents in this inbox view</h3>
          <p className="muted" style={{ maxWidth: 400, margin: '6px auto 16px' }}>
            Upload a bill, renewal letter, or paste an email snippet. LifeLoop will extract the obligation for your review.
          </p>
          <button type="button" className="primary" onClick={onAddNew}>
            Add document or paste text
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredItems.map((item) => {
            const isPending = item.status === 'pending_review';
            return (
              <div
                key={item.id}
                style={{
                  background: '#fbf8f0',
                  border: isPending ? '1.5px solid #5c6048' : '1px solid #e3ddcf',
                  borderRadius: 12,
                  padding: 18,
                  boxShadow: isPending ? '0 3px 12px rgba(74,72,53,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: isPending ? '#eee9df' : '#eee9df',
                        color: isPending ? '#5c6048' : '#5c6048',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={18} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 16, color: '#292820' }}>
                          {item.proposal.title || item.sourceDocument.name}
                        </strong>
                        <span className="badge" style={{ fontSize: 11.5 }}>
                          {item.proposal.category}
                        </span>
                        {isPending ? (
                          <span className="badge amber" style={{ fontSize: 11 }}>
                            <Clock size={11} />
                            Pending User Confirmation
                          </span>
                        ) : (
                          <span className="badge green" style={{ fontSize: 11 }}>
                            <CheckCircle2 size={11} />
                            Confirmed in Plan
                          </span>
                        )}
                      </div>

                      {/* Source details */}
                      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 13, color: '#5c6048', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={13} />
                          {item.proposal.payee || 'Direct notice'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IndianRupee size={13} />
                          {item.proposal.amount || 'N/A'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} />
                          Due: {item.proposal.dueDate}
                        </span>
                      </div>

                      {/* Action required summary */}
                      <p style={{ margin: '8px 0 4px', fontSize: 13.5, color: '#3c3d30' }}>
                        <strong>Action:</strong> {item.proposal.requiredAction}
                      </p>

                      {/* Consequence note */}
                      {item.proposal.consequence && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '6px 10px',
                            background: '#f6ece3',
                            border: '1px solid #ead8c8',
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: '#85523f',
                            display: 'flex',
                            gap: 6,
                            alignItems: 'baseline',
                          }}
                        >
                          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{item.proposal.consequence}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                    {isPending ? (
                      <button
                        type="button"
                        className="primary"
                        style={{ padding: '8px 14px', fontSize: 13 }}
                        onClick={() => onReviewItem(item)}
                      >
                        <Sparkles size={14} />
                        Review & Confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        style={{ padding: '6px 12px', fontSize: 12.5 }}
                        onClick={() => onReviewItem(item)}
                      >
                        View Details
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="linkbutton"
                        style={{ fontSize: 12, color: '#5c6048', display: 'flex', alignItems: 'center', gap: 3 }}
                        onClick={() => setSelectedRawSource(selectedRawSource?.id === item.id ? null : item)}
                      >
                        <Eye size={12} />
                        Source
                      </button>
                      <button
                        type="button"
                        className="linkbutton"
                        style={{ fontSize: 12, color: '#85523f', display: 'flex', alignItems: 'center', gap: 3 }}
                        onClick={(e) => handleDelete(item.id, e)}
                        title="Delete from inbox"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Raw Source View */}
                {selectedRawSource?.id === item.id && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: '#292820',
                      color: '#e3ddcf',
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      maxHeight: 160,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ color: '#cfc7b6', marginBottom: 6, fontWeight: 600 }}>
                      --- Raw Extracted Text ({item.sourceDocument.name}) ---
                    </div>
                    {item.sourceDocument.rawText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

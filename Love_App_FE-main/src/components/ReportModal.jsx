import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../ToastContext';

const REASONS = [
  { value: 'spam', label: '📢 Spam' },
  { value: 'harassment', label: '😡 Quấy rối' },
  { value: 'hate_speech', label: '🤬 Phát ngôn thù ghét' },
  { value: 'fake_profile', label: '🎭 Hồ sơ giả mạo' },
  { value: 'other', label: '❓ Khác' },
];

export function ReportModal({ targetId, targetType, targetName, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) { toast('Vui lòng chọn lý do báo cáo', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/users/report', {
        target_id: targetId,
        target_type: targetType, // 'user' | 'post'
        reason,
        description: description.trim(),
      });
      toast('Đã gửi báo cáo. Cảm ơn bạn!', 'success');
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ padding: '28px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 20 }}>🚩 Báo cáo {targetType === 'user' ? `@${targetName}` : 'bài viết'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <label className="label">Lý do báo cáo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {REASONS.map(r => (
            <label key={r.value} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 10, border: `1.5px solid ${reason === r.value ? 'var(--rose)' : 'var(--border)'}`,
              background: reason === r.value ? 'var(--rose-pale)' : 'white',
              cursor: 'pointer', transition: 'all 0.15s', fontSize: 14
            }}>
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ accentColor: 'var(--rose)' }}
              />
              {r.label}
            </label>
          ))}
        </div>

        <label className="label">Mô tả thêm <span style={{ color: 'var(--ink-ghost)' }}>(tuỳ chọn)</span></label>
        <textarea
          className="input-field"
          placeholder="Mô tả chi tiết vấn đề..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ marginBottom: 20 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Hủy</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting || !reason} style={{ flex: 2 }}>
            {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📤 Gửi báo cáo'}
          </button>
        </div>
      </div>
    </div>
  );
}

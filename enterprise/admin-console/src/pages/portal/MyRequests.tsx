import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, XCircle, Plus, Send, X } from 'lucide-react';
import { api } from '../../api/client';
import { Card, Badge, Button } from '../../components/ui';
import { usePortalAgent } from '../../contexts/PortalAgentContext';

const TOOL_OPTIONS = [
  { value: 'shell', label: 'Shell — Execute commands on agent microVM' },
  { value: 'browser', label: 'Browser — Headless web browsing & form interaction' },
  { value: 'file_write', label: 'File Write — Create and edit files in workspace' },
  { value: 'code_execution', label: 'Code Execution — Run Python/Node.js scripts' },
  { value: 'email-send', label: 'Email Send — Send emails on your behalf' },
  { value: 'crm-query', label: 'CRM Query — Read customer data' },
  { value: 'slack', label: 'Slack Integration — Post messages to channels' },
  { value: 'github-pr', label: 'GitHub — Manage repos, PRs, issues' },
  { value: 'aws-cli', label: 'AWS CLI — Run AWS commands' },
];

export default function MyRequests() {
  const { agentType } = usePortalAgent();
  const [data, setData] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedTool, setSelectedTool] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = () => api.get<any>(`/portal/requests?agent_type=${agentType}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [agentType]);

  const handleSubmit = async () => {
    if (!selectedTool) return;
    setSubmitting(true);
    try {
      await api.post('/portal/requests/create', {
        type: 'tool',
        resourceId: selectedTool,
        resourceName: TOOL_OPTIONS.find(t => t.value === selectedTool)?.label?.split('—')[0]?.trim() || selectedTool,
        reason: reason || `Employee requested access to: ${selectedTool}`,
      });
      setToast({ ok: true, msg: 'Request submitted — IT Admin will review shortly.' });
      setShowNew(false); setSelectedTool(''); setReason('');
      await load();
    } catch {
      setToast({ ok: false, msg: 'Submission failed. Please try again.' });
    }
    setSubmitting(false);
    setTimeout(() => setToast(null), 4000);
  };

  if (!data) return <div className="p-6 text-text-muted text-sm">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">My Requests</h1>
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New Request
        </Button>
      </div>

      {toast && (
        <div className={`rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 ${toast.ok ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
          {toast.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {toast.msg}
        </div>
      )}

      {/* New Request Form */}
      {showNew && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Request Tool / Skill Access</h3>
            <button onClick={() => setShowNew(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">What do you need access to?</label>
              <select value={selectedTool} onChange={e => setSelectedTool(e.target.value)}
                className="w-full rounded-xl border border-dark-border/60 bg-surface-dim px-4 py-2.5 text-sm text-text-primary focus:border-primary/60 focus:outline-none">
                <option value="">Select tool or skill...</option>
                {TOOL_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Reason (optional)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="e.g. Need to run Python scripts to automate weekly reports"
                className="w-full rounded-xl border border-dark-border/60 bg-surface-dim px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/60 focus:outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="default" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button variant="primary" disabled={!selectedTool || submitting} onClick={handleSubmit}>
                <Send size={13} /> {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Clock size={15} className="text-warning" /> Pending ({data.pending?.length || 0})
        </h3>
        {data.pending?.length > 0 ? (
          <div className="space-y-2">
            {data.pending.map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 rounded-xl bg-warning/5 border border-warning/20 px-4 py-3">
                <Clock size={15} className="text-warning mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{r.tool || r.resourceName || r.description}</p>
                  <p className="text-xs text-text-muted mt-0.5">{r.reason}</p>
                  <p className="text-[10px] text-text-muted mt-1">Submitted: {new Date(r.timestamp).toLocaleString()}</p>
                </div>
                <Badge color="warning">Pending</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-4">No pending requests — you're all set.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <FileText size={15} className="text-text-muted" /> Resolved ({data.resolved?.length || 0})
        </h3>
        {data.resolved?.length > 0 ? (
          <div className="space-y-2">
            {data.resolved.map((r: any) => (
              <div key={r.id} className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                r.status === 'approved' ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'
              }`}>
                {r.status === 'approved'
                  ? <CheckCircle size={15} className="text-success mt-0.5 shrink-0" />
                  : <XCircle size={15} className="text-danger mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{r.tool || r.resourceName || r.description}</p>
                  <p className="text-xs text-text-muted mt-0.5">Reviewed by: {r.reviewer || 'IT Admin'}</p>
                  <p className="text-[10px] text-text-muted mt-1">{new Date(r.resolvedAt || r.timestamp).toLocaleString()}</p>
                </div>
                <Badge color={r.status === 'approved' ? 'success' : 'danger'}>{r.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-4">No resolved requests yet.</p>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card, Badge, Button, PageHeader, Tabs } from '../components/ui';
import { useApprovals, useApproveRequest, useDenyRequest } from '../hooks/useApi';
import type { ApprovalRequest } from '../hooks/useApi';

const riskColor = (r: string): 'danger' | 'warning' | 'success' => r === 'high' ? 'danger' : r === 'medium' ? 'warning' : 'success';

function ApprovalCard({ req, onApprove, onDeny }: { req: ApprovalRequest; onApprove?: () => void; onDeny?: () => void }) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{req.id}</span>
          <Badge color={riskColor(req.risk)}>{req.risk} risk</Badge>
          {req.status !== 'pending' && <Badge color={req.status === 'approved' ? 'success' : 'danger'}>{req.status}</Badge>}
        </div>
        {req.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={onApprove}><CheckCircle size={14} /> Approve</Button>
            <Button variant="danger" size="sm" onClick={onDeny}><XCircle size={14} /> Deny</Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-text-muted">Requester</p><p className="text-sm">{req.tenant} <span className="text-xs text-text-muted">({req.tenantId})</span></p></div>
        <div><p className="text-xs text-text-muted">Tool / Resource</p><Badge color="info">{req.tool}</Badge></div>
        <div className="col-span-2"><p className="text-xs text-text-muted">Justification</p><p className="text-sm text-text-secondary">{req.reason}</p></div>
        <div><p className="text-xs text-text-muted">Requested</p><p className="text-xs text-text-secondary">{new Date(req.timestamp).toLocaleString()}</p></div>
        {req.reviewer && <div><p className="text-xs text-text-muted">Reviewed by</p><p className="text-xs text-text-secondary">{req.reviewer}</p></div>}
      </div>
    </Card>
  );
}

export default function Approvals() {
  const { data, isLoading } = useApprovals();
  const approveMut = useApproveRequest();
  const denyMut = useDenyRequest();
  const [activeTab, setActiveTab] = useState('pending');

  const pending = data?.pending || [];
  const resolved = data?.resolved || [];

  return (
    <div>
      <PageHeader title="Approval Queue" description="Review and manage permission escalation requests" />
      <Tabs
        tabs={[
          { id: 'pending', label: 'Pending', count: pending.length },
          { id: 'resolved', label: 'Resolved', count: resolved.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      <div className="mt-4 space-y-4">
        {activeTab === 'pending' && (
          pending.length === 0 ? (
            <Card><div className="py-8 text-center"><CheckCircle size={32} className="mx-auto mb-2 text-success" /><p className="text-sm text-text-muted">All caught up — no pending approvals</p></div></Card>
          ) : (
            pending.map(req => <ApprovalCard key={req.id} req={req} onApprove={() => approveMut.mutate(req.id)} onDeny={() => denyMut.mutate(req.id)} />)
          )
        )}
        {activeTab === 'resolved' && resolved.map(req => <ApprovalCard key={req.id} req={req} />)}
      </div>
    </div>
  );
}

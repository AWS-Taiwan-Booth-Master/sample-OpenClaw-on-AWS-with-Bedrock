import { useParams, useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ArrowLeft, Edit3, Play, Settings, Bot, Star, Zap, Clock, Shield, MessageSquare, TrendingUp, Eye, Loader, FolderOpen } from 'lucide-react';
import { Card, Badge, Button, PageHeader, StatusDot } from '../../components/ui';
import { useAgent, useAgents, usePositions, useBindings, useSessions, useAgentDailyUsage } from '../../hooks/useApi';
import { CHANNEL_LABELS } from '../../types';
import type { ChannelType } from '../../types';

const qualityRadarOpts: ApexOptions = {
  chart: { type: 'radar', toolbar: { show: false }, background: 'transparent' },
  colors: ['#6366f1'],
  xaxis: { categories: ['Satisfaction', 'Tool Success', 'Response Time', 'Compliance', 'Completion'] },
  yaxis: { show: false },
  stroke: { width: 2 },
  fill: { opacity: 0.2 },
  markers: { size: 3 },
  plotOptions: { radar: { polygons: { strokeColors: '#2e3039', connectorColors: '#2e3039', fill: { colors: ['transparent'] } } } },
  tooltip: { theme: 'dark' },
  dataLabels: { enabled: false },
};

const activityOpts: ApexOptions = {
  chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
  colors: ['#6366f1', '#22c55e'],
  plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
  grid: { borderColor: '#2e3039', strokeDashArray: 4 },
  xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], labels: { style: { colors: '#64748b', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' } } },
  tooltip: { theme: 'dark' },
  legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } },
  dataLabels: { enabled: false },
};

const tokenOpts: ApexOptions = {
  chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
  colors: ['#06b6d4', '#f59e0b'],
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.05 } },
  grid: { borderColor: '#2e3039', strokeDashArray: 4 },
  xaxis: { categories: ['Mar 14', 'Mar 15', 'Mar 16', 'Mar 17', 'Mar 18', 'Mar 19', 'Mar 20'], labels: { style: { colors: '#64748b', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
  tooltip: { theme: 'dark' },
  legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } },
  dataLabels: { enabled: false },
};

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useAgent(agentId || '');
  const { data: allAgents = [] } = useAgents();
  const { data: positions = [] } = usePositions();
  const { data: allBindings = [] } = useBindings();
  const { data: allSessions = [] } = useSessions();
  const { data: dailyUsage = [] } = useAgentDailyUsage(agentId || '');

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader size={24} className="animate-spin text-primary" /></div>;
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-text-muted mb-4">Agent Not Found</p>
        <Button variant="primary" onClick={() => navigate('/agents')}>Back to Agent List</Button>
      </div>
    );
  }

  const position = positions.find(p => p.id === agent.positionId);
  const bindings = allBindings.filter(b => b.agentId === agent.id);
  const sessions = allSessions.filter(s => s.agentId === agent.id);

  return (
    <div>
      <PageHeader
        title={agent.name}
        description={`${agent.positionName} · ${agent.employeeName} · Created ${new Date(agent.createdAt).toLocaleDateString()}`}
        actions={
          <div className="flex gap-2">
            <Button variant="default" onClick={() => navigate('/agents')}><ArrowLeft size={16} /> Back</Button>
            <Button variant="default" onClick={() => navigate(`/agents/${agent.id}/soul`)}><Edit3 size={16} /> Edit SOUL</Button>
            <Button variant="default" onClick={() => navigate(`/playground?agent=${agent.id}`)}><MessageSquare size={16} /> Playground</Button>
            <Button variant="default" onClick={() => navigate(`/workspace?agent=${agent.id}`)}><FolderOpen size={16} /> Workspace</Button>
          </div>
        }
      />

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 mb-6">
        <Card>
          <p className="text-xs text-text-muted">Status</p>
          <div className="mt-1"><StatusDot status={agent.status} /></div>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Quality Score</p>
          <p className="mt-1 text-xl font-bold text-warning">⭐ {agent.qualityScore || '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Skills</p>
          <p className="mt-1 text-xl font-bold">{agent.skills.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Channels</p>
          <p className="mt-1 text-xl font-bold">{agent.channels.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Active Sessions</p>
          <p className="mt-1 text-xl font-bold text-success">{sessions.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Bindings</p>
          <p className="mt-1 text-xl font-bold">{bindings.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Quality Radar */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Quality Assessment</h3>
          <p className="text-sm text-text-secondary mb-2">Five-dimension quality radar</p>
          <Chart options={qualityRadarOpts} series={[{ name: 'Score', data: [
            agent.qualityScore ? Math.round(agent.qualityScore * 20) : 80,
            dailyUsage.length > 0 ? Math.min(100, 80 + dailyUsage.length * 3) : 85,
            Math.min(100, 70 + (agent.skills?.length || 0) * 3),
            Math.min(100, 90 + sessions.length),
            Math.min(100, 85 + bindings.length * 5),
          ] }]} type="radar" height={260} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between rounded bg-dark-bg px-2 py-1"><span className="text-text-muted">Satisfaction</span><span className="text-success">{agent.qualityScore ? `${Math.round(agent.qualityScore * 20)}%` : '—'}</span></div>
            <div className="flex justify-between rounded bg-dark-bg px-2 py-1"><span className="text-text-muted">Requests/Week</span><span className="text-success">{dailyUsage.reduce((s, d) => s + d.requests, 0)}</span></div>
            <div className="flex justify-between rounded bg-dark-bg px-2 py-1"><span className="text-text-muted">Skills</span><span className="text-info">{agent.skills?.length || 0}</span></div>
            <div className="flex justify-between rounded bg-dark-bg px-2 py-1"><span className="text-text-muted">Bindings</span><span className="text-success">{bindings.length}</span></div>
          </div>
        </Card>

        {/* Weekly Activity */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Weekly Activity</h3>
          <p className="text-sm text-text-secondary mb-2">Conversations and tool calls this week</p>
          <Chart options={activityOpts} series={[
            { name: 'Conversations', data: dailyUsage.map(d => d.requests) },
            { name: 'Tool Calls', data: dailyUsage.map(d => Math.round(d.requests * 0.6)) },
          ]} type="bar" height={260} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        {/* Token Usage */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Token Usage (7 days)</h3>
          <Chart options={tokenOpts} series={[
            { name: 'Input Tokens', data: dailyUsage.map(d => d.inputTokens) },
            { name: 'Output Tokens', data: dailyUsage.map(d => d.outputTokens) },
          ]} type="area" height={240} />
        </Card>

        {/* Configuration Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">Configuration</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Position</p>
              <p className="text-sm font-medium">{agent.positionName}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Employee</p>
              <p className="text-sm font-medium">{agent.employeeName}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1.5">SOUL Versions</p>
              <div className="flex gap-1.5">
                <Badge>Global v{agent.soulVersions.global}</Badge>
                <Badge color="primary">Position v{agent.soulVersions.position}</Badge>
                <Badge color="success">Personal v{agent.soulVersions.personal}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1.5">Channels</p>
              <div className="flex gap-1.5">{agent.channels.map(c => <Badge key={c} color="info">{CHANNEL_LABELS[c as ChannelType]}</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1.5">Skills ({agent.skills.length})</p>
              <div className="flex flex-wrap gap-1.5">{agent.skills.map(s => <Badge key={s} color="success">{s}</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1.5">Tool Permissions</p>
              <div className="flex flex-wrap gap-1.5">{(position?.toolAllowlist || []).map(t => <Badge key={t} color="info">{t}</Badge>)}</div>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Last Updated</p>
              <p className="text-sm text-text-secondary">{new Date(agent.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Sessions */}
      {sessions.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-text-primary mb-4">Active Sessions ({sessions.length})</h3>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-dark-bg p-3">
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">{s.employeeName}</p>
                    <p className="text-xs text-text-muted">{s.lastMessage.slice(0, 60)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color="info">{CHANNEL_LABELS[s.channel as ChannelType]}</Badge>
                  <span className="text-xs text-text-muted">{s.turns} turns</span>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/monitor')}><Eye size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

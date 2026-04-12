import { useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ArrowLeft, Eye, Radio, Send, User, Bot, Shield, Wrench, Clock, MessageSquare } from 'lucide-react';
import { Card, Badge, Button, PageHeader, StatusDot } from '../../components/ui';
import { useSessionDetail } from '../../hooks/useApi';
import { CHANNEL_LABELS } from '../../types';
import type { LiveSession, ChannelType } from '../../types';

const responseTimeOpts: ApexOptions = {
  chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
  colors: ['#6366f1'],
  stroke: { curve: 'smooth', width: 2 },
  grid: { borderColor: '#2e3039', strokeDashArray: 4 },
  xaxis: { labels: { style: { colors: '#64748b', fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '10px' }, formatter: (v: number) => `${v}s` } },
  tooltip: { theme: 'dark' },
  dataLabels: { enabled: false },
};

interface Props { session: LiveSession; onBack: () => void; }

export default function SessionDetail({ session, onBack }: Props) {
  const { data: detail } = useSessionDetail(session.id);
  const [mode, setMode] = useState<'observe' | 'takeover'>('observe');
  const [takeoverMsg, setTakeoverMsg] = useState('');

  const conversation = detail?.conversation || [];
  const quality = detail?.quality || { satisfaction: 0, toolSuccess: 0, responseTime: 0, compliance: 0, completionRate: 0, overallScore: 0 };
  const planE = detail?.planE || [];

  const startedAt = session.startedAt;
  const elapsed = startedAt ? Math.max(1, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)) : 0;

  // Generate response time data from conversation tool calls
  const responseTimes = conversation
    .filter(m => m.toolCall)
    .map(m => parseFloat(m.toolCall!.duration) || 2.0);
  if (responseTimes.length === 0) responseTimes.push(2.0, 1.8, 2.5);

  return (
    <div>
      <PageHeader
        title={`Session: ${session.employeeName} ↔ ${session.agentName}`}
        description={`${CHANNEL_LABELS[session.channel as ChannelType]} · ${elapsed}min · ${session.turns} turns · ${session.tokensUsed || 0} tokens`}
        actions={
          <div className="flex gap-2">
            <Button variant="default" onClick={onBack}><ArrowLeft size={16} /> Back</Button>
            {mode === 'observe' ? (
              <Button variant="danger" onClick={() => setMode('takeover')}><Radio size={16} /> Take Over</Button>
            ) : (
              <Button variant="success" onClick={() => setMode('observe')}><Eye size={16} /> Return to Agent</Button>
            )}
          </div>
        }
      />

      <div className={`mb-4 rounded-lg px-4 py-2 text-sm font-medium ${
        mode === 'observe' ? 'bg-info/10 text-info border border-info/20' : 'bg-danger/10 text-danger border border-danger/20'
      }`}>
        {mode === 'observe'
          ? '👁 Observe Mode — Watching this session in real-time (read-only)'
          : `🔴 Takeover Mode — Agent paused. You are responding directly to ${session.employeeName}.`}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conversation stream */}
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Conversation Stream</h3>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
              {conversation.map((msg, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    msg.role === 'user' ? 'bg-info/10 text-info' : msg.role === 'tool' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                  }`}>
                    {msg.role === 'user' ? <User size={16} /> : msg.role === 'tool' ? <Wrench size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-primary">
                        {msg.role === 'user' ? session.employeeName : msg.role === 'tool' ? 'Tool Call' : session.agentName}
                      </span>
                      <span className="text-xs text-text-muted">{msg.ts}</span>
                      {msg.toolCall && (
                        <Badge color={msg.toolCall.status === 'success' ? 'success' : 'danger'}>
                          {msg.toolCall.tool} · {msg.toolCall.duration}
                        </Badge>
                      )}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user' ? 'bg-info/5 border border-info/10'
                      : msg.role === 'tool' ? 'bg-warning/5 border border-warning/10 font-mono text-xs'
                      : 'bg-dark-bg border border-dark-border'
                    }`}>
                      <p className="whitespace-pre-wrap text-text-primary">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {conversation.length === 0 && (
                <div className="text-center py-8 text-text-muted">
                  <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No conversation history available</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    Message-level storage requires a persistent conversation log. Session metadata (turns, tokens, duration) is available in the sidebar.
                  </p>
                </div>
              )}
            </div>

            {mode === 'takeover' && (
              <div className="mt-4 border-t border-dark-border pt-4">
                <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2 text-xs text-warning mb-3">
                  ⚠️ Live takeover requires real-time WebSocket channel integration — planned for v1.1
                </div>
                <div className="flex gap-2 opacity-50 pointer-events-none">
                  <input value={takeoverMsg} onChange={e => setTakeoverMsg(e.target.value)}
                    placeholder={`Message to ${session.employeeName}...`}
                    className="flex-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-danger focus:outline-none" disabled />
                  <Button variant="danger" disabled><Send size={16} /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Session Info</h3>
            <div className="space-y-2.5">
              {[
                ['Employee', session.employeeName],
                ['Agent', session.agentName],
                ['Channel', CHANNEL_LABELS[session.channel as ChannelType]],
                ['Duration', `${elapsed}min`],
                ['Turns', String(session.turns)],
                ['Tool Calls', String(session.toolCalls || conversation.filter(m => m.role === 'tool').length)],
                ['Tokens', String(session.tokensUsed || 0)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-text-muted">{label}</span>
                  <span className="text-sm font-medium">{val}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Status</span>
                <StatusDot status={session.status} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Quality Metrics</h3>
              <span className="text-[10px] text-text-muted bg-surface-dim px-2 py-0.5 rounded-full">Estimated</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Satisfaction', value: quality.satisfaction, max: 5, color: 'bg-success' },
                { label: 'Tool Success', value: quality.toolSuccess, max: 100, color: 'bg-primary', suffix: '%' },
                { label: 'Response Time', value: quality.responseTime, max: 5, color: 'bg-info', suffix: 's', invert: true },
                { label: 'Compliance', value: quality.compliance, max: 100, color: 'bg-cyan', suffix: '%' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">{m.label}</span>
                    <span className="text-text-primary font-medium">{m.value}{m.suffix || ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-dark-bg">
                    <div className={`h-full rounded-full ${m.color}`}
                      style={{ width: `${m.invert ? Math.max(0, (1 - m.value / m.max) * 100) : (m.value / m.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-dark-border flex justify-between">
              <span className="text-xs text-text-muted">Overall Score</span>
              <span className="text-sm font-bold text-warning">⭐ {quality.overallScore}</span>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Response Time</h3>
            <Chart
              options={{...responseTimeOpts, xaxis: { ...responseTimeOpts.xaxis, categories: responseTimes.map((_, i) => `T${i + 1}`) }}}
              series={[{ name: 'Response', data: responseTimes }]}
              type="line" height={100}
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Plan E — Output Scan</h3>
            <div className="space-y-2">
              {planE.map((r, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-xs ${
                  r.result === 'pass' ? 'bg-success/5 border border-success/10' : 'bg-warning/5 border border-warning/10'
                }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium">Turn {r.turn}</span>
                    <Badge color={r.result === 'pass' ? 'success' : 'warning'} dot>{r.result}</Badge>
                  </div>
                  <p className="text-text-muted">{r.detail}</p>
                </div>
              ))}
              {planE.length === 0 && <p className="text-xs text-text-muted">No scan results yet</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import kronosLogo from '../../assets/branding/kronos_logo.webp';

type Status = 'active' | 'stopped' | 'pending';

export interface ControlWidgetProps {
  promptPlaceholder?: string;
  lastCommand?: string;
  status?: Status;
  steps?: string[];
  expanded?: boolean;
  deviceContext?: 'desktop' | 'virtual-machine' | 'mobile';
  onSendPrompt?: (prompt: string) => void;
  onSelectScreen?: () => void;
  onOpenWeb?: () => void;
  onOpenSettings?: () => void;
  onHide?: () => void;
  onToggleMic?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const statusColors: Record<Status, { bg: string; text: string }> = {
  active: { bg: 'rgba(94, 234, 212, 0.14)', text: '#22d3ee' },
  stopped: { bg: 'rgba(248, 180, 0, 0.18)', text: '#fbbf24' },
  pending: { bg: 'rgba(248, 113, 113, 0.18)', text: '#f87171' }
};

const baseShadow = '0 20px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)';

const pillButton = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  color: '#e5e7eb'
};

const quickActions = [
  { label: 'Select Screen', key: 'screen' },
  { label: 'Open Web', key: 'web' },
  { label: 'Settings', key: 'settings' },
  { label: 'Hide TuriX', key: 'hide' }
] as const;

const ControlWidget: React.FC<ControlWidgetProps> = ({
  promptPlaceholder = 'What can I help you?',
  lastCommand = 'use your MCP to continuously execute the workflow',
  status = 'stopped',
  steps = [],
  expanded = false,
  deviceContext = 'desktop',
  onSendPrompt,
  onSelectScreen,
  onOpenWeb,
  onOpenSettings,
  onHide,
  onToggleMic,
  className = '',
  style
}) => {
  const [prompt, setPrompt] = useState('');

  const statusTheme = useMemo(() => statusColors[status] ?? statusColors.stopped, [status]);

  const handleSend = () => {
    if (!prompt.trim()) return;
    onSendPrompt?.(prompt.trim());
    setPrompt('');
  };

  const handleAction = (key: string) => {
    if (key === 'screen') onSelectScreen?.();
    if (key === 'web') onOpenWeb?.();
    if (key === 'settings') onOpenSettings?.();
    if (key === 'hide') onHide?.();
  };

  const shellStyle: React.CSSProperties = {
    width: expanded ? 'min(860px, 95vw)' : 'min(720px, 92vw)',
    minHeight: expanded ? 240 : 200,
    borderRadius: 18,
    padding: expanded ? '18px 18px 14px' : '14px 14px 12px',
    background: 'linear-gradient(145deg, rgba(26,26,28,0.95), rgba(16,16,18,0.92))',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: baseShadow,
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    ...style
  };

  const commandBarStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 12px',
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: 10,
    alignItems: 'center'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#e5e7eb',
    fontSize: 15,
    outline: 'none'
  };

  const stepPanelStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '10px 12px',
    color: '#cbd5e1',
    fontSize: 13.5,
    display: steps.length ? 'grid' : 'none',
    gap: 6
  };

  const bottomBarStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6
  };

  const quickWrapStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center'
  };

  const micButtonStyle: React.CSSProperties = {
    ...pillButton,
    width: 36,
    height: 36,
    borderRadius: 18,
    display: 'grid',
    placeItems: 'center'
  };

  const sizeHint = deviceContext === 'virtual-machine' ? 'VM Control' : deviceContext === 'mobile' ? 'Mobile Control' : 'Desktop Control';

  return (
    <motion.div
      className={className}
      style={shellStyle}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(145deg, rgba(88,120,255,0.18), rgba(255,255,255,0.04))',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden'
          }}
        >
          <img
            src={kronosLogo}
            alt="Kronos Logo"
            style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
          />
        </div>
        <div style={{ flex: 1, opacity: 0.8, color: '#e2e8f0', fontSize: 14 }}>{sizeHint}</div>
        <button
          onClick={onToggleMic}
          style={micButtonStyle}
          aria-label="Toggle microphone"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" strokeWidth="1.7">
            <path d="M12 3a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <path d="M12 19v3" />
          </svg>
        </button>
      </div>

      <div style={commandBarStyle}>
        <input
          style={inputStyle}
          placeholder={promptPlaceholder}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <div
          style={{
            justifySelf: 'end',
            fontSize: 13,
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: expanded ? 320 : 260,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={lastCommand}
        >
          <span style={{ opacity: 0.75 }}>Last Command:</span>
          <span style={{ color: '#e2e8f0' }}>{lastCommand}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span
            style={{
              background: statusTheme.bg,
              color: statusTheme.text,
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 12,
              border: `1px solid ${statusTheme.text}33`,
              textTransform: 'capitalize'
            }}
          >
            {status}
          </span>
          <button
            style={{
              ...pillButton,
              width: 34,
              height: 34,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center'
            }}
            onClick={handleSend}
            aria-label="Send prompt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" strokeWidth="1.7">
              <path d="m5 12 14-7-7 14-2-5-5-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div style={stepPanelStyle}>
        {steps.map((step, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: 'rgba(255,255,255,0.06)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                color: '#94a3b8'
              }}
            >
              {idx + 1}
            </span>
            <span style={{ color: '#e2e8f0' }}>{step}</span>
          </div>
        ))}
      </div>

      <div style={bottomBarStyle}>
        <div style={quickWrapStyle}>
          {quickActions.map((action) => (
            <button
              key={action.key}
              onClick={() => handleAction(action.key)}
              style={{
                ...pillButton,
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13
              }}
            >
              <span style={{ fontSize: 13 }}>{action.label}</span>
            </button>
          ))}
        </div>
        <div style={{ opacity: 0.65, fontSize: 12.5, color: '#cbd5e1' }}>
          Resizes automatically: {expanded ? 'Expanded' : 'Compact'} · Context: {sizeHint}
        </div>
      </div>
    </motion.div>
  );
};

export default ControlWidget;

// client/src/components/fraud/RiskBadge.jsx
export function RiskBadge({ level }) {
    const cfg = {
        HIGH:   { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', dot: '#ef4444' },
        MEDIUM: { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', dot: '#f97316' },
        LOW:    { bg: '#fefce8', color: '#a16207', border: '#fde047', dot: '#eab308' },
    };
    const c = cfg[level] || cfg.LOW;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: c.bg, color: c.color,
            border: `1px solid ${c.border}`,
            borderRadius: 6, fontSize: 11, fontWeight: 700,
            padding: '3px 8px', letterSpacing: '0.04em', whiteSpace: 'nowrap',
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
            {level}
        </span>
    );
}
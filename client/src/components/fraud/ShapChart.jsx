// client/src/components/fraud/ShapChart.jsx
// Horizontal bar chart showing SHAP feature importance for a flagged profile.

export function ShapChart({ reasons = [] }) {
    if (!reasons.length) return (
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No SHAP data available.</p>
    );

    const maxVal = Math.max(...reasons.map(r => r.shap_value), 0.001);

    const barColor = v => {
        const i = v / maxVal;
        if (i > 0.66) return '#ef4444';
        if (i > 0.33) return '#f97316';
        return '#eab308';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reasons.map((r, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, flex: 1, paddingRight: 8 }}>
                            {r.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            +{r.shap_value.toFixed(3)}
                        </span>
                    </div>
                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(r.shap_value / maxVal) * 100}%`,
                            background: barColor(r.shap_value),
                            borderRadius: 3,
                            transition: 'width 0.5s ease',
                        }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        Actual value:{' '}
                        <span style={{ color: '#374151', fontWeight: 500 }}>
                            {typeof r.raw_value === 'number'
                                ? Number.isInteger(r.raw_value) ? r.raw_value : r.raw_value.toFixed(3)
                                : r.raw_value}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
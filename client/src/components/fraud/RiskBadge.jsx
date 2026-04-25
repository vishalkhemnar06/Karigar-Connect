// client/src/components/fraud/RiskBadge.jsx

export function RiskBadge({ level }) {
    const config = {
        HIGH:   { bg: 'bg-red-100', color: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'HIGH' },
        MEDIUM: { bg: 'bg-orange-100', color: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'MEDIUM' },
        LOW:    { bg: 'bg-yellow-100', color: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500', label: 'LOW' },
    };
    const c = config[level] || config.LOW;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.color} border ${c.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
}
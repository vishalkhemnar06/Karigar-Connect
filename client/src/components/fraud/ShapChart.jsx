// client/src/components/fraud/ShapChart.jsx
// Horizontal bar chart showing SHAP feature importance for a flagged profile.

import { motion } from 'framer-motion';

export function ShapChart({ reasons = [] }) {
    if (!reasons.length) return (
        <p className="text-sm text-gray-500 text-center py-4">No SHAP data available.</p>
    );

    const maxVal = Math.max(...reasons.map(r => Math.abs(r.shap_value)), 0.001);

    const getBarColor = (value) => {
        const ratio = Math.abs(value) / maxVal;
        if (ratio > 0.66) return 'bg-red-500';
        if (ratio > 0.33) return 'bg-orange-500';
        return 'bg-yellow-500';
    };

    return (
        <div className="space-y-3">
            {reasons.map((reason, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="space-y-1"
                >
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-700 flex-1">{reason.label}</span>
                        <span className={`text-xs font-bold ${
                            reason.shap_value > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                            {reason.shap_value > 0 ? '+' : ''}{reason.shap_value.toFixed(3)}
                        </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(Math.abs(reason.shap_value) / maxVal) * 100}%` }}
                            transition={{ duration: 0.5, delay: idx * 0.05 }}
                            className={`h-full rounded-full ${getBarColor(reason.shap_value)}`}
                        />
                    </div>
                    {reason.raw_value !== undefined && (
                        <p className="text-[10px] text-gray-400">
                            Actual value: <span className="font-semibold text-gray-600">
                                {typeof reason.raw_value === 'number'
                                    ? Number.isInteger(reason.raw_value) ? reason.raw_value : reason.raw_value.toFixed(3)
                                    : reason.raw_value}
                            </span>
                        </p>
                    )}
                </motion.div>
            ))}
        </div>
    );
}
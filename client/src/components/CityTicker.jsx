import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getGuestChatbotMeta } from '../api';

const fallbackCities = ['Pune', 'Mumbai', 'Nashik', 'Nagpur', 'Aurangabad', 'Kolhapur'];

export default function CityTicker() {
    const [cities, setCities] = useState(fallbackCities);
    const [duration, setDuration] = useState(14);
    const tickerTrackRef = useRef(null);

    useEffect(() => {
        let active = true;

        const loadCities = async () => {
            try {
                const { data } = await getGuestChatbotMeta();
                const list = Array.isArray(data?.cities)
                    ? data.cities.map((item) => String(item || '').trim()).filter(Boolean)
                    : [];
                if (active && list.length) {
                    setCities(list);
                }
            } catch {
                if (active) setCities(fallbackCities);
            }
        };

        loadCities();
        return () => {
            active = false;
        };
    }, []);

    const tickerItems = useMemo(() => {
        const list = cities.length ? cities : fallbackCities;
        return [...list, ...list];
    }, [cities]);

    useEffect(() => {
        const updateTickerDuration = () => {
            const trackWidth = tickerTrackRef.current?.scrollWidth || 0;
            if (!trackWidth) return;

            // Track includes two copies of the same list; animation travels half that width.
            const singleLoopWidth = trackWidth / 2;
            const pixelsPerSecond = 70;
            const computedDuration = singleLoopWidth / pixelsPerSecond;
            const clampedDuration = Math.max(8, Math.min(22, computedDuration));
            setDuration(Number(clampedDuration.toFixed(2)));
        };

        updateTickerDuration();
        window.addEventListener('resize', updateTickerDuration);
        return () => window.removeEventListener('resize', updateTickerDuration);
    }, [cities]);

    return (
        <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none">
            <div className="border-t border-white/20 bg-black/20 backdrop-blur-sm text-white/90">
                <div className="relative overflow-hidden py-2">
                    <div
                        ref={tickerTrackRef}
                        className="flex w-max animate-city-ticker gap-6 px-4"
                        style={{ animationDuration: `${duration}s` }}
                    >
                        {tickerItems.map((city, idx) => (
                            <div key={`${city}-${idx}`} className="inline-flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                                <MapPin size={12} className="text-orange-300" />
                                <span className="font-semibold tracking-wide">{city}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes city-ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-city-ticker {
                    animation: city-ticker linear infinite;
                }
            `}</style>
        </div>
    );
}

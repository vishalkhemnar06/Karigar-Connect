/**
 * Demand & Festival Detection Service
 * 
 * Handles:
 * 1. Day type detection (weekday, weekend, holiday, festival)
 * 2. Time period detection (morning, afternoon, evening, night)
 * 3. Festival detection using Groq AI and Indian calendar
 * 4. Demand multiplier calculation based on all factors
 */

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Indian public holidays (fixed dates) - year-independent for simplicity
const INDIAN_HOLIDAYS = [
    '01-26', // Republic Day
    '03-08', // Maha Shivaratri (approximate, varies)
    '03-25', // Holi (approximate, varies)
    '04-14', // Ambedkar Jayanti
    '04-17', // Ram Navami (approximate, varies)
    '04-21', // Mahavir Jayanti
    '05-01', // May Day
    '06-17', // Eid ul-Fitr (approximate, varies)
    '07-17', // Muharram (approximate, varies)
    '08-15', // Independence Day
    '08-26', // Janmashtami (approximate, varies)
    '09-16', // Milad-un-Nabi (approximate, varies)
    '10-02', // Gandhi Jayanti
    '10-12', // Dussehra (approximate, varies)
    '10-24', // Diwali (approximate, varies)
    '11-01', // Diwali (alternate date)
    '11-15', // Guru Nanak Jayanti
    '12-25', // Christmas
];

/**
 * Detect if a date is a weekend
 */
const isWeekend = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
};

/**
 * Detect if a date is a known Indian holiday
 */
const isIndianHoliday = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${month}-${day}`;
    return INDIAN_HOLIDAYS.includes(dateKey);
};

/**
 * Detect festival using Groq AI
 * Asks Groq to identify major Indian festivals for a given date
 */
const detectFestivalUsingGroq = async (date) => {
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        const dateStr = new Intl.DateTimeFormat('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(d);

        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are an Indian festival expert. Given a date, return the major festival or celebration happening on that date in India, or "none" if no major festival. Be very brief, return only the festival name or "none".'
                },
                {
                    role: 'user',
                    content: `What major Indian festival or celebration happens on ${dateStr}? Return only the festival name or "none".`
                }
            ],
            max_tokens: 50,
            temperature: 0.1,
        });

        const festival = response?.choices?.[0]?.message?.content || 'none';
        const trimmed = festival.trim().toLowerCase();
        return trimmed === 'none' || trimmed === '' ? '' : festival.trim();
    } catch (err) {
        console.error('detectFestivalUsingGroq error:', err.message);
        return '';
    }
};

/**
 * Get day type from a date
 * Returns: 'festival' | 'holiday' | 'weekend' | 'weekday'
 */
const getDayType = async (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;

    // Check festival first (most restrictive)
    const festival = await detectFestivalUsingGroq(d);
    if (festival) return 'festival';

    // Check holiday
    if (isIndianHoliday(d)) return 'holiday';

    // Check weekend
    if (isWeekend(d)) return 'weekend';

    return 'weekday';
};

/**
 * Detect time period from a time string (HH:MM format)
 * Returns: 'morning' | 'afternoon' | 'evening' | 'night'
 */
const getTimePeriod = (timeStr = '') => {
    if (!timeStr || typeof timeStr !== 'string') return 'morning';
    
    try {
        const [hours] = timeStr.split(':').map(Number);
        if (hours < 12) return 'morning';      // 6 AM - 12 PM
        if (hours < 17) return 'afternoon';    // 12 PM - 5 PM
        if (hours < 21) return 'evening';      // 5 PM - 9 PM
        return 'night';                        // 9 PM+
    } catch {
        return 'morning';
    }
};

/**
 * Detect season from a date
 * Returns: 'winter' | 'summer' | 'monsoon' | 'autumn'
 */
const getSeason = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = d.getMonth() + 1;
    
    if (month >= 12 || month <= 2) return 'winter';        // Dec, Jan, Feb
    if (month >= 3 && month <= 5) return 'summer';         // Mar, Apr, May
    if (month >= 6 && month <= 9) return 'monsoon';        // Jun, Jul, Aug, Sep
    return 'autumn';                                         // Oct, Nov
};

/**
 * Calculate demand-based pricing multipliers
 * 
 * Returns:
 * {
 *   weekendMultiplier: 1.0-1.10,
 *   holidayAndFestivalMultiplier: 1.0-1.25 (but 1.0 if multi-day),
 *   urgencyMultiplier: 1.0 or 1.3,
 *   finalMultiplier: (clamped to max 1.3),
 *   dayType: 'weekday'|'weekend'|'holiday'|'festival',
 *   timePeriod: 'morning'|'afternoon'|'evening'|'night',
 *   season: 'winter'|'summer'|'monsoon'|'autumn',
 * }
 */
const calculateDemandMultipliers = async (jobDate, jobStartTime, isUrgent = false, isMultiDay = false) => {
    try {
        const d = typeof jobDate === 'string' ? new Date(jobDate) : jobDate;
        const festivalName = await detectFestivalUsingGroq(d);
        const dayType = festivalName
            ? 'festival'
            : (isIndianHoliday(d) ? 'holiday' : (isWeekend(d) ? 'weekend' : 'weekday'));
        const timePeriod = getTimePeriod(jobStartTime);
        const season = getSeason(d);

        // Industry-Standard Pricing Multipliers (2025)
        // Weekend only: 1.05 – 1.10
        const weekendMultiplier = dayType === 'weekend' ? (Math.random() * 0.05 + 1.05) : 1.0;
        
        // Holiday/Festival multiplier: 1.10 – 1.20 (BUT 1.0 if multi-day project)
        // Rationale: Multi-day projects can't be completed on single holiday, so no holiday premium applies
        let holidayAndFestivalMultiplier = 1.0;
        if (!isMultiDay) {  // Only apply holiday surcharge for single-day projects
            if (dayType === 'festival') {
                holidayAndFestivalMultiplier = Math.random() * 0.1 + 1.10;  // 1.10 – 1.20
            } else if (dayType === 'holiday') {
                holidayAndFestivalMultiplier = Math.random() * 0.1 + 1.10;  // 1.10 – 1.20
            }
            
            // Both combined (weekend + holiday): 1.15 – 1.25
            if (isWeekend(d) && (dayType === 'festival' || dayType === 'holiday')) {
                holidayAndFestivalMultiplier = Math.random() * 0.1 + 1.15;  // 1.15 – 1.25
            }
        }

        // Time multiplier: no evening/night surcharge
        let timeMultiplier = 1.0;

        // Urgent/Emergency: fixed 1.3 (not variable)
        const urgencyMultiplier = isUrgent ? 1.3 : 1.0;

        // Combine all multipliers (cap at INDUSTRY STANDARD max 1.3 = 30% premium)
        let finalMultiplier = weekendMultiplier * timeMultiplier * holidayAndFestivalMultiplier * urgencyMultiplier;
        finalMultiplier = Math.min(finalMultiplier, 1.3);  // Max 1.3x (30% premium)

        return {
            weekendMultiplier: Math.round(weekendMultiplier * 100) / 100,
            timeMultiplier: Math.round(timeMultiplier * 100) / 100,
            holidayAndFestivalMultiplier: Math.round(holidayAndFestivalMultiplier * 100) / 100,
            urgencyMultiplier: Math.round(urgencyMultiplier * 100) / 100,
            finalMultiplier: Math.round(finalMultiplier * 100) / 100,
            festivalName,
            dayType,
            timePeriod,
            season,
        };
    } catch (err) {
        console.error('calculateDemandMultipliers error:', err.message);
        // Return safe defaults
        return {
            weekendMultiplier: 1.0,
            timeMultiplier: 1.0,
            holidayAndFestivalMultiplier: 1.0,
            urgencyMultiplier: 1.0,
            finalMultiplier: 1.0,
            festivalName: '',
            dayType: 'weekday',
            timePeriod: 'morning',
            season: 'summer',
        };
    }
};

/**
 * Calculate end time given start time and duration
 * Returns: HH:MM format string
 */
const calculateEndTime = (startTimeStr, durationHours) => {
    try {
        const hours = durationHours || 0;
        const [startHour, startMin] = startTimeStr.split(':').map(Number);
        if (isNaN(startHour) || isNaN(startMin)) return startTimeStr;

        let endHour = startHour + parseInt(hours);
        let endMin = startMin + ((hours % 1) * 60);

        if (endMin >= 60) {
            endHour += Math.floor(endMin / 60);
            endMin = endMin % 60;
        }

        // Clamp to 9 PM (21:00)
        if (endHour > 21) endHour = 21;
        if (endHour === 21 && endMin > 0) endMin = 0;

        return `${String(endHour).padStart(2, '0')}:${String(Math.floor(endMin)).padStart(2, '0')}`;
    } catch {
        return startTimeStr;
    }
};

module.exports = {
    isWeekend,
    isIndianHoliday,
    detectFestivalUsingGroq,
    getDayType,
    getTimePeriod,
    getSeason,
    calculateDemandMultipliers,
    calculateEndTime,
};

const WORKER_SKILLS = [
    'AC Technician',
    'Carpenter',
    'Computer / Laptop Repair',
    'Construction Labour / Demolition',
    'Deep Cleaning / Housekeeping',
    'Driver / Chauffeur',
    'Electrician',
    'False Ceiling Specialist',
    'Flooring Specialist',
    'Furniture Assembler / Carpenter',
    'Geyser / Water Heater Repair',
    'Handyman / General Helper',
    'Interior Designer (Basic)',
    'Landscaping / Gardener',
    'Mason / Bricklayer',
    'Mobile Phone Repair',
    'Other',
    'Packers & Movers',
    'Painter',
    'Pest Control',
    'Plumber',
    'RO / Water Purifier Service',
    'Roofer',
    'Security Guard',
    'Sofa / Upholstery Cleaning',
    'Tiler',
    'TV / Electronics Repair',
    'Washing Machine Repair',
    'Waterproofing Specialist',
    'Welder',
];

const MAX_WORKER_SKILLS = 4;

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const WORKER_SKILL_MAP = new Map(WORKER_SKILLS.map((name) => [normalizeText(name), name]));

const normalizeCustomWorkerSkill = (value) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';

    // Keep user-provided custom skills while preventing extremely long or malformed labels.
    if (cleaned.length < 2 || cleaned.length > 60) return '';
    return cleaned;
};

const normalizeWorkerSkillName = (value) => {
    const key = normalizeText(value);
    const mapped = WORKER_SKILL_MAP.get(key);
    if (mapped) return mapped;
    return normalizeCustomWorkerSkill(value);
};

const normalizeWorkerSkillSelections = (skills = [], preferredPrimary = '') => {
    const input = Array.isArray(skills) ? skills : [];
    const unique = [];
    const seen = new Set();

    for (const row of input) {
        const rawName = typeof row === 'string' ? row : row?.name;
        const normalizedName = normalizeWorkerSkillName(rawName);
        const key = normalizeText(normalizedName);
        if (!normalizedName || seen.has(key)) continue;
        seen.add(key);
        unique.push({
            name: normalizedName,
            isPrimary: !!(typeof row === 'object' && row?.isPrimary),
        });
    }

    const trimmed = unique.slice(0, MAX_WORKER_SKILLS);
    const preferredPrimaryName = normalizeWorkerSkillName(preferredPrimary);
    const preferredPrimaryKey = normalizeText(preferredPrimaryName);

    let primaryAssigned = false;
    const normalized = trimmed.map((entry) => {
        const key = normalizeText(entry.name);
        const isPrimary = preferredPrimaryKey
            ? key === preferredPrimaryKey
            : !!entry.isPrimary;

        if (isPrimary && !primaryAssigned) {
            primaryAssigned = true;
            return { name: entry.name, isPrimary: true };
        }

        return { name: entry.name, isPrimary: false };
    });

    if (!primaryAssigned && normalized.length > 0) {
        normalized[0].isPrimary = true;
    }

    return normalized;
};

module.exports = {
    WORKER_SKILLS,
    MAX_WORKER_SKILLS,
    normalizeWorkerSkillName,
    normalizeWorkerSkillSelections,
};

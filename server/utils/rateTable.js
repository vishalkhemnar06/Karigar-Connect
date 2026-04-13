/**
 * KarigarConnect — Master Rate Table v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Sources: Labour Bureau India (CEIC), Maharashtra Minimum Wages Gazette 2025,
 *          aapkapainter.com city data, contractor market surveys, Quora trade forums.
 *
 * RATES REPRESENT: Local / roadside / word-of-mouth workers (non-platform).
 * KarigarConnect target = midpoint between local and platform (e.g. Urban Company).
 *
 * All rates in INR.  Full day = 8 hours (standard).
 * Hourly = fullDay / 8  (derived — most workers quote per day or per job).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CITY → TIER MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tier definitions:
 *  metro          – Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata
 *  tier2_major    – Pune, Ahmedabad, Surat, Jaipur, Lucknow, Nagpur, Indore, Bhopal,
 *                   Chandigarh, Coimbatore, Vadodara, Patna, Bhubaneswar, Ludhiana
 *  tier2_high     – Chandigarh, Ludhiana, Kochi, Visakhapatnam  (above-avg wages)
 *  kerala         – Kochi only — separate tier, wages 50–70% above metro
 *  maha_mmr       – Thane, Navi Mumbai, Pimpri-Chinchwad, Panvel/Raigad  (MMR belt)
 *  maha_std       – Nashik, Aurangabad, Solapur, Kolhapur, Amravati(city),
 *                   Nanded, Sangli, Satara, Jalgaon, Ahmednagar  (Maharashtra standard)
 *  maha_small     – Amravati, Akola, Dhule, Latur, Nanded — smaller maha cities
 *  tier3          – Rajkot, Agra, Varanasi, Madurai, Vijayawada, Ranchi,
 *                   Guwahati, Mysuru, Jodhpur, Faridabad + remaining tier 3
 */

const CITY_TIER = {
    // ── Tier 1 Metros ─────────────────────────────────────────────────────────
    mumbai:               'metro',
    delhi:                'metro',
    'new delhi':          'metro',
    bangalore:            'metro',
    bengaluru:            'metro',
    hyderabad:            'metro',
    chennai:              'metro',
    kolkata:              'metro',

    // ── Kerala (own tier — highest wages nationally) ──────────────────────────
    kochi:                'kerala',
    cochin:               'kerala',
    ernakulam:            'kerala',
    thiruvananthapuram:   'kerala',
    trivandrum:           'kerala',
    kozhikode:            'kerala',
    thrissur:             'kerala',

    // ── Maharashtra MMR Belt (80–90% of Mumbai) ───────────────────────────────
    thane:                'maha_mmr',
    'navi mumbai':        'maha_mmr',
    navimumbai:           'maha_mmr',
    'pimpri-chinchwad':   'maha_mmr',
    pimpri:               'maha_mmr',
    chinchwad:            'maha_mmr',
    panvel:               'maha_mmr',
    raigad:               'maha_mmr',
    kalyan:               'maha_mmr',
    dombivli:             'maha_mmr',
    ulhasnagar:           'maha_mmr',
    vasai:                'maha_mmr',
    virar:                'maha_mmr',
    mira:                 'maha_mmr',
    bhiwandi:             'maha_mmr',

    // ── Tier 2 Major ──────────────────────────────────────────────────────────
    pune:                 'tier2_major',
    ahmedabad:            'tier2_major',
    surat:                'tier2_major',
    jaipur:               'tier2_major',
    lucknow:              'tier2_major',
    nagpur:               'tier2_major',
    indore:               'tier2_major',
    bhopal:               'tier2_major',
    coimbatore:           'tier2_major',
    visakhapatnam:        'tier2_major',
    vizag:                'tier2_major',
    vadodara:             'tier2_major',
    baroda:               'tier2_major',
    patna:                'tier2_major',
    bhubaneswar:          'tier2_major',

    // ── Punjab — slightly above Tier 2 average ────────────────────────────────
    chandigarh:           'tier2_high',
    ludhiana:             'tier2_high',
    amritsar:             'tier2_high',

    // ── Maharashtra Standard Cities ───────────────────────────────────────────
    nashik:               'maha_std',
    aurangabad:           'maha_std',
    'chhatrapati sambhajinagar': 'maha_std',
    sambhajinagar:        'maha_std',
    solapur:              'maha_std',
    kolhapur:             'maha_std',
    sangli:               'maha_std',
    satara:               'maha_std',
    jalgaon:              'maha_std',
    ahmednagar:           'maha_std',

    // ── Maharashtra Small Cities ──────────────────────────────────────────────
    amravati:             'maha_small',
    akola:                'maha_small',
    dhule:                'maha_small',
    latur:                'maha_small',
    nanded:               'maha_small',

    // ── Tier 3 ────────────────────────────────────────────────────────────────
    rajkot:               'tier3',
    agra:                 'tier3',
    varanasi:             'tier3',
    madurai:              'tier3',
    vijayawada:           'tier3',
    ranchi:               'tier3',
    guwahati:             'tier3',
    mysuru:               'tier3',
    mysore:               'tier3',
    jodhpur:              'tier3',
    faridabad:            'tier3',
    meerut:               'tier3',
    kanpur:               'tier3',
    allahabad:            'tier3',
    prayagraj:            'tier3',
    dehradun:             'tier3',
    raipur:               'tier3',
    jabalpur:             'tier3',
    gwalior:              'tier3',
    nashik:               'maha_std',
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — SKILL → RATE BANDS PER TIER
// ─────────────────────────────────────────────────────────────────────────────
// Each skill entry: { [tier]: { min, max } }  — full day (8h) rates in ₹
// Platform target = Math.round((min + max) / 2)
// Hourly = fullDay / 8

const SKILL_RATES = {

    // ── 1. PAINTER ────────────────────────────────────────────────────────────
    painter: {
        metro:       { min: 1100, max: 1400 },
        kerala:      { min: 1200, max: 1500 },
        maha_mmr:    { min:  900, max: 1150 },
        tier2_major: { min:  800, max: 1050 },
        tier2_high:  { min:  875, max: 1150 },
        maha_std:    { min:  650, max:  880 },
        maha_small:  { min:  550, max:  760 },
        tier3:       { min:  520, max:  720 },
    },

    // ── 2. PLUMBER ────────────────────────────────────────────────────────────
    plumber: {
        metro:       { min: 1400, max: 1800 },
        kerala:      { min: 1520, max: 1960 },
        maha_mmr:    { min: 1120, max: 1400 },
        tier2_major: { min: 1000, max: 1320 },
        tier2_high:  { min: 1160, max: 1480 },
        maha_std:    { min:  760, max: 1040 },
        maha_small:  { min:  640, max:  880 },
        tier3:       { min:  600, max:  840 },
    },

    // ── 3. ELECTRICIAN ────────────────────────────────────────────────────────
    electrician: {
        metro:       { min: 1400, max: 1840 },
        kerala:      { min: 1480, max: 1960 },
        maha_mmr:    { min: 1080, max: 1400 },
        tier2_major: { min: 1000, max: 1320 },
        tier2_high:  { min: 1160, max: 1480 },
        maha_std:    { min:  760, max: 1040 },
        maha_small:  { min:  640, max:  864 },
        tier3:       { min:  560, max:  800 },
    },

    // ── 4. CARPENTER ─────────────────────────────────────────────────────────
    carpenter: {
        metro:       { min: 1280, max: 1680 },
        kerala:      { min: 1400, max: 1840 },
        maha_mmr:    { min: 1040, max: 1360 },
        tier2_major: { min:  920, max: 1240 },
        tier2_high:  { min: 1120, max: 1440 },
        maha_std:    { min:  720, max:  960 },
        maha_small:  { min:  600, max:  800 },
        tier3:       { min:  520, max:  760 },
    },

    // ── 5. MASON / BRICKLAYER ─────────────────────────────────────────────────
    mason: {
        metro:       { min: 1240, max: 1600 },
        kerala:      { min: 1480, max: 1920 },  // CEIC: ₹1,013 rural → city higher
        maha_mmr:    { min: 1000, max: 1320 },
        tier2_major: { min:  920, max: 1200 },
        tier2_high:  { min: 1080, max: 1400 },
        maha_std:    { min:  680, max:  920 },
        maha_small:  { min:  576, max:  784 },  // CEIC Maharashtra rural: ₹647
        tier3:       { min:  480, max:  680 },
    },
    bricklayer: 'mason', // alias

    // ── 6. TILER ──────────────────────────────────────────────────────────────
    tiler: {
        metro:       { min: 1160, max: 1480 },
        kerala:      { min: 1400, max: 1760 },
        maha_mmr:    { min:  960, max: 1264 },
        tier2_major: { min:  840, max: 1120 },
        tier2_high:  { min:  960, max: 1240 },
        maha_std:    { min:  640, max:  880 },
        maha_small:  { min:  560, max:  760 },
        tier3:       { min:  520, max:  720 },
    },

    // ── 7. WELDER ─────────────────────────────────────────────────────────────
    welder: {
        metro:       { min: 1320, max: 1720 },
        kerala:      { min: 1440, max: 1880 },
        maha_mmr:    { min: 1080, max: 1400 },
        tier2_major: { min:  960, max: 1280 },
        tier2_high:  { min: 1080, max: 1400 },
        maha_std:    { min:  760, max: 1000 },
        maha_small:  { min:  640, max:  880 },
        tier3:       { min:  560, max:  800 },   // smaller welder pool
    },

    // ── 8. AC TECHNICIAN ─────────────────────────────────────────────────────
    ac_technician: {
        metro:       { min: 1600, max: 2200 },  // peak summer surcharge applicable
        kerala:      { min: 1400, max: 1880 },
        maha_mmr:    { min: 1400, max: 1880 },
        tier2_major: { min: 1240, max: 1680 },
        tier2_high:  { min: 1360, max: 1840 },
        maha_std:    { min: 1000, max: 1400 },
        maha_small:  { min:  880, max: 1240 },
        tier3:       { min:  800, max: 1120 },
    },
    'ac technician':         'ac_technician',
    'ac_tech':               'ac_technician',
    'air conditioning':      'ac_technician',

    // ── 9. DEEP CLEANING / HOUSEKEEPING ──────────────────────────────────────
    deep_cleaning: {
        metro:       { min:  960, max: 1240 },
        kerala:      { min:  960, max: 1280 },
        maha_mmr:    { min:  840, max: 1120 },
        tier2_major: { min:  720, max: 1000 },
        tier2_high:  { min:  800, max: 1040 },
        maha_std:    { min:  600, max:  840 },
        maha_small:  { min:  520, max:  720 },
        tier3:       { min:  480, max:  640 },
    },
    'deep cleaning':     'deep_cleaning',
    cleaning:            'deep_cleaning',
    housekeeping:        'deep_cleaning',

    // ── 10. PEST CONTROL ──────────────────────────────────────────────────────
    // Note: pest control is per-visit / per-job — converted to day-equivalent
    pest_control: {
        metro:       { min: 1200, max: 2000 },  // 1–2 BHK visits
        kerala:      { min: 1200, max: 2000 },
        maha_mmr:    { min: 1000, max: 1800 },
        tier2_major: { min:  900, max: 1600 },
        tier2_high:  { min: 1000, max: 1600 },
        maha_std:    { min:  800, max: 1400 },
        maha_small:  { min:  700, max: 1200 },
        tier3:       { min:  600, max: 1000 },
    },
    'pest control': 'pest_control',

    // ── 11. HANDYMAN / GENERAL HELPER ─────────────────────────────────────────
    handyman: {
        metro:       { min:  800, max: 1040 },
        kerala:      { min:  880, max: 1120 },
        maha_mmr:    { min:  720, max:  960 },
        tier2_major: { min:  640, max:  880 },
        tier2_high:  { min:  720, max:  960 },
        maha_std:    { min:  560, max:  760 },
        maha_small:  { min:  480, max:  680 },
        tier3:       { min:  440, max:  600 },
    },
    'general helper': 'handyman',
    general:          'handyman',

    // ── 12. WATERPROOFING SPECIALIST ──────────────────────────────────────────
    waterproofing: {
        metro:       { min: 1400, max: 1800 },
        kerala:      { min: 1440, max: 1840 },
        maha_mmr:    { min: 1240, max: 1600 },
        tier2_major: { min: 1080, max: 1400 },
        tier2_high:  { min: 1200, max: 1520 },
        maha_std:    { min:  880, max: 1200 },
        maha_small:  { min:  760, max: 1040 },
        tier3:       { min:  680, max:  960 },
    },
    'waterproofing specialist': 'waterproofing',

    // ── 13. FALSE CEILING SPECIALIST ──────────────────────────────────────────
    false_ceiling: {
        metro:       { min: 1280, max: 1680 },
        kerala:      { min: 1360, max: 1760 },
        maha_mmr:    { min: 1080, max: 1400 },
        tier2_major: { min:  960, max: 1280 },
        tier2_high:  { min: 1040, max: 1360 },
        maha_std:    { min:  800, max: 1080 },
        maha_small:  { min:  680, max:  920 },
        tier3:       { min:  640, max:  880 },
    },
    'false ceiling':           'false_ceiling',
    'false ceiling specialist':'false_ceiling',

    // ── 14. INTERIOR DESIGNER (basic consultation + execution) ────────────────
    interior_designer: {
        metro:       { min: 2000, max: 3200 },
        kerala:      { min: 1920, max: 3000 },
        maha_mmr:    { min: 1760, max: 2800 },
        tier2_major: { min: 1440, max: 2400 },
        tier2_high:  { min: 1600, max: 2560 },
        maha_std:    { min: 1200, max: 2000 },
        maha_small:  { min:  960, max: 1600 },
        tier3:       { min:  880, max: 1480 },
    },
    'interior designer': 'interior_designer',

    // ── 15. ROOFER ────────────────────────────────────────────────────────────
    roofer: {
        metro:       { min: 1200, max: 1600 },
        kerala:      { min: 1440, max: 1920 },
        maha_mmr:    { min: 1040, max: 1360 },
        tier2_major: { min:  920, max: 1240 },
        tier2_high:  { min: 1000, max: 1320 },
        maha_std:    { min:  720, max:  960 },
        maha_small:  { min:  600, max:  800 },
        tier3:       { min:  560, max:  760 },
    },

    // ── 16. FLOORING SPECIALIST ───────────────────────────────────────────────
    flooring: {
        metro:       { min: 1200, max: 1560 },
        kerala:      { min: 1360, max: 1760 },
        maha_mmr:    { min: 1000, max: 1320 },
        tier2_major: { min:  880, max: 1200 },
        tier2_high:  { min:  960, max: 1280 },
        maha_std:    { min:  720, max:  960 },
        maha_small:  { min:  600, max:  800 },
        tier3:       { min:  560, max:  760 },
    },
    'flooring specialist': 'flooring',

    // ── 17. FURNITURE ASSEMBLER ───────────────────────────────────────────────
    furniture_assembler: {
        metro:       { min:  960, max: 1280 },
        kerala:      { min: 1040, max: 1360 },
        maha_mmr:    { min:  840, max: 1120 },
        tier2_major: { min:  760, max: 1000 },
        tier2_high:  { min:  840, max: 1120 },
        maha_std:    { min:  640, max:  840 },
        maha_small:  { min:  560, max:  720 },
        tier3:       { min:  520, max:  680 },
    },
    'furniture assembler': 'furniture_assembler',
    'furniture assembly':  'furniture_assembler',

    // ── 18. GEYSER / WATER HEATER REPAIR (per visit equiv.) ──────────────────
    geyser_repair: {
        metro:       { min:  350, max:  600 },
        kerala:      { min:  400, max:  640 },
        maha_mmr:    { min:  320, max:  560 },
        tier2_major: { min:  280, max:  480 },
        tier2_high:  { min:  300, max:  520 },
        maha_std:    { min:  250, max:  420 },
        maha_small:  { min:  220, max:  380 },
        tier3:       { min:  200, max:  350 },
    },
    'geyser repair':       'geyser_repair',
    'water heater repair': 'geyser_repair',

    // ── 19. RO / WATER PURIFIER SERVICE ──────────────────────────────────────
    ro_service: {
        metro:       { min:  300, max:  500 },
        kerala:      { min:  320, max:  520 },
        maha_mmr:    { min:  280, max:  460 },
        tier2_major: { min:  240, max:  400 },
        tier2_high:  { min:  260, max:  440 },
        maha_std:    { min:  200, max:  360 },
        maha_small:  { min:  180, max:  320 },
        tier3:       { min:  180, max:  300 },
    },
    'ro service':          'ro_service',
    'water purifier':      'ro_service',

    // ── 20. WASHING MACHINE REPAIR ────────────────────────────────────────────
    washing_machine_repair: {
        metro:       { min:  400, max:  700 },
        kerala:      { min:  440, max:  720 },
        maha_mmr:    { min:  360, max:  640 },
        tier2_major: { min:  320, max:  560 },
        tier2_high:  { min:  340, max:  580 },
        maha_std:    { min:  280, max:  500 },
        maha_small:  { min:  240, max:  440 },
        tier3:       { min:  220, max:  400 },
    },
    'washing machine repair': 'washing_machine_repair',
    'washing machine':        'washing_machine_repair',

    // ── 21. TV / ELECTRONICS REPAIR ───────────────────────────────────────────
    tv_repair: {
        metro:       { min:  350, max:  600 },
        kerala:      { min:  370, max:  620 },
        maha_mmr:    { min:  320, max:  560 },
        tier2_major: { min:  280, max:  500 },
        tier2_high:  { min:  300, max:  520 },
        maha_std:    { min:  250, max:  450 },
        maha_small:  { min:  220, max:  400 },
        tier3:       { min:  200, max:  380 },
    },
    'tv repair':          'tv_repair',
    'electronics repair': 'tv_repair',

    // ── 22. MOBILE PHONE REPAIR ───────────────────────────────────────────────
    mobile_repair: {
        metro:       { min:  200, max:  500 },
        kerala:      { min:  220, max:  520 },
        maha_mmr:    { min:  180, max:  460 },
        tier2_major: { min:  150, max:  400 },
        tier2_high:  { min:  160, max:  420 },
        maha_std:    { min:  130, max:  360 },
        maha_small:  { min:  120, max:  320 },
        tier3:       { min:  100, max:  300 },
    },
    'mobile repair':      'mobile_repair',
    'mobile phone repair':'mobile_repair',

    // ── 23. COMPUTER / LAPTOP REPAIR ─────────────────────────────────────────
    computer_repair: {
        metro:       { min:  400, max:  800 },
        kerala:      { min:  420, max:  820 },
        maha_mmr:    { min:  360, max:  720 },
        tier2_major: { min:  300, max:  600 },
        tier2_high:  { min:  320, max:  640 },
        maha_std:    { min:  250, max:  500 },
        maha_small:  { min:  220, max:  440 },
        tier3:       { min:  200, max:  400 },
    },
    'computer repair': 'computer_repair',
    'laptop repair':   'computer_repair',

    // ── 24. SOFA / UPHOLSTERY CLEANING ────────────────────────────────────────
    sofa_cleaning: {
        metro:       { min:  800, max: 1200 },  // per sofa set
        kerala:      { min:  840, max: 1240 },
        maha_mmr:    { min:  700, max: 1060 },
        tier2_major: { min:  600, max:  960 },
        tier2_high:  { min:  660, max: 1000 },
        maha_std:    { min:  500, max:  800 },
        maha_small:  { min:  440, max:  700 },
        tier3:       { min:  400, max:  640 },
    },
    'sofa cleaning':       'sofa_cleaning',
    'upholstery cleaning': 'sofa_cleaning',

    // ── 25. LANDSCAPING / GARDENER ────────────────────────────────────────────
    landscaping: {
        metro:       { min:  800, max: 1100 },
        kerala:      { min:  960, max: 1280 },
        maha_mmr:    { min:  720, max:  960 },
        tier2_major: { min:  640, max:  880 },
        tier2_high:  { min:  720, max:  960 },
        maha_std:    { min:  560, max:  760 },
        maha_small:  { min:  480, max:  640 },
        tier3:       { min:  440, max:  600 },
    },
    gardening:    'landscaping',
    gardener:     'landscaping',

    // ── 26. SECURITY GUARD (per 12h shift — industry standard) ───────────────
    security_guard: {
        metro:       { min:  900, max: 1200 },
        kerala:      { min: 1000, max: 1320 },
        maha_mmr:    { min:  840, max: 1120 },
        tier2_major: { min:  720, max:  960 },
        tier2_high:  { min:  800, max: 1040 },
        maha_std:    { min:  640, max:  840 },
        maha_small:  { min:  560, max:  760 },
        tier3:       { min:  520, max:  720 },
    },
    'security guard': 'security_guard',
    security:         'security_guard',

    // ── 27. DRIVER / CHAUFFEUR (per 10h day) ─────────────────────────────────
    driver: {
        metro:       { min: 1000, max: 1400 },
        kerala:      { min: 1100, max: 1480 },
        maha_mmr:    { min:  900, max: 1200 },
        tier2_major: { min:  800, max: 1080 },
        tier2_high:  { min:  880, max: 1160 },
        maha_std:    { min:  700, max:  960 },
        maha_small:  { min:  620, max:  840 },
        tier3:       { min:  580, max:  800 },
    },
    chauffeur:         'driver',
    'driver/chauffeur':'driver',

    // ── 28. PACKERS & MOVERS (per worker per day — team usually 3–5 workers) ──
    packers_movers: {
        metro:       { min: 1000, max: 1400 },
        kerala:      { min: 1100, max: 1480 },
        maha_mmr:    { min:  880, max: 1200 },
        tier2_major: { min:  760, max: 1040 },
        tier2_high:  { min:  840, max: 1120 },
        maha_std:    { min:  640, max:  880 },
        maha_small:  { min:  560, max:  760 },
        tier3:       { min:  520, max:  720 },
    },
    'packers and movers': 'packers_movers',
    'packers & movers':   'packers_movers',
    packer:               'packers_movers',
    mover:                'packers_movers',

    // ── 29. CONSTRUCTION LABOUR / DEMOLITION ─────────────────────────────────
    construction_labour: {
        metro:       { min:  880, max: 1160 },
        kerala:      { min: 1400, max: 1760 },   // Kerala outlier — highest nationally
        maha_mmr:    { min:  800, max: 1040 },
        tier2_major: { min:  640, max:  840 },
        tier2_high:  { min:  720, max:  960 },
        maha_std:    { min:  600, max:  800 },   // Maharashtra rural: ₹647 floor
        maha_small:  { min:  544, max:  736 },
        tier3:       { min:  440, max:  600 },
    },
    'construction labour': 'construction_labour',
    'construction labor':  'construction_labour',
    'construction worker': 'construction_labour',
    demolition:            'construction_labour',
    labour:                'construction_labour',
    laborer:               'construction_labour',

    // ── 30. OTHER / GENERAL ───────────────────────────────────────────────────
    other: {
        metro:       { min:  800, max: 1100 },
        kerala:      { min:  900, max: 1200 },
        maha_mmr:    { min:  700, max:  960 },
        tier2_major: { min:  600, max:  840 },
        tier2_high:  { min:  680, max:  920 },
        maha_std:    { min:  540, max:  760 },
        maha_small:  { min:  480, max:  680 },
        tier3:       { min:  440, max:  620 },
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — COMPLEXITY MULTIPLIERS
// ─────────────────────────────────────────────────────────────────────────────
// Applied on top of base rates based on job complexity signals

const COMPLEXITY_MULTIPLIER = {
    light:  0.85,   // minor/routine work: fixing a tap, painting 1 room
    normal: 1.00,   // standard job
    heavy:  1.30,   // large area, structural work, multi-floor
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — URGENCY MULTIPLIER
// ─────────────────────────────────────────────────────────────────────────────
const URGENCY_MULTIPLIER = 1.25; // +25% for urgent jobs

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — SKILL NORMALISATION MAP
// ─────────────────────────────────────────────────────────────────────────────
// Maps free-text skill inputs → canonical skill key

const SKILL_ALIASES = {
    // Painting
    'painter':                   'painter',
    'painting':                  'painter',
    'wall painter':              'painter',
    'texture painting':          'painter',
    'wallpaper':                 'painter',

    // Plumbing
    'plumber':                   'plumber',
    'plumbing':                  'plumber',
    'pipe fitting':              'plumber',
    'plumber/pipe fitter':       'plumber',

    // Electrical
    'electrician':               'electrician',
    'electrical':                'electrician',
    'wiring':                    'electrician',
    'electrical work':           'electrician',

    // Carpentry
    'carpenter':                 'carpenter',
    'carpentry':                 'carpenter',
    'wood work':                 'carpenter',
    'woodwork':                  'carpenter',
    'joinery':                   'carpenter',

    // Masonry
    'mason':                     'mason',
    'masonry':                   'mason',
    'bricklayer':                'mason',
    'bricklaying':               'mason',
    'brick work':                'mason',

    // Tiling
    'tiler':                     'tiler',
    'tiling':                    'tiler',
    'tile work':                 'tiler',
    'tile laying':               'tiler',
    'tiles':                     'tiler',

    // Welding
    'welder':                    'welder',
    'welding':                   'welder',
    'fabricator':                'welder',
    'steel fabrication':         'welder',

    // AC
    'ac technician':             'ac_technician',
    'ac tech':                   'ac_technician',
    'ac':                        'ac_technician',
    'air conditioning':          'ac_technician',
    'hvac':                      'ac_technician',
    'ac repair':                 'ac_technician',
    'ac service':                'ac_technician',

    // Cleaning
    'cleaner':                   'deep_cleaning',
    'cleaning':                  'deep_cleaning',
    'deep cleaning':             'deep_cleaning',
    'housekeeping':              'deep_cleaning',
    'maid':                      'deep_cleaning',
    'housekeeper':               'deep_cleaning',

    // Pest control
    'pest control':              'pest_control',
    'pest':                      'pest_control',
    'termite':                   'pest_control',
    'fumigation':                'pest_control',

    // Handyman
    'handyman':                  'handyman',
    'general helper':            'handyman',
    'helper':                    'handyman',
    'general':                   'handyman',
    'maintenance':               'handyman',

    // Waterproofing
    'waterproofing':             'waterproofing',
    'waterproofing specialist':  'waterproofing',
    'water proofing':            'waterproofing',

    // False ceiling
    'false ceiling':             'false_ceiling',
    'false ceiling specialist':  'false_ceiling',
    'gypsum ceiling':            'false_ceiling',
    'pop ceiling':               'false_ceiling',

    // Interior Design
    'interior designer':         'interior_designer',
    'interior design':           'interior_designer',
    'interior':                  'interior_designer',

    // Roofer
    'roofer':                    'roofer',
    'roofing':                   'roofer',
    'roof repair':               'roofer',

    // Flooring
    'flooring':                  'flooring',
    'flooring specialist':       'flooring',
    'floor work':                'flooring',
    'wood flooring':             'flooring',
    'vinyl flooring':            'flooring',

    // Furniture
    'furniture assembler':       'furniture_assembler',
    'furniture assembly':        'furniture_assembler',
    'furniture':                 'furniture_assembler',
    'ikea assembly':             'furniture_assembler',

    // Appliance repairs
    'geyser repair':             'geyser_repair',
    'geyser':                    'geyser_repair',
    'water heater':              'geyser_repair',
    'water heater repair':       'geyser_repair',
    'geyser/water heater repair':'geyser_repair',

    'ro service':                'ro_service',
    'ro':                        'ro_service',
    'water purifier':            'ro_service',
    'water purifier service':    'ro_service',
    'ro/water purifier service': 'ro_service',

    'washing machine repair':    'washing_machine_repair',
    'washing machine':           'washing_machine_repair',
    'washing machine service':   'washing_machine_repair',

    'tv repair':                 'tv_repair',
    'tv':                        'tv_repair',
    'electronics repair':        'tv_repair',
    'tv/electronics repair':     'tv_repair',
    'television':                'tv_repair',

    'mobile repair':             'mobile_repair',
    'mobile':                    'mobile_repair',
    'phone repair':              'mobile_repair',
    'mobile phone repair':       'mobile_repair',

    'computer repair':           'computer_repair',
    'laptop repair':             'computer_repair',
    'computer':                  'computer_repair',
    'computer/laptop repair':    'computer_repair',

    // Sofa cleaning
    'sofa cleaning':             'sofa_cleaning',
    'sofa/upholstery cleaning':  'sofa_cleaning',
    'upholstery':                'sofa_cleaning',
    'sofa':                      'sofa_cleaning',

    // Landscaping
    'landscaping':               'landscaping',
    'garden':                    'landscaping',
    'gardener':                  'landscaping',
    'gardening':                 'landscaping',
    'landscaping/garden':        'landscaping',

    // Security
    'security guard':            'security_guard',
    'security':                  'security_guard',
    'guard':                     'security_guard',

    // Driver
    'driver':                    'driver',
    'chauffeur':                 'driver',
    'driver/chauffeur':          'driver',
    'delivery driver':           'driver',

    // Packers
    'packers and movers':        'packers_movers',
    'packers & movers':          'packers_movers',
    'packer':                    'packers_movers',
    'mover':                     'packers_movers',
    'moving':                    'packers_movers',

    // Construction
    'construction labour':       'construction_labour',
    'construction labor':        'construction_labour',
    'construction worker':       'construction_labour',
    'construction':              'construction_labour',
    'labour':                    'construction_labour',
    'laborer':                   'construction_labour',
    'demolition':                'construction_labour',
    'debris removal':            'construction_labour',
    'excavation':                'construction_labour',

    // Other
    'other':                     'other',
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a city string to a tier key.
 * @param {string} city
 * @returns {string} tier key (defaults to 'tier3' if unknown)
 */
function getCityTier(city) {
    if (!city) return 'tier3';
    const key = city.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z\s\-/]/g, '');
    return CITY_TIER[key] || 'tier3';
}

/**
 * Normalise a skill string to a canonical skill key.
 * @param {string} skill
 * @returns {string} canonical skill key (defaults to 'other')
 */
function normaliseSkill(skill) {
    if (!skill) return 'other';
    const key = skill.toLowerCase().trim().replace(/\s+/g, ' ');
    return SKILL_ALIASES[key] || key.replace(/\s+/g, '_') || 'other';
}

/**
 * Resolve skill aliases (e.g. 'bricklayer' → use 'mason' rates).
 * @param {string} skillKey
 * @returns {string}
 */
function resolveSkillKey(skillKey) {
    const entry = SKILL_RATES[skillKey];
    if (typeof entry === 'string') return entry;  // alias pointing to canonical
    if (entry) return skillKey;
    // try with spaces replaced by underscores
    const withUnderscore = skillKey.replace(/\s+/g, '_');
    const entry2 = SKILL_RATES[withUnderscore];
    if (typeof entry2 === 'string') return entry2;
    if (entry2) return withUnderscore;
    return 'other';
}

/**
 * Get rate band { min, max } for a skill + city.
 * @param {string} skill  - canonical or alias
 * @param {string} city   - city name
 * @returns {{ min: number, max: number, tier: string, skillKey: string }}
 */
function getRateBand(skill, city) {
    const tier       = getCityTier(city);
    const normSkill  = normaliseSkill(skill);
    const skillKey   = resolveSkillKey(normSkill);
    const skillRates = SKILL_RATES[skillKey] || SKILL_RATES.other;
    const band       = skillRates[tier] || skillRates.tier3 || { min: 500, max: 800 };
    return { min: band.min, max: band.max, tier, skillKey };
}

/**
 * Calculate the midpoint (target) rate for a skill + city.
 * This is KarigarConnect's suggested rate — between local and platform pricing.
 * @param {string} skill
 * @param {string} city
 * @returns {number} midpoint rate per full day (₹)
 */
function getMidpointRate(skill, city) {
    const { min, max } = getRateBand(skill, city);
    return Math.round((min + max) / 2);
}

/**
 * Detect complexity from job description and answers.
 * @param {string} description
 * @param {object} answers  - { [question]: answer }
 * @returns {'light'|'normal'|'heavy'}
 */
function detectComplexity(description = '', answers = {}) {
    const text = [description, ...Object.values(answers)].join(' ').toLowerCase();

    const heavySignals = [
        'full house', 'entire building', 'complete renovation', 'all rooms',
        'multi floor', 'multiple floor', '3 bhk', '4 bhk', '5 bhk', 'villa',
        'bungalow', 'office', 'commercial', 'factory', 'warehouse', 'structural',
        'foundation', 'rewiring', 'complete', 'whole house', 'entire flat',
        '1000 sq', '1500 sq', '2000 sq',
    ];
    const lightSignals = [
        'single room', '1 room', 'one room', 'small', 'minor', 'quick fix',
        'just one', 'touch up', 'minor repair', 'small leak', 'single tap',
        'one door', 'one window', 'small area',
    ];

    const heavyMatches = heavySignals.filter(s => text.includes(s)).length;
    const lightMatches = lightSignals.filter(s => text.includes(s)).length;

    if (heavyMatches >= 2 || (heavyMatches >= 1 && text.length > 300)) return 'heavy';
    if (lightMatches >= 1 && heavyMatches === 0) return 'light';
    return 'normal';
}

/**
 * Estimate hours for a skill + complexity combination.
 * @param {string} skillKey
 * @param {'light'|'normal'|'heavy'} complexity
 * @returns {number} estimated hours
 */
function estimateHours(skillKey, complexity) {
    // Base hours per skill per complexity level
    const HOURS = {
        painter:              { light: 4,  normal: 8,  heavy: 16 },
        plumber:              { light: 2,  normal: 6,  heavy: 10 },
        electrician:          { light: 2,  normal: 6,  heavy: 12 },
        carpenter:            { light: 3,  normal: 8,  heavy: 14 },
        mason:                { light: 4,  normal: 8,  heavy: 16 },
        tiler:                { light: 4,  normal: 8,  heavy: 16 },
        welder:               { light: 3,  normal: 6,  heavy: 10 },
        ac_technician:        { light: 1,  normal: 3,  heavy: 6  },
        deep_cleaning:        { light: 2,  normal: 6,  heavy: 10 },
        pest_control:         { light: 2,  normal: 4,  heavy: 6  },
        handyman:             { light: 2,  normal: 5,  heavy: 8  },
        waterproofing:        { light: 3,  normal: 8,  heavy: 14 },
        false_ceiling:        { light: 4,  normal: 8,  heavy: 16 },
        interior_designer:    { light: 4,  normal: 8,  heavy: 16 },
        roofer:               { light: 4,  normal: 8,  heavy: 14 },
        flooring:             { light: 4,  normal: 8,  heavy: 16 },
        furniture_assembler:  { light: 1,  normal: 4,  heavy: 8  },
        geyser_repair:        { light: 1,  normal: 2,  heavy: 4  },
        ro_service:           { light: 1,  normal: 2,  heavy: 3  },
        washing_machine_repair:{ light: 1, normal: 2,  heavy: 4  },
        tv_repair:            { light: 1,  normal: 2,  heavy: 4  },
        mobile_repair:        { light: 1,  normal: 1,  heavy: 2  },
        computer_repair:      { light: 1,  normal: 2,  heavy: 4  },
        sofa_cleaning:        { light: 1,  normal: 3,  heavy: 5  },
        landscaping:          { light: 3,  normal: 8,  heavy: 14 },
        security_guard:       { light: 8,  normal: 12, heavy: 24 },
        driver:               { light: 4,  normal: 10, heavy: 10 },
        packers_movers:       { light: 4,  normal: 8,  heavy: 12 },
        construction_labour:  { light: 4,  normal: 8,  heavy: 16 },
        other:                { light: 3,  normal: 6,  heavy: 10 },
    };
    const h = HOURS[skillKey] || HOURS.other;
    return h[complexity] || h.normal;
}

/**
 * Main function — calculate structured budget for a job.
 *
 * @param {object} params
 * @param {string[]} params.skills         - array of skill strings
 * @param {string}   params.city           - city name
 * @param {boolean}  [params.urgent]       - urgency flag
 * @param {string}   [params.description]  - job description (for complexity detection)
 * @param {object}   [params.answers]      - Q&A answers map
 * @param {number[]} [params.workerCounts] - workers per skill (parallel to skills array)
 * @param {string[]} [params.complexities] - per-skill complexity override
 *
 * @returns {object} structured budget result
 */
function calculateStructuredBudget({
    skills = [],
    city = '',
    urgent = false,
    description = '',
    answers = {},
    workerCounts = [],
    complexities = [],
}) {
    if (!skills.length) return null;

    const globalComplexity = detectComplexity(description, answers);
    const urgencyMult      = urgent ? URGENCY_MULTIPLIER : 1;
    const breakdown        = [];
    let   subtotal         = 0;

    skills.forEach((rawSkill, idx) => {
        const skillKey    = resolveSkillKey(normaliseSkill(rawSkill));
        const complexity  = complexities[idx] || globalComplexity;
        const count       = Math.max(1, Math.round(workerCounts[idx] || 1));
        const hours       = estimateHours(skillKey, complexity);
        const days        = hours / 8;                               // fractional days
        const { min, max, tier } = getRateBand(rawSkill, city);
        const ratePerDay  = Math.round((min + max) / 2);             // midpoint
        const ratePerHour = Math.round(ratePerDay / 8);

        // Cost for ONE worker
        const perWorkerCost = hours <= 8
            ? Math.round(ratePerDay * (hours / 8))
            : Math.round(ratePerDay * Math.ceil(days));

        const skillSubtotal = perWorkerCost * count;
        subtotal           += skillSubtotal;

        breakdown.push({
            skill:       skillKey,
            displaySkill: rawSkill,
            tier,
            complexity,
            count,
            hours,
            ratePerDay,
            ratePerHour,
            perWorkerCost,
            subtotal: skillSubtotal,
            rateRange: { min, max },
        });
    });

    const totalEstimated = Math.round(subtotal * urgencyMult);
    const totalWorkers   = breakdown.reduce((s, b) => s + b.count, 0);
    const durationDays   = Math.max(1, Math.ceil(
        Math.max(...breakdown.map(b => b.hours)) / 8
    ));

    return {
        breakdown,
        subtotal,
        urgent,
        urgencyMult,
        totalEstimated,
        totalWorkers,
        durationDays,
        city,
        cityTier: getCityTier(city),
        globalComplexity,
        calculatedAt: new Date().toISOString(),
    };
}

/**
 * Quick single-skill rate lookup.
 * Returns { ratePerHour, ratePerDay, min, max, tier, skillKey }
 */
function getRate(skill, city) {
    const { min, max, tier, skillKey } = getRateBand(skill, city);
    const ratePerDay  = Math.round((min + max) / 2);
    const ratePerHour = Math.round(ratePerDay / 8);
    return { ratePerHour, ratePerDay, min, max, tier, skillKey };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    CITY_TIER,
    SKILL_RATES,
    COMPLEXITY_MULTIPLIER,
    URGENCY_MULTIPLIER,
    SKILL_ALIASES,
    getCityTier,
    normaliseSkill,
    resolveSkillKey,
    getRateBand,
    getMidpointRate,
    detectComplexity,
    estimateHours,
    calculateStructuredBudget,
    getRate,
};

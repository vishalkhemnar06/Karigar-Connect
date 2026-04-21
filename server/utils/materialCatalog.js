/**
 * server/utils/materialCatalog.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Indian market prices (2025) + coverage/quantity formulas for every
 * skill. Used by estimateMaterialOrEquipmentItem() in aiAssistantController.
 *
 * SOURCES:
 *   - Asian Paints / Berger / Birla White official price lists 2025
 *   - 99acres.com / aapkapainter.com / houseyog.com paint cost guides
 *   - civilsir.com coverage formulas (confirmed by Civil Engineering standards)
 *   - IndiaMART bulk prices for plumbing, electrical fittings
 *
 * HOW IT WORKS:
 *   calcQtyAndCost(itemKey, areaSqft, options) → { qty, unit, cost, note }
 *
 * PRICE TIERS (applied to base price):
 *   economy  × 0.75  (Tractor Emulsion, JK Putty, etc.)
 *   standard × 1.00  (Apcolite, Bison, Berger Easy Clean)
 *   premium  × 1.45  (Royale, Silk Glamour, Dulux Velvet)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Tier multipliers ─────────────────────────────────────────────────────────
const TIER_MULT = { economy: 0.75, standard: 1.0, premium: 1.45 };

// ── City cost multipliers (materials are ~10–20% higher in metros) ───────────
const CITY_MULT = {
    mumbai:        1.15,
    delhi:         1.12,
    bangalore:     1.10,
    hyderabad:     1.08,
    chennai:       1.08,
    kolkata:       1.05,
    pune:          1.08,
    thane:         1.10,
    navi_mumbai:   1.10,
    pimpri_chinchwad: 1.08,
    panvel:        1.08,
    nagpur:        1.00,
    nashik:        0.98,
    aurangabad:    0.97,
    solapur:       0.96,
    kolhapur:      0.96,
    amravati:      0.94,
    akola:         0.94,
    latur:         0.93,
    nanded:        0.93,
    dhule:         0.93,
    chandigarh:    1.05,
    ludhiana:      1.03,
    kochi:         1.12,
    ahmedabad:     1.02,
    surat:         1.02,
    jaipur:        0.98,
    lucknow:       0.95,
    indore:        0.95,
    bhopal:        0.94,
    patna:         0.93,
    default:       1.00,
};

const getCityMult = (cityKey = '') => {
    const k = String(cityKey).toLowerCase().replace(/\s+/g, '_');
    return CITY_MULT[k] || CITY_MULT.default;
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE CATALOG
// Each item has:
//   unitPrice     – ₹ per base unit (standard tier, national avg)
//   packSize      – size of smallest standard pack
//   packUnit      – 'litre' | 'kg' | 'piece' | 'roll' | 'sheet' | 'set'
//   coverageSqftPerUnit – how much area one unit covers (where applicable)
//   description   – human label
// ─────────────────────────────────────────────────────────────────────────────
const CATALOG = {

    // ── PAINTING ──────────────────────────────────────────────────────────────

    interior_emulsion_paint: {
        // Standard = Berger Bison / Apcolite (~₹200/L)
        // 20L bucket = ₹4,000 standard  |  economy ₹3,000  |  premium ₹5,800
        unitPrice:           200,        // ₹ per litre
        packSize:            20,
        packUnit:            'litre',
        packPrice:           4000,       // standard 20L bucket price
        coverageSqftPerLitre: 130,       // sqft per litre per coat (interior emulsion)
        description:         'Interior Emulsion Paint',
        brand:               { economy: 'Asian Paints Tractor Emulsion', standard: 'Berger Bison / Apcolite', premium: 'Asian Paints Royale' },
    },

    exterior_emulsion_paint: {
        unitPrice:           250,
        packSize:            20,
        packUnit:            'litre',
        packPrice:           5000,
        coverageSqftPerLitre: 110,
        description:         'Exterior Emulsion Paint',
        brand:               { economy: 'Berger Walmasta', standard: 'Berger WeatherCoat', premium: 'Asian Paints Apex Ultima' },
    },

    wall_putty: {
        // Standard = Birla White WallCare 40kg = ₹1,200
        // Coverage: 12–15 sqft/kg for 2 coats → use 13 sqft/kg
        unitPrice:           30,         // ₹ per kg
        packSize:            40,
        packUnit:            'kg',
        packPrice:           1200,       // standard 40kg bag price
        coverageSqftPerKg:   13,         // for 2-coat application
        description:         'Wall Putty (40kg)',
        brand:               { economy: 'JK Putty / Berger Bison Putty', standard: 'Birla White WallCare', premium: 'Birla White Excel / Asian Paints TruCare' },
    },

    primer: {
        // Standard = Berger Primer ~ ₹160/litre
        // Coverage: 130 sqft per litre per coat
        unitPrice:           160,
        packSize:            20,
        packUnit:            'litre',
        packPrice:           3200,
        coverageSqftPerLitre: 130,
        description:         'Wall Primer (20L)',
        brand:               { economy: 'Berger Primer/Sealer', standard: 'Asian Paints Interior Primer', premium: 'Berger Easy Clean Primer' },
    },

    paint_roller_set: {
        unitPrice:           450,        // 9-inch roller + tray set
        packSize:            1,
        packUnit:            'set',
        coverageSqftPerUnit: null,
        description:         '9-inch Paint Roller Set (3 rollers + tray)',
        optional:            true,
    },

    paint_brushes: {
        unitPrice:           280,
        packSize:            1,
        packUnit:            'set',
        coverageSqftPerUnit: null,
        description:         'Paint Brushes — set of 3 (1", 2", 3")',
        optional:            true,
    },

    drop_cloth: {
        unitPrice:           150,
        packSize:            1,
        packUnit:            'piece',
        description:         'Drop Cloth / Plastic Sheet Protection',
        optional:            true,
    },

    sandpaper_set: {
        unitPrice:           120,
        packSize:            1,
        packUnit:            'set',
        description:         'Sandpaper Set (60/80/120 grit)',
        optional:            true,
    },

    masking_tape: {
        unitPrice:           65,         // per roll (48mm × 25m)
        packSize:            1,
        packUnit:            'roll',
        description:         'Masking Tape',
        optional:            true,
    },

    // ── PLUMBING ──────────────────────────────────────────────────────────────

    cpvc_pipe_10ft: {
        unitPrice:           280,        // ₹ per 10ft pipe (¾ inch CPVC)
        packSize:            1,
        packUnit:            'piece',
        description:         'CPVC Pipe 10ft (¾ inch)',
    },

    pvc_elbow: {
        unitPrice:           25,
        packSize:            1,
        packUnit:            'piece',
        description:         'PVC/CPVC Elbow Fitting',
    },

    tap_basin: {
        unitPrice:           350,        // basic CP tap
        packSize:            1,
        packUnit:            'piece',
        description:         'Basin Tap (CP)',
        brand:               { economy: 'Local', standard: 'Jaquar/Cera', premium: 'Kohler/Grohe' },
    },

    ptfe_tape_teflon: {
        unitPrice:           30,
        packSize:            1,
        packUnit:            'roll',
        description:         'PTFE / Teflon Tape',
        optional:            true,
    },

    pipe_sealant: {
        unitPrice:           80,
        packSize:            1,
        packUnit:            'piece',
        description:         'Pipe Thread Sealant',
        optional:            true,
    },

    drain_cleaner: {
        unitPrice:           120,
        packSize:            1,
        packUnit:            'piece',
        description:         'Chemical Drain Cleaner (500ml)',
        optional:            true,
    },

    // ── ELECTRICAL ────────────────────────────────────────────────────────────

    electrical_wire_10m: {
        unitPrice:           180,        // 1.5 sqmm wire 10m
        packSize:            1,
        packUnit:            'roll',
        description:         'Electrical Wire 10m (1.5 sqmm)',
    },

    mcb_switch_box: {
        unitPrice:           450,
        packSize:            1,
        packUnit:            'piece',
        description:         'MCB / Switch Box (6A)',
    },

    socket_plate: {
        unitPrice:           180,
        packSize:            1,
        packUnit:            'piece',
        description:         'Modular Socket + Switch Plate (Havells/Legrand)',
    },

    electrical_conduit_10ft: {
        unitPrice:           120,
        packSize:            1,
        packUnit:            'piece',
        description:         'Electrical PVC Conduit 10ft',
    },

    junction_box: {
        unitPrice:           40,
        packSize:            1,
        packUnit:            'piece',
        description:         'Junction Box',
    },

    // ── TILING ────────────────────────────────────────────────────────────────

    ceramic_tile_sqft: {
        unitPrice:           45,         // ₹ per sqft (standard ceramic)
        packSize:            1,
        packUnit:            'sqft',
        description:         'Ceramic Tile (standard)',
        brand:               { economy: 'Local/Orient', standard: 'Kajaria/Somany', premium: 'Johnson/RAK' },
    },

    tile_adhesive_20kg: {
        unitPrice:           450,        // covers ~50 sqft
        packSize:            1,
        packUnit:            'bag',
        coverageSqftPerBag:  50,
        description:         'Tile Adhesive 20kg (Dr. Fixit / Pidilite)',
    },

    tile_grout_2kg: {
        unitPrice:           180,
        packSize:            1,
        packUnit:            'packet',
        description:         'Tile Grout 2kg',
    },

    tile_spacers: {
        unitPrice:           80,
        packSize:            1,
        packUnit:            'packet',
        description:         'Tile Spacers (bag of 100)',
        optional:            true,
    },

    // ── CARPENTRY / FURNITURE ─────────────────────────────────────────────────

    wood_screw_set: {
        unitPrice:           120,
        packSize:            1,
        packUnit:            'set',
        description:         'Wood Screw Assorted Set',
        optional:            true,
    },

    sandpaper_wood: {
        unitPrice:           80,
        packSize:            1,
        packUnit:            'set',
        description:         'Wood Sandpaper Set (80/120/220 grit)',
        optional:            true,
    },

    wood_polish_1L: {
        unitPrice:           350,
        packSize:            1,
        packUnit:            'litre',
        coverageSqftPerLitre: 60,
        description:         'Wood Polish / Varnish (1L)',
    },

    fevicol_1kg: {
        unitPrice:           280,
        packSize:            1,
        packUnit:            'kg',
        description:         'Fevicol SH Wood Adhesive 1kg',
        optional:            true,
    },

    // ── MASONRY / CIVIL ───────────────────────────────────────────────────────

    cement_bag_50kg: {
        unitPrice:           400,        // OPC/PPC cement 50kg
        packSize:            1,
        packUnit:            'bag',
        description:         'Cement Bag 50kg (OPC/PPC)',
    },

    river_sand_cft: {
        unitPrice:           50,         // ₹ per cubic foot
        packSize:            1,
        packUnit:            'cft',
        description:         'River Sand (per cft)',
    },

    brick_piece: {
        unitPrice:           8,
        packSize:            1,
        packUnit:            'piece',
        description:         'Red Brick (standard)',
    },

    drfixit_waterproof_1L: {
        unitPrice:           350,
        packSize:            1,
        packUnit:            'litre',
        description:         'Dr. Fixit Waterproofing Compound 1L',
    },

    // ── WATERPROOFING ─────────────────────────────────────────────────────────

    drfixit_5L: {
        unitPrice:           1500,       // Dr. Fixit Dampguard 5L
        packSize:            1,
        packUnit:            'can',
        coverageSqftPerCan:  250,
        description:         'Dr. Fixit Dampguard / Waterproof Coat 5L',
    },

    waterproof_membrane_sqft: {
        unitPrice:           80,
        packSize:            1,
        packUnit:            'sqft',
        description:         'Waterproof Membrane (applied area)',
    },

    // ── FALSE CEILING ─────────────────────────────────────────────────────────

    gypsum_board_sqft: {
        unitPrice:           55,         // ₹ per sqft installed
        packSize:            1,
        packUnit:            'sqft',
        description:         'Gypsum Board (sqft, supplied)',
    },

    gypsum_screw_box: {
        unitPrice:           180,
        packSize:            1,
        packUnit:            'box',
        description:         'Gypsum Drywall Screws (box of 200)',
        optional:            true,
    },

    pop_powder_50kg: {
        unitPrice:           300,        // Plaster of Paris 50kg
        packSize:            1,
        packUnit:            'bag',
        description:         'POP (Plaster of Paris) 50kg',
    },

    // ── AC SERVICE ────────────────────────────────────────────────────────────

    ac_refrigerant_r32: {
        unitPrice:           1200,       // per 1kg cylinder
        packSize:            1,
        packUnit:            'kg',
        description:         'AC Refrigerant Gas R32/R410A (per kg)',
    },

    ac_drain_pipe_1m: {
        unitPrice:           60,
        packSize:            1,
        packUnit:            'metre',
        description:         'AC Drain Pipe (per metre)',
        optional:            true,
    },

    // ── CLEANING ──────────────────────────────────────────────────────────────

    floor_cleaner_5L: {
        unitPrice:           350,
        packSize:            1,
        packUnit:            'can',
        description:         'Heavy Duty Floor Cleaner 5L (Taski/Diversey)',
    },

    cleaning_mop_set: {
        unitPrice:           400,
        packSize:            1,
        packUnit:            'set',
        description:         'Cleaning Mop + Scrubber Set',
        optional:            true,
    },

    // ── PEST CONTROL ──────────────────────────────────────────────────────────

    pest_chemical_1L: {
        unitPrice:           600,        // commercial-grade chemical
        packSize:            1,
        packUnit:            'litre',
        description:         'Pest Control Chemical 1L (commercial grade)',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// QUANTITY CALCULATORS
// Each skill returns array of items with qty derived from area/context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all numeric area mentions from free text.
 * Returns the LARGEST area mentioned (in sqft).
 * Handles "1200 sqft", "400 sq ft", "500 SF", "1500 square feet".
 */
const extractAreaSqft = (text = '') => {
    const t = String(text).toLowerCase().replace(/,/g, '');

    // direct sqft mentions
    const sqftMatches = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet|square\s*foot|sf\b)/gi)]
        .map(m => Number(m[1]))
        .filter(n => n > 10 && n < 100000);

    if (sqftMatches.length) return Math.max(...sqftMatches);

    // sqm mentions → convert to sqft
    const sqmMatches = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm|square\s*met)/gi)]
        .map(m => Math.round(Number(m[1]) * 10.764))
        .filter(n => n > 10 && n < 100000);

    if (sqmMatches.length) return Math.max(...sqmMatches);

    return 0;
};

/**
 * Estimate total paintable area from all available inputs.
 * Uses carpet_area × 3.5 rule when direct wall area is not given.
 */
const estimatePaintArea = ({ areaSqft = 0, includeCeiling = false, roomCount = 0, answers = {}, description = '' }) => {
    // Try to get area from text
    const allText = [description, ...Object.values(answers || {})].join(' ');
    let area = areaSqft || extractAreaSqft(allText);

    // Detect ceiling mention
    const wantsCeiling = includeCeiling ||
        /ceiling|सीलिंग|छत/i.test(allText);

    // If area looks like carpet area (typical residential: 500–3000 sqft)
    // apply × 3.5 rule to get wall area
    let totalPaintArea = area;

    // Detect if this is carpet area or wall area
    const isLikelyFloorArea = area > 0 && area < 2000 &&
        /bhk|bedroom|flat|apartment|house|home|room|carpet|built.?up/i.test(allText);

    if (isLikelyFloorArea) {
        // Wall area ≈ carpet area × 3.5
        totalPaintArea = Math.round(area * 3.5);
    }

    if (wantsCeiling && area > 0) {
        // Ceiling area ≈ carpet area (not wall area)
        const ceilingArea = isLikelyFloorArea ? area : Math.round(area / 3.5);
        totalPaintArea += ceilingArea;
    }

    // Room count fallback: assume ≈500 sqft paintable area per room when area is missing
    if (!totalPaintArea && roomCount > 0) {
        totalPaintArea = roomCount * 500;
    }

    // Minimum sensible area for a single room
    return Math.max(totalPaintArea, 100);
};

/**
 * Core calculator: given an itemKey + area + options → cost breakdown.
 * @param {string} itemKey       – key in CATALOG
 * @param {number} areaSqft      – total area to be treated
 * @param {object} options       – { tier, cityKey, coats, qty, wastage }
 * @returns {{ qty, unit, packSize, packs, unitPrice, cost, bestCost, worstCost, note, brand }}
 */
const calcCost = (itemKey, areaSqft = 0, options = {}) => {
    const cat = CATALOG[itemKey];
    if (!cat) return null;

    const {
        tier      = 'standard',
        cityKey   = '',
        coats     = 2,
        qty       = null,       // override quantity
        wastage   = 1.10,       // 10% wastage buffer
    } = options;

    const tierM = TIER_MULT[tier] || 1.0;
    const cityM = getCityMult(cityKey);
    const baseUnitPrice = (cat.unitPrice || 0) * tierM * cityM;

    // Calculate quantity from coverage if not overridden
    let calculatedQty = qty;
    let unit = cat.packUnit;
    let note = '';

    if (calculatedQty == null) {
        if (cat.coverageSqftPerLitre) {
            // Paint / Primer
            const litresRaw = (areaSqft * coats) / cat.coverageSqftPerLitre;
            calculatedQty = Math.ceil(litresRaw * wastage * 10) / 10;
            unit = 'litre';
            note = `${areaSqft} sqft × ${coats} coats ÷ ${cat.coverageSqftPerLitre} sqft/L + ${Math.round((wastage-1)*100)}% wastage`;
        } else if (cat.coverageSqftPerKg) {
            // Putty
            const kgRaw = areaSqft / cat.coverageSqftPerKg;
            calculatedQty = Math.ceil(kgRaw * wastage * 10) / 10;
            unit = 'kg';
            note = `${areaSqft} sqft ÷ ${cat.coverageSqftPerKg} sqft/kg (2 coats) + wastage`;
        } else if (cat.coverageSqftPerBag) {
            // Tile adhesive
            const bagsRaw = areaSqft / cat.coverageSqftPerBag;
            calculatedQty = Math.ceil(bagsRaw * wastage);
            unit = 'bag';
        } else if (cat.coverageSqftPerCan) {
            const cansRaw = areaSqft / cat.coverageSqftPerCan;
            calculatedQty = Math.ceil(cansRaw * wastage);
            unit = 'can';
        } else {
            // Fixed qty (tap, socket, etc.) — area-independent unless overridden
            calculatedQty = 1;
        }
    }

    // Round to standard pack sizes for display
    const packs = cat.packSize > 0
        ? Math.ceil(calculatedQty / cat.packSize)
        : calculatedQty;

    const roundedQty = cat.packSize > 0
        ? packs * cat.packSize
        : calculatedQty;

    const packPrice = (cat.packPrice || (cat.packSize * cat.unitPrice)) * tierM * cityM;
    const totalCost = Math.round(packs * packPrice);
    const bestCost  = Math.round(totalCost * (TIER_MULT.economy / tierM));
    const worstCost = Math.round(totalCost * (TIER_MULT.premium / tierM));

    return {
        item:        cat.description,
        qty:         Math.round(roundedQty * 10) / 10,
        unit,
        packs,
        packSize:    cat.packSize,
        packUnit:    cat.packUnit,
        unitPrice:   Math.round(baseUnitPrice),
        packPrice:   Math.round(packPrice),
        estimatedCost: totalCost,
        bestCaseCost: bestCost,
        worstCaseCost: worstCost,
        optional:    cat.optional || false,
        brand:       cat.brand?.[tier] || '',
        note:        note || cat.description,
        priceSource: 'catalog_2025',
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SKILL MATERIAL TEMPLATES
// Returns list of material items for a skill + area combo.
// ─────────────────────────────────────────────────────────────────────────────

const buildMaterialsForSkill = (skillKey, areaSqft, options = {}) => {
    const {
        tier = 'standard', cityKey = '', hasCracks = false,
        isNewConstruction = false, paintCoats = 2, includeCeiling = false,
    } = options;

    const o = { tier, cityKey, wastage: 1.10 };

    switch (skillKey) {

        case 'painter': {
            const items = [];
            // Paint — always required
            const paintItem = calcCost('interior_emulsion_paint', areaSqft, { ...o, coats: paintCoats });
            if (paintItem) items.push({ ...paintItem, optional: false });

            // Putty — required for new construction / major repair; optional for repaint
            if (isNewConstruction || hasCracks) {
                const puttyItem = calcCost('wall_putty', areaSqft, o);
                if (puttyItem) items.push({ ...puttyItem, optional: !isNewConstruction && !hasCracks });
            } else {
                const puttyItem = calcCost('wall_putty', areaSqft, { ...o, qty: Math.ceil(areaSqft / 20) });
                if (puttyItem) items.push({ ...puttyItem, optional: true, note: 'Light putty for touch-ups only (smooth existing wall)' });
            }

            // Primer — required for new construction, optional for repaint
            const primerCoats = isNewConstruction ? 2 : 1;
            const primerItem = calcCost('primer', areaSqft, { ...o, coats: primerCoats });
            if (primerItem) items.push({ ...primerItem, optional: !isNewConstruction });

            // Tools — always optional
            const roller = calcCost('paint_roller_set', 0, o);
            const brushes = calcCost('paint_brushes', 0, o);
            const masking = calcCost('masking_tape', 0, { ...o, qty: Math.ceil(areaSqft / 500) + 2 });
            const sandpaper = calcCost('sandpaper_set', 0, o);
            const dropCloth = calcCost('drop_cloth', 0, { ...o, qty: Math.ceil(areaSqft / 400) + 1 });

            if (roller)    items.push({ ...roller,    optional: true });
            if (brushes)   items.push({ ...brushes,   optional: true });
            if (masking)   items.push({ ...masking,   optional: true });
            if (sandpaper) items.push({ ...sandpaper, optional: true });
            if (dropCloth) items.push({ ...dropCloth, optional: true });

            return items;
        }

        case 'plumber': {
            const items = [];
            const pipesNeeded = Math.ceil(areaSqft / 100);  // rough: 1 pipe per 100 sqft
            const pipe  = calcCost('cpvc_pipe_10ft', 0, { ...o, qty: pipesNeeded });
            const elbow = calcCost('pvc_elbow', 0, { ...o, qty: pipesNeeded * 2 });
            const tape  = calcCost('ptfe_tape_teflon', 0, { ...o, qty: Math.ceil(pipesNeeded / 2) });
            const sealant = calcCost('pipe_sealant', 0, o);

            if (pipe)    items.push({ ...pipe,    optional: false });
            if (elbow)   items.push({ ...elbow,   optional: false });
            if (tape)    items.push({ ...tape,    optional: true  });
            if (sealant) items.push({ ...sealant, optional: true  });
            return items;
        }

        case 'electrician': {
            const items = [];
            const metersOfWire = Math.ceil(areaSqft / 20);  // rough wiring
            const wireRolls = Math.ceil(metersOfWire / 10);
            const sockets  = Math.ceil(areaSqft / 80);
            const conduit  = Math.ceil(metersOfWire / 10);

            const wire    = calcCost('electrical_wire_10m', 0, { ...o, qty: wireRolls });
            const socket  = calcCost('socket_plate', 0, { ...o, qty: sockets });
            const conduitItem = calcCost('electrical_conduit_10ft', 0, { ...o, qty: conduit });
            const mcb     = calcCost('mcb_switch_box', 0, { ...o, qty: 1 });

            if (wire)    items.push({ ...wire,        optional: false });
            if (socket)  items.push({ ...socket,      optional: false });
            if (conduitItem) items.push({ ...conduitItem, optional: true });
            if (mcb)     items.push({ ...mcb,         optional: true  });
            return items;
        }

        case 'tiler': {
            const items = [];
            const tileQty  = Math.ceil(areaSqft * 1.10);   // 10% extra for cuts
            const adhesive = calcCost('tile_adhesive_20kg', areaSqft, o);
            const grout    = calcCost('tile_grout_2kg', 0, { ...o, qty: Math.ceil(areaSqft / 60) });
            const spacers  = calcCost('tile_spacers', 0, o);

            items.push({
                item: CATALOG.ceramic_tile_sqft.description,
                qty: tileQty,
                unit: 'sqft',
                estimatedCost: Math.round(tileQty * (CATALOG.ceramic_tile_sqft.unitPrice * TIER_MULT[tier] * getCityMult(cityKey))),
                bestCaseCost:  Math.round(tileQty * CATALOG.ceramic_tile_sqft.unitPrice * TIER_MULT.economy * getCityMult(cityKey)),
                worstCaseCost: Math.round(tileQty * CATALOG.ceramic_tile_sqft.unitPrice * TIER_MULT.premium * getCityMult(cityKey)),
                brand:         CATALOG.ceramic_tile_sqft.brand?.[tier] || '',
                optional: false,
                note: `${tileQty} sqft tiles (${areaSqft} sqft + 10% cuts/wastage)`,
                priceSource: 'catalog_2025',
            });

            if (adhesive) items.push({ ...adhesive, optional: false });
            if (grout)    items.push({ ...grout,    optional: false });
            if (spacers)  items.push({ ...spacers,  optional: true  });
            return items;
        }

        case 'mason': {
            const cementBags = Math.ceil(areaSqft / 25); // ~1 bag per 25 sqft for plastering
            const sandCft    = Math.ceil(areaSqft / 10);
            const cement  = calcCost('cement_bag_50kg', 0, { ...o, qty: cementBags });
            const sand    = calcCost('river_sand_cft', 0, { ...o, qty: sandCft });
            const waterproof = hasCracks ? calcCost('drfixit_waterproof_1L', 0, { ...o, qty: Math.ceil(areaSqft / 50) }) : null;
            const items = [];
            if (cement) items.push({ ...cement, optional: false });
            if (sand)   items.push({ ...sand,   optional: false });
            if (waterproof) items.push({ ...waterproof, optional: true });
            return items;
        }

        case 'waterproofing': {
            const cans = calcCost('drfixit_5L', areaSqft, o);
            return cans ? [{ ...cans, optional: false }] : [];
        }

        case 'false_ceiling': {
            const gypsum  = calcCost('gypsum_board_sqft', 0, { ...o, qty: Math.ceil(areaSqft * 1.08) });
            const pop     = calcCost('pop_powder_50kg', 0, { ...o, qty: Math.ceil(areaSqft / 200) });
            const screws  = calcCost('gypsum_screw_box', 0, o);
            const items = [];
            if (gypsum) items.push({ ...gypsum, optional: false });
            if (pop)    items.push({ ...pop,    optional: false });
            if (screws) items.push({ ...screws, optional: true  });
            return items;
        }

        case 'ac_technician': {
            const gas     = calcCost('ac_refrigerant_r32', 0, o);
            const drain   = calcCost('ac_drain_pipe_1m', 0, { ...o, qty: 3 });
            const items = [];
            if (gas)   items.push({ ...gas,   optional: false, note: 'Gas refill if refrigerant is low' });
            if (drain) items.push({ ...drain, optional: true  });
            return items;
        }

        case 'deep_cleaning': {
            const cleaner = calcCost('floor_cleaner_5L', 0, o);
            const mop     = calcCost('cleaning_mop_set', 0, o);
            const items = [];
            if (cleaner) items.push({ ...cleaner, optional: false });
            if (mop)     items.push({ ...mop,     optional: true  });
            return items;
        }

        case 'pest_control': {
            const chem = calcCost('pest_chemical_1L', 0, { ...o, qty: Math.ceil(areaSqft / 300) });
            return chem ? [{ ...chem, optional: false }] : [];
        }

        case 'carpenter': {
            const items = [];
            const screws  = calcCost('wood_screw_set', 0, o);
            const sand    = calcCost('sandpaper_wood', 0, o);
            const polish  = calcCost('wood_polish_1L', areaSqft, o);
            const fevicol = calcCost('fevicol_1kg', 0, o);
            if (screws)  items.push({ ...screws,  optional: true  });
            if (sand)    items.push({ ...sand,    optional: true  });
            if (polish)  items.push({ ...polish,  optional: false });
            if (fevicol) items.push({ ...fevicol, optional: true  });
            return items;
        }

        default:
            return [];
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate realistic material list for a job.
 * This is the drop-in replacement for the broken estimateMaterialOrEquipmentItem loop.
 *
 * @param {object} params
 * @param {string} params.skillKey        - canonical skill
 * @param {number} params.areaSqft        - paintable / work area in sqft
 * @param {string} [params.tier]          - 'economy'|'standard'|'premium'
 * @param {string} [params.cityKey]       - normalized city key
 * @param {boolean}[params.hasCracks]     - from condition signals
 * @param {boolean}[params.isNew]         - new construction vs repaint
 * @param {string[]}[params.ownedItems]   - items client already has (excluded)
 * @returns {{ materials: [], equipment: [], materialsTotal: number, equipmentTotal: number }}
 */
const generateMaterialList = (params = {}) => {
    const {
        skillKey        = 'painter',
        areaSqft        = 200,
        tier            = 'standard',
        cityKey         = '',
        hasCracks       = false,
        isNew           = false,
        ownedItems      = [],
        paintCoats      = 2,
        includeCeiling  = false,
    } = params;

    const allItems = buildMaterialsForSkill(skillKey, areaSqft, {
        tier, cityKey, hasCracks, isNewConstruction: isNew, paintCoats, includeCeiling,
    });

    const EQUIPMENT_ITEM_NAMES = new Set([
        '9-inch Paint Roller Set (3 rollers + tray)',
        'Paint Brushes — set of 3 (1", 2", 3")',
        'Drop Cloth / Plastic Sheet Protection',
        'Sandpaper Set (60/80/120 grit)',
        'Masking Tape',
        'Tile Spacers (bag of 100)',
        'Chemical Drain Cleaner (500ml)',
        'Junction Box',
        'Gypsum Drywall Screws (box of 200)',
        'Wood Screw Assorted Set',
        'Wood Sandpaper Set (80/120/220 grit)',
        'Cleaning Mop + Scrubber Set',
        'AC Drain Pipe (per metre)',
    ]);

    // Normalise owned items for matching
    const ownedNorm = ownedItems.map(s => String(s).toLowerCase().trim());
    const normalizeTokens = (value) =>
        String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((token) => token.length >= 3);

    const isOwned = (itemName = '') => {
        const itemTokens = new Set(normalizeTokens(itemName));
        return ownedNorm.some((owned) => {
            const ownedTokens = normalizeTokens(owned);
            if (!ownedTokens.length) return false;
            return ownedTokens.every((token) => itemTokens.has(token));
        });
    };

    const materials = allItems.filter(i => !isOwned(i.item));
    const finalEquipment = materials.filter((item) => EQUIPMENT_ITEM_NAMES.has(String(item.item || '').trim()));
    const finalMaterials = materials.filter((item) => !EQUIPMENT_ITEM_NAMES.has(String(item.item || '').trim()));

    const sum = arr => arr.reduce((s, i) => s + (Number(i.estimatedCost) || 0), 0);

    return {
        materials:      finalMaterials,
        equipment:      finalEquipment,
        materialsTotal: sum(finalMaterials),
        equipmentTotal: sum(finalEquipment),
        totalCost:      sum(materials),
        areaSqft,
        tier,
        skillKey,
    };
};

module.exports = {
    CATALOG,
    TIER_MULT,
    getCityMult,
    calcCost,
    extractAreaSqft,
    estimatePaintArea,
    buildMaterialsForSkill,
    generateMaterialList,
};

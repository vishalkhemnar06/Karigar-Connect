/**
 * server/utils/materialEstimator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DROP-IN REPLACEMENT for the broken material/equipment estimation helpers
 * in aiAssistantController.js.
 *
 * WHAT THIS FIXES:
 *   1. estimateMaterialOrEquipmentItem used `benchmark * 0.12` as unit price
 *      → produced ₹269 for a 20L paint bucket that costs ₹4,000
 *   2. Area extraction only read the first number → missed "1200 sqft + ceiling"
 *   3. Paint coverage logic was using wrong sqft/litre figure
 *   4. No material catalog → AI hallucinated quantities
 *
 * HOW TO INTEGRATE:
 *   1. Place this file at server/utils/materialEstimator.js
 *   2. In aiAssistantController.js, replace:
 *        const estimateMaterialOrEquipmentItem = async ({ ... }) => { ... };
 *      with:
 *        const { estimateMaterialOrEquipmentItem, deriveConditionSignals } =
 *            require('../utils/materialEstimator');
 *   3. Remove the old deriveConditionSignals function too (replaced here).
 *   4. The rest of aiAssistantController.js is UNCHANGED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { generateMaterialList, extractAreaSqft, estimatePaintArea, getCityMult, calcCost, CATALOG } = require('./materialCatalog');

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION SIGNALS  (replaces deriveConditionSignals in aiAssistantController)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract real-world signals from free text (description + QA answers).
 * Returns structured flags used for material and cost calculations.
 */
const deriveConditionSignals = ({ workDescription = '', answers = {} }) => {
    const text = [
        String(workDescription || ''),
        ...Object.values(answers || {}),
    ].join(' ').toLowerCase();

    // --- Area ---
    const areaSqft = extractAreaSqft(text);

    // Detect if mentioned area is carpet/floor area vs wall area
    const isLikelyFloorArea = areaSqft > 0 &&
        /bhk|bedroom|flat|apartment|house|home|carpet|built.?up/i.test(text);

    const effectiveWallArea = isLikelyFloorArea
        ? Math.round(areaSqft * 3.5)
        : areaSqft;

    const includeCeiling = /ceiling|छत/i.test(text);
    const ceilingArea    = includeCeiling
        ? (isLikelyFloorArea ? areaSqft : Math.round(areaSqft / 3.5))
        : 0;

    const totalPaintArea = effectiveWallArea + ceilingArea;

    // --- Room count ---
    const wallMatch  = text.match(/(\d+)\s*(?:walls?|areas?)/);
    const wallCount  = wallMatch ? Number(wallMatch[1]) : Math.max(1, Math.round(effectiveWallArea / 150));

    // --- Surface condition ---
    const hasCracks       = /crack|peel|peeling|damp|leak|patch|rough|flak/i.test(text);
    const hasGoodSurface  = /smooth|good condition|already painted|fine/i.test(text);
    const isNewConstruction = /new construct|new plaster|freshly plaster|new wall|unpainted/i.test(text);
    const isPaintJob      = /paint|painting|repaint|whitewash|colour|color/i.test(text);

    // --- Paint specifics ---
    const paintCoats = /three coats|3 coats/i.test(text) ? 3 : 2;

    // --- Ownership of materials ---
    const hasToolsOrMaterials   = /have|already|available|own|got/i.test(text);
    const hasProtectionAvailable= /masking|drop cloth|sheet|protection/i.test(text);

    // --- Material quality tier ---
    let tier = 'standard';
    if (/premium|royale|luxury|best|top/i.test(text))  tier = 'premium';
    if (/economy|budget|cheap|basic|distemper/i.test(text)) tier = 'economy';

    return {
        // Area fields
        areaSqft:         areaSqft,         // raw detected area
        wallAreaSqft:     effectiveWallArea, // wall area after carpet→wall conversion
        ceilingAreaSqft:  ceilingArea,
        totalPaintArea:   totalPaintArea || effectiveWallArea,
        wallCount,
        isLikelyFloorArea,
        includeCeiling,

        // Surface condition
        isPaintJob,
        hasCracks,
        hasGoodSurface,
        isNewConstruction,
        paintCoats,

        // Ownership
        hasToolsOrMaterials,
        hasProtectionAvailable,

        // Preference
        tier,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC ESTIMATOR  (replaces estimateMaterialOrEquipmentItem in aiAssistantController)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Async version for compatibility with the existing controller signature.
 * Uses the real materialCatalog instead of the broken benchmark formula.
 *
 * @param {object} params
 * @param {object} params.item          – raw item from AI response { item, estimatedCost, quantity, note, optional }
 * @param {'material'|'equipment'}  params.kind
 * @param {object} params.signals       – output of deriveConditionSignals()
 * @param {object} params.marketInsight – market insight object (avgDailyRate etc.)
 * @param {string} params.city          – city name
 * @param {string} params.skillKey      – canonical skill key
 * @returns {Promise<object>}  enriched item with correct estimatedCost
 */
const estimateMaterialOrEquipmentItem = async ({
    item   = {},
    kind   = 'material',
    signals = {},
    marketInsight = {},
    city   = '',
    locality = '',
    skillKey = 'painter',
}) => {
    const itemName  = String(item?.item || item?.name || '').trim();
    const itemNameL = itemName.toLowerCase();

    // City key for pricing
    const cityKey = String(city || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');

    // Tier from signals or default
    const tier = signals.tier || 'standard';

    // Paintable area from signals
    const areaSqft = signals.totalPaintArea || signals.wallAreaSqft || signals.areaSqft || 200;
    const isNew     = !!signals.isNewConstruction;
    const paintCoats = signals.paintCoats || 2;
    const localityAdjustment = String(locality || '').trim() ? 1.03 : 1;
    const applyLocalityAdjustment = (value) => Math.max(1, Math.round((Number(value) || 0) * localityAdjustment));
    const demandRatio = clamp(marketInsight?.avgDemandRatio || 1, 0.9, 1.2);

    // ── Try to match item name to catalog key ─────────────────────────────────
    const ITEM_KEY_PATTERNS = [
        { pattern: /emulsion|interior.*paint|paint.*interior|wall.*paint/i,  key: 'interior_emulsion_paint' },
        { pattern: /exterior.*paint|paint.*exterior/i,                        key: 'exterior_emulsion_paint' },
        { pattern: /putty|wall.*putty|putty.*wall/i,                          key: 'wall_putty'              },
        { pattern: /primer|priming/i,                                          key: 'primer'                  },
        { pattern: /roller|roller.*set/i,                                      key: 'paint_roller_set'        },
        { pattern: /brush.*set|paint.*brush/i,                                 key: 'paint_brushes'           },
        { pattern: /drop.*cloth|plastic.*sheet|protection.*sheet/i,            key: 'drop_cloth'              },
        { pattern: /sandpaper|sand.*paper|abrasive/i,                          key: 'sandpaper_set'           },
        { pattern: /masking.*tape|tape.*mask/i,                                key: 'masking_tape'            },
        { pattern: /tile.*adhesive|adhesive.*tile|wall.*adhesive/i,            key: 'tile_adhesive_20kg'      },
        { pattern: /tile.*grout|grout/i,                                       key: 'tile_grout_2kg'          },
        { pattern: /ceramic.*tile|tile.*ceramic|floor.*tile|tile.*floor/i,    key: 'ceramic_tile_sqft'       },
        { pattern: /cpvc.*pipe|pipe.*cpvc|water.*pipe/i,                      key: 'cpvc_pipe_10ft'          },
        { pattern: /teflon|ptfe|pipe.*seal/i,                                  key: 'ptfe_tape_teflon'        },
        { pattern: /cement.*bag|opc.*cement|ppc.*cement/i,                    key: 'cement_bag_50kg'         },
        { pattern: /river.*sand|sand/i,                                        key: 'river_sand_cft'          },
        { pattern: /dr\.?\s*fixit|dampguard|waterproof.*coat/i,               key: 'drfixit_5L'              },
        { pattern: /gypsum.*board|drywall/i,                                   key: 'gypsum_board_sqft'       },
        { pattern: /pop|plaster.*paris/i,                                      key: 'pop_powder_50kg'         },
        { pattern: /wood.*polish|varnish|lacquer/i,                            key: 'wood_polish_1L'          },
        { pattern: /fevicol|wood.*adhesive/i,                                  key: 'fevicol_1kg'             },
        { pattern: /pest.*chemical|chemical.*pest/i,                           key: 'pest_chemical_1L'        },
        { pattern: /floor.*cleaner|cleaning.*chemical/i,                       key: 'floor_cleaner_5L'        },
        { pattern: /refrigerant|gas.*r32|ac.*gas/i,                           key: 'ac_refrigerant_r32'      },
        { pattern: /electrical.*wire|wire.*\d+.*sqmm/i,                       key: 'electrical_wire_10m'     },
        { pattern: /socket|modular.*plate|switch.*plate/i,                     key: 'socket_plate'            },
    ];

    let catalogKey = null;
    for (const { pattern, key } of ITEM_KEY_PATTERNS) {
        if (pattern.test(itemNameL)) { catalogKey = key; break; }
    }

    // ── If we matched a catalog item, compute proper cost ─────────────────────
    if (catalogKey) {
        // Determine quantity from area for coverage-based items
        const coatOverride = /primer/i.test(itemNameL) ? (isNew ? 2 : 1) : paintCoats;
        const result = calcCost(catalogKey, areaSqft, {
            tier,
            cityKey,
            coats: coatOverride,
            wastage: 1.10,
        });

        if (result) {
            const isEquipment = kind === 'equipment' || result.optional;
            return {
                ...item,
                item:           result.item || itemName,
                estimatedCost:  applyLocalityAdjustment(result.estimatedCost),
                bestCaseCost:   applyLocalityAdjustment(result.bestCaseCost),
                worstCaseCost:  applyLocalityAdjustment(result.worstCaseCost),
                quantity:       `${result.qty} ${result.unit}`,
                note:           result.note || item.note || '',
                brand:          result.brand || '',
                optional:       isEquipment || result.optional || !!item.optional,
                priceSource:    result.priceSource || 'catalog_2025',
                marketplaceSampleSize: 0,
                marketplaceUnitPrice:  result.unitPrice,
            };
        }
    }

    // ── Fallback: use AI's own cost if available, otherwise estimate from area ─
    const aiCost = Number(item?.estimatedCost) || 0;

    if (aiCost > 0 && aiCost < 100000) {
        // AI gave a reasonable cost — trust it but apply city multiplier
        const cityM = getCityMult(cityKey);
        const adjusted = Math.round(aiCost * cityM * demandRatio);
        const minimumRealistic = kind === 'material' ? 120 : 80;
        const expected = Math.max(minimumRealistic, adjusted);
        return {
            ...item,
            estimatedCost:  applyLocalityAdjustment(expected),
            bestCaseCost:   applyLocalityAdjustment(Math.round(expected * 0.80)),
            worstCaseCost:  applyLocalityAdjustment(Math.round(expected * 1.30)),
            optional:       kind === 'equipment' || !!item.optional,
            priceSource:    'ai_with_city_adjustment',
            marketplaceSampleSize: 0,
            marketplaceUnitPrice:  0,
        };
    }

    // ── Last resort: reasonable area-proportional estimate ────────────────────
    const fallbackCost = kind === 'material'
        ? Math.round(areaSqft * 9 * demandRatio)   // ₹9/sqft baseline for unknown materials
        : Math.round(areaSqft * 2.5 * demandRatio); // ₹2.5/sqft baseline for unknown equipment

    return {
        ...item,
        estimatedCost:  applyLocalityAdjustment(fallbackCost),
        bestCaseCost:   applyLocalityAdjustment(Math.round(fallbackCost * 0.75)),
        worstCaseCost:  applyLocalityAdjustment(Math.round(fallbackCost * 1.40)),
        optional:       kind === 'equipment' || !!item.optional,
        priceSource:    'area_proportional_fallback',
        marketplaceSampleSize: 0,
        marketplaceUnitPrice:  0,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE FULL MATERIAL LIST  (used by advisor when skillBlocks are known)
// Call this before calling AI to pre-calculate material costs,
// then merge with AI's item names/notes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate complete, realistic material list from skill + area + context.
 * Returns same shape as the existing materialsBreakdown / equipmentBreakdown arrays.
 *
 * @param {object} params
 * @param {string[]} params.skills       – e.g. ['painter', 'plumber']
 * @param {number}   params.areaSqft     – total area
 * @param {string}   params.city
 * @param {object}   params.signals      – from deriveConditionSignals()
 * @param {string[]} [params.ownedItems] – items to exclude
 * @returns {{ materials: [], equipment: [], materialsTotal, equipmentTotal }}
 */
const generateFullMaterialList = ({ skills = [], areaSqft = 200, city = '', signals = {}, ownedItems = [] }) => {
    const cityKey = String(city || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    const tier    = signals.tier || 'standard';

    const allMaterials = [];
    const allEquipment = [];

    for (const skill of skills) {
        const result = generateMaterialList({
            skillKey:   skill,
            areaSqft:   areaSqft || 200,
            tier,
            cityKey,
            hasCracks:  signals.hasCracks,
            isNew:      signals.isNewConstruction,
            ownedItems,
            paintCoats: signals.paintCoats || 2,
            includeCeiling: signals.includeCeiling,
        });
        allMaterials.push(...result.materials);
        allEquipment.push(...result.equipment);
    }

    // Deduplicate by item name
    const dedup = (arr) => {
        const seen = new Map();
        for (const item of arr) {
            const key = String(item.item || '').toLowerCase().slice(0, 30);
            if (!seen.has(key)) seen.set(key, item);
            else {
                const existing = seen.get(key);
                seen.set(key, {
                    ...existing,
                    qty:           (Number(existing.qty) || 0) + (Number(item.qty) || 0),
                    estimatedCost: (Number(existing.estimatedCost) || 0) + (Number(item.estimatedCost) || 0),
                    bestCaseCost:  (Number(existing.bestCaseCost) || 0) + (Number(item.bestCaseCost) || 0),
                    worstCaseCost: (Number(existing.worstCaseCost) || 0) + (Number(item.worstCaseCost) || 0),
                });
            }
        }
        return [...seen.values()];
    };

    const materials = dedup(allMaterials);
    const equipment = dedup(allEquipment);
    const sum = arr => arr.reduce((s, i) => s + (Number(i.estimatedCost) || 0), 0);

    return {
        materials,
        equipment,
        materialsTotal: sum(materials),
        equipmentTotal: sum(equipment),
        totalCost:      sum([...materials, ...equipment]),
    };
};

module.exports = {
    deriveConditionSignals,
    estimateMaterialOrEquipmentItem,
    generateFullMaterialList,
};

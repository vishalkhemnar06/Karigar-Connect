// utils/rateTable.js
// Structured rate table for component-based budget estimation
// Rates are in INR per day for Indian cities

const BASE_RATES = {
  // Tier 1 Cities (Metro)
  mumbai:     { plumber: 1800, electrician: 1700, carpenter: 1600, painter: 1400, tiler: 1500, mason: 1600, welder: 1800, ac_technician: 1900, pest_control: 1500, cleaner: 900, handyman: 1200, gardener: 1000, driver: 1300, security: 1100, cook: 1400 },
  delhi:      { plumber: 1700, electrician: 1600, carpenter: 1500, painter: 1300, tiler: 1400, mason: 1500, welder: 1700, ac_technician: 1800, pest_control: 1400, cleaner: 850, handyman: 1100, gardener: 950, driver: 1200, security: 1000, cook: 1300 },
  bangalore:  { plumber: 1700, electrician: 1600, carpenter: 1500, painter: 1300, tiler: 1450, mason: 1500, welder: 1700, ac_technician: 1800, pest_control: 1400, cleaner: 850, handyman: 1100, gardener: 950, driver: 1200, security: 1000, cook: 1350 },
  hyderabad:  { plumber: 1500, electrician: 1450, carpenter: 1350, painter: 1200, tiler: 1300, mason: 1350, welder: 1500, ac_technician: 1600, pest_control: 1300, cleaner: 800, handyman: 1000, gardener: 900, driver: 1100, security: 950, cook: 1200 },
  chennai:    { plumber: 1500, electrician: 1400, carpenter: 1300, painter: 1200, tiler: 1300, mason: 1350, welder: 1500, ac_technician: 1600, pest_control: 1300, cleaner: 800, handyman: 1000, gardener: 900, driver: 1100, security: 950, cook: 1200 },
  kolkata:    { plumber: 1300, electrician: 1250, carpenter: 1150, painter: 1050, tiler: 1150, mason: 1200, welder: 1350, ac_technician: 1450, pest_control: 1150, cleaner: 700, handyman: 900, gardener: 800, driver: 1000, security: 850, cook: 1050 },
  // Tier 2 Cities
  pune:       { plumber: 1400, electrician: 1350, carpenter: 1250, painter: 1100, tiler: 1200, mason: 1300, welder: 1400, ac_technician: 1500, pest_control: 1250, cleaner: 750, handyman: 1000, gardener: 850, driver: 1050, security: 900, cook: 1150 },
  ahmedabad:  { plumber: 1300, electrician: 1250, carpenter: 1150, painter: 1050, tiler: 1150, mason: 1200, welder: 1300, ac_technician: 1400, pest_control: 1150, cleaner: 700, handyman: 950, gardener: 800, driver: 1000, security: 850, cook: 1100 },
  surat:      { plumber: 1300, electrician: 1200, carpenter: 1100, painter: 1000, tiler: 1100, mason: 1150, welder: 1300, ac_technician: 1400, pest_control: 1100, cleaner: 700, handyman: 950, gardener: 800, driver: 1000, security: 850, cook: 1050 },
  jaipur:     { plumber: 1200, electrician: 1150, carpenter: 1050, painter: 950, tiler: 1050, mason: 1100, welder: 1200, ac_technician: 1300, pest_control: 1050, cleaner: 650, handyman: 900, gardener: 750, driver: 950, security: 800, cook: 1000 },
  lucknow:    { plumber: 1150, electrician: 1100, carpenter: 1000, painter: 900, tiler: 1000, mason: 1050, welder: 1150, ac_technician: 1250, pest_control: 1000, cleaner: 620, handyman: 850, gardener: 720, driver: 900, security: 780, cook: 950 },
  nagpur:     { plumber: 1200, electrician: 1150, carpenter: 1050, painter: 950, tiler: 1050, mason: 1100, welder: 1200, ac_technician: 1300, pest_control: 1050, cleaner: 650, handyman: 900, gardener: 750, driver: 950, security: 800, cook: 1000 },
  indore:     { plumber: 1150, electrician: 1100, carpenter: 1000, painter: 900, tiler: 1000, mason: 1050, welder: 1150, ac_technician: 1250, pest_control: 1000, cleaner: 620, handyman: 850, gardener: 720, driver: 900, security: 780, cook: 950 },
  bhopal:     { plumber: 1100, electrician: 1050, carpenter: 950, painter: 880, tiler: 980, mason: 1000, welder: 1100, ac_technician: 1200, pest_control: 980, cleaner: 600, handyman: 830, gardener: 700, driver: 880, security: 760, cook: 920 },
  chandigarh: { plumber: 1300, electrician: 1250, carpenter: 1150, painter: 1050, tiler: 1150, mason: 1200, welder: 1300, ac_technician: 1400, pest_control: 1150, cleaner: 700, handyman: 950, gardener: 800, driver: 1000, security: 850, cook: 1100 },
  // Tier 3 / Default
  default:    { plumber: 1000, electrician: 950, carpenter: 900, painter: 800, tiler: 900, mason: 950, welder: 1000, ac_technician: 1100, pest_control: 900, cleaner: 550, handyman: 750, gardener: 650, driver: 800, security: 700, cook: 850 }
};

// Skill name aliases — map common names to rate table keys
const SKILL_ALIASES = {
  // Plumbing
  'plumber': 'plumber', 'plumbing': 'plumber', 'pipe fitter': 'plumber', 'drainage': 'plumber',
  // Electrical
  'electrician': 'electrician', 'electrical': 'electrician', 'wiring': 'electrician', 'electrical work': 'electrician',
  // Carpentry
  'carpenter': 'carpenter', 'carpentry': 'carpenter', 'woodwork': 'carpenter', 'furniture repair': 'carpenter',
  // Painting
  'painter': 'painter', 'painting': 'painter', 'wall painting': 'painter', 'exterior painting': 'painter',
  // Tiling
  'tiler': 'tiler', 'tiling': 'tiler', 'tile work': 'tiler', 'flooring': 'tiler', 'floor tiles': 'tiler',
  // Mason
  'mason': 'mason', 'masonry': 'mason', 'bricklayer': 'mason', 'construction': 'mason', 'civil': 'mason',
  // Welding
  'welder': 'welder', 'welding': 'welder', 'metal work': 'welder', 'fabrication': 'welder',
  // AC
  'ac technician': 'ac_technician', 'ac repair': 'ac_technician', 'hvac': 'ac_technician', 'air conditioning': 'ac_technician',
  // Pest Control
  'pest control': 'pest_control', 'pest': 'pest_control', 'termite': 'pest_control',
  // Cleaning
  'cleaner': 'cleaner', 'cleaning': 'cleaner', 'housekeeping': 'cleaner', 'deep cleaning': 'cleaner',
  // Handyman
  'handyman': 'handyman', 'general repair': 'handyman', 'maintenance': 'handyman',
  // Gardening
  'gardener': 'gardener', 'gardening': 'gardening', 'landscaping': 'gardener',
  // Driver
  'driver': 'driver', 'driving': 'driver',
  // Security
  'security': 'security', 'guard': 'security',
  // Cook
  'cook': 'cook', 'cooking': 'cook', 'chef': 'cook'
};

// Complexity multipliers
const COMPLEXITY_MULTIPLIERS = { light: 1.0, normal: 1.2, heavy: 1.5 };

// Duration factors (days)
const getDurationFactor = (hours) => {
  if (!hours || hours <= 0) return 1.0;
  if (hours < 2)  return 0.3;
  if (hours <= 4) return 0.6;
  if (hours <= 8) return 1.0;
  return Math.min(hours / 8, 5); // cap at 5 days worth
};

/**
 * Normalize city name to rate table key
 */
const normalizeCity = (city = '') => {
  const c = city.toLowerCase().trim();
  if (BASE_RATES[c]) return c;
  // Partial match
  for (const key of Object.keys(BASE_RATES)) {
    if (c.includes(key) || key.includes(c)) return key;
  }
  return 'default';
};

/**
 * Get base daily rate for a skill in a city
 */
const getBaseRate = (skillName, city) => {
  const cityKey  = normalizeCity(city);
  const skillKey = SKILL_ALIASES[skillName.toLowerCase().trim()] || 'handyman';
  const cityRates = BASE_RATES[cityKey] || BASE_RATES.default;
  return cityRates[skillKey] || cityRates.handyman;
};

/**
 * Calculate cost for a single skill block
 * @param {Object} block - { skill, count, hours, complexity, city }
 * @returns {Object} - { skill, count, hours, baseRate, complexity, complexityMult, durationFactor, subtotal }
 */
const calculateSkillCost = ({ skill, count = 1, hours = 8, complexity = 'normal', city = '' }) => {
  const baseRate        = getBaseRate(skill, city);
  const complexityMult  = COMPLEXITY_MULTIPLIERS[complexity] || 1.2;
  const durationFactor  = getDurationFactor(hours);
  const subtotal        = Math.round(baseRate * complexityMult * durationFactor * count);
  return { skill, count, hours, baseRate, complexity, complexityMult, durationFactor, subtotal };
};

/**
 * Calculate full structured budget
 * @param {Array} skillBlocks - Array of { skill, count, hours, complexity }
 * @param {string} city
 * @param {boolean} urgent
 * @returns {Object} full breakdown
 */
const calculateStructuredBudget = (skillBlocks, city = '', urgent = false) => {
  const breakdown = skillBlocks.map(block => calculateSkillCost({ ...block, city }));
  const subtotal   = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const urgencyMult = urgent ? 1.25 : 1.0;
  const totalEstimated = Math.round(subtotal * urgencyMult);

  return {
    city: normalizeCity(city),
    breakdown,
    subtotal,
    urgent,
    urgencyMult,
    totalEstimated,
    totalWorkers: breakdown.reduce((sum, b) => sum + b.count, 0),
  };
};

module.exports = {
  BASE_RATES,
  SKILL_ALIASES,
  COMPLEXITY_MULTIPLIERS,
  normalizeCity,
  getBaseRate,
  calculateSkillCost,
  calculateStructuredBudget,
};
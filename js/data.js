// ============================================================================
// ◈ PROJECT CROWN — Master Game Data & Pixel Art Matrices (js/data.js)
// ============================================================================

// 10x10 Pixel Art Matrices for Company Logos & System Icons
// '1' = primary color, '2' = secondary/accent color, '.' = transparent
export const PIXEL_MATRICES = {
  crown: [
    "....11....",
    ".1..11..1.",
    ".11.11.11.",
    ".11111111.",
    ".12111121.",
    ".11122111.",
    ".11111111.",
    "..222222..",
    "..111111..",
    ".........."
  ],
  anchor: [
    "....11....",
    "...1..1...",
    "....11....",
    "..221122..",
    "....11....",
    ".1..11..1.",
    ".11.11.11.",
    "..111111..",
    "...1111...",
    "....11...."
  ],
  gear: [
    "...1..1...",
    ".1.1111.1.",
    "..112211..",
    ".112..211.",
    "112....211",
    "112....211",
    ".112..211.",
    "..112211..",
    ".1.1111.1.",
    "...1..1..."
  ],
  airplane: [
    "....11....",
    "....11....",
    "...1111...",
    ".11122111.",
    "1111221111",
    "....11....",
    "....11....",
    "...1111...",
    "..11..11..",
    ".........."
  ],
  wheel: [
    "....11....",
    ".1..11..1.",
    "..112211..",
    "..21..12..",
    "112.22.211",
    "112.22.211",
    "..21..12..",
    "..112211..",
    ".1..11..1.",
    "....11...."
  ],
  leaf: [
    "......111.",
    "....11111.",
    "...111211.",
    "..1112111.",
    ".1112111..",
    ".112111...",
    ".12111....",
    ".211......",
    "22........",
    ".........."
  ],
  mountain: [
    ".....1....",
    "....121...",
    "...12221..",
    "..1112111.",
    ".1.111111.",
    "1211111111",
    "1111111111",
    "1111111111",
    "2222222222",
    ".........."
  ],
  train: [
    "..111111..",
    ".11222211.",
    ".11222211.",
    ".11111111.",
    ".11211211.",
    ".11111111.",
    "..111111..",
    ".22.22.22.",
    "2222222222",
    ".........."
  ],
  skyscraper: [
    "....11....",
    "...1111...",
    "..112211..",
    "..111111..",
    "..112211..",
    "..111111..",
    "..112211..",
    ".11111111.",
    ".11122111.",
    "1111111111"
  ],
  globe: [
    "...1111...",
    ".11221111.",
    ".12221121.",
    "1122112221",
    "1111122221",
    "1221112211",
    ".12211111.",
    ".11112211.",
    "...1111...",
    ".........."
  ],
  chip: [
    ".2.2..2.2.",
    "..111111..",
    "2112222112",
    ".12111121.",
    "2121221212",
    "2121221212",
    ".12111121.",
    "2112222112",
    "..111111..",
    ".2.2..2.2."
  ],
  diamond: [
    "....11....",
    "...1221...",
    "..121121..",
    ".12111121.",
    "1211221121",
    "1211221121",
    ".12111121.",
    "..121121..",
    "...1221...",
    "....11...."
  ],
  heart: [
    ".11....11.",
    "1221..1221",
    "1211111121",
    "1111111111",
    ".11111111.",
    "..111111..",
    "...1111...",
    "....11....",
    "..........",
    ".........."
  ],
  shield: [
    ".11111111.",
    "1122222211",
    "1121111211",
    "1121221211",
    "1121221211",
    ".11211211.",
    "..112211..",
    "...1111...",
    "....11....",
    ".........."
  ],
  bolt: [
    ".....1111.",
    "....1121..",
    "...1121...",
    "..1122111.",
    ".11112211.",
    "....1211..",
    "...121....",
    "..111.....",
    ".11.......",
    ".........."
  ],
  book: [
    ".1111.1111",
    "1222111221",
    "1211111121",
    "1222111221",
    "1211111121",
    "1222111221",
    "1111111111",
    ".2222.2222",
    "..........",
    ".........."
  ],
  trophy: [
    ".21111112.",
    "2212222122",
    "2.121121.2",
    "..111111..",
    "...1111...",
    "....11....",
    "....11....",
    "..111111..",
    ".11222211.",
    ".........."
  ],
  newspaper: [
    "111111111.",
    "1222222211",
    "1211121111",
    "1211122211",
    "1222221111",
    "1211111111",
    "1222222211",
    "1111111111",
    "..........",
    ".........."
  ]
};

const _iconCache = new Map();

export function getPixelIconDataURL(matrixKey, primary = "#f5c542", secondary = "#58a6ff", size = 24) {
  const cacheKey = `${matrixKey}_${primary}_${secondary}_${size}`;
  if (_iconCache.has(cacheKey)) return _iconCache.get(cacheKey);

  const matrix = PIXEL_MATRICES[matrixKey] || PIXEL_MATRICES.crown;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const rows = matrix.length;
  const cols = matrix[0].length;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = matrix[r][c];
      if (ch === "1") {
        ctx.fillStyle = primary;
        ctx.fillRect(Math.floor(c * cellW), Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH));
      } else if (ch === "2") {
        ctx.fillStyle = secondary;
        ctx.fillRect(Math.floor(c * cellW), Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }
  const url = canvas.toDataURL();
  _iconCache.set(cacheKey, url);
  return url;
}

// World Sizes Configuration
export const WORLD_SIZES = {
  Tiny: { settlements: 45, countries: 4, companies: 45, people: 80, label: "Tiny (45 Settlements)" },
  Small: { settlements: 75, countries: 6, companies: 70, people: 120, label: "Small (75 Settlements)" },
  Medium: { settlements: 120, countries: 9, companies: 110, people: 180, label: "Medium (120 Settlements)" },
  Large: { settlements: 180, countries: 12, companies: 160, people: 260, label: "Large (180 Settlements)" },
  Huge: { settlements: 260, countries: 16, companies: 220, people: 360, label: "Huge (260 Settlements)" },
  Custom: { settlements: 150, countries: 10, companies: 140, people: 220, label: "Custom (150 Settlements)" }
};

// Difficulty Presets (Part 11)
export const DIFFICULTIES = {
  Relaxed: {
    id: "Relaxed",
    label: "Relaxed",
    incomeMult: 1.3,
    costMult: 0.75,
    happinessBonus: 10,
    disasterChance: 0.4,
    grantMult: 1.4,
    desc: "Higher income, cheaper construction, happier citizens, fewer disasters, generous grants."
  },
  Standard: {
    id: "Standard",
    label: "Standard",
    incomeMult: 1.0,
    costMult: 1.0,
    happinessBonus: 0,
    disasterChance: 1.0,
    grantMult: 1.0,
    desc: "Balanced simulation experience recommended for most mayors."
  },
  Challenging: {
    id: "Challenging",
    label: "Challenging",
    incomeMult: 0.85,
    costMult: 1.2,
    happinessBonus: -5,
    disasterChance: 1.35,
    grantMult: 0.8,
    desc: "Lower margins, smarter AI rival cities, tougher citizen demands, frequent market swings."
  },
  Realistic: {
    id: "Realistic",
    label: "Realistic",
    incomeMult: 0.75,
    costMult: 1.35,
    happinessBonus: -8,
    disasterChance: 1.5,
    grantMult: 0.65,
    desc: "Cities grow gradually, budgets are tight, and every policy decision carries lasting weight."
  }
};

// Geography & Water Bonuses (Part 2)
export const GEOGRAPHY_TYPES = {
  Ocean: {
    id: "Ocean",
    label: "Ocean Coastline",
    canBuildPort: true,
    tradeBonus: 1.35,
    tourismBonus: 1.25,
    landValueBonus: 18,
    expansionCostMult: 1.05,
    bonuses: ["+ International Ports", "+ Shipbuilding & Cruise Tourism", "+ Luxury Waterfront Housing", "+ Faster Global Sea Trade"]
  },
  River: {
    id: "River",
    label: "River Valley",
    canBuildPort: true,
    tradeBonus: 1.2,
    tourismBonus: 1.12,
    landValueBonus: 12,
    expansionCostMult: 0.95,
    bonuses: ["+ Fresh Water Supply", "+ Fertile Farming", "+ River Ports & Barge Trade", "+ Higher Riverfront Land Value"]
  },
  Lake: {
    id: "Lake",
    label: "Lake District",
    canBuildPort: false,
    tradeBonus: 1.05,
    tourismBonus: 1.22,
    landValueBonus: 14,
    expansionCostMult: 1.0,
    bonuses: ["+ Lakefront Estates", "+ High Recreation & Tourism", "+ Clean Freshwater Fishery"]
  },
  Mountains: {
    id: "Mountains",
    label: "Mountain Highlands",
    canBuildPort: false,
    tradeBonus: 0.9,
    tourismBonus: 1.3,
    landValueBonus: 10,
    expansionCostMult: 1.35,
    bonuses: ["+ Rich Ore & Rare Mineral Mining", "+ Scenic Alpine Tourism", "- Expensive Construction (+35%)"]
  },
  Forest: {
    id: "Forest",
    label: "Timberland Forest",
    canBuildPort: false,
    tradeBonus: 1.0,
    tourismBonus: 1.15,
    landValueBonus: 8,
    expansionCostMult: 1.0,
    bonuses: ["+ Logging & Furniture Industry", "+ Clean Environment (+15%)", "+ High Park Attractiveness"]
  },
  Plains: {
    id: "Plains",
    label: "Fertile Plains",
    canBuildPort: false,
    tradeBonus: 1.1,
    tourismBonus: 0.95,
    landValueBonus: 4,
    expansionCostMult: 0.8,
    bonuses: ["+ Cheap Construction (-20%)", "+ Abundant Agriculture", "+ Rapid Population & Rail Growth"]
  },
  Landlocked: {
    id: "Landlocked",
    label: "Inland Basin",
    canBuildPort: false,
    tradeBonus: 0.95,
    tourismBonus: 0.95,
    landValueBonus: 2,
    expansionCostMult: 0.88,
    bonuses: ["+ Affordable Housing & Industrial Land", "+ Strong Rail Logistics & Tech Manufacturing", "- No Sea Ports"]
  }
};

export const CLIMATES = [
  { id: "Temperate", label: "Temperate", farmMult: 1.15, energyMult: 1.0, tourismMult: 1.1 },
  { id: "Mediterranean", label: "Mediterranean", farmMult: 1.1, energyMult: 0.9, tourismMult: 1.3 },
  { id: "Tropical", label: "Tropical", farmMult: 1.25, energyMult: 1.1, tourismMult: 1.25 },
  { id: "Continental", label: "Continental", farmMult: 1.05, energyMult: 1.15, tourismMult: 1.0 },
  { id: "Desert", label: "Arid Desert", farmMult: 0.55, energyMult: 1.25, tourismMult: 0.95, solarBonus: 1.5 },
  { id: "Cold", label: "Subarctic Cold", farmMult: 0.65, energyMult: 1.35, tourismMult: 0.9 }
];

// 26 Resources (Part 7)
export const RESOURCES = [
  // Primary
  { id: "food", name: "Food & Grain", tier: "Primary", basePrice: 28, unit: "tons", perishable: true },
  { id: "fish", name: "Seafood", tier: "Primary", basePrice: 36, unit: "tons", perishable: true },
  { id: "wood", name: "Timber", tier: "Primary", basePrice: 32, unit: "tons", perishable: false },
  { id: "stone", name: "Stone", tier: "Primary", basePrice: 24, unit: "tons", perishable: false },
  { id: "coal", name: "Coal", tier: "Primary", basePrice: 42, unit: "tons", perishable: false },
  { id: "iron", name: "Iron Ore", tier: "Primary", basePrice: 54, unit: "tons", perishable: false },
  { id: "copper", name: "Copper Ore", tier: "Primary", basePrice: 68, unit: "tons", perishable: false },
  { id: "oil", name: "Crude Oil", tier: "Primary", basePrice: 78, unit: "bbl", perishable: false },
  { id: "gas", name: "Natural Gas", tier: "Primary", basePrice: 52, unit: "m³", perishable: false },
  { id: "water", name: "Fresh Water", tier: "Primary", basePrice: 14, unit: "kL", perishable: false },
  { id: "minerals", name: "Rare Minerals", tier: "Primary", basePrice: 165, unit: "tons", perishable: false },
  // Secondary
  { id: "steel", name: "Refined Steel", tier: "Secondary", basePrice: 120, unit: "tons", inputs: ["iron", "coal"] },
  { id: "concrete", name: "Concrete", tier: "Secondary", basePrice: 65, unit: "tons", inputs: ["stone", "water"] },
  { id: "glass", name: "Industrial Glass", tier: "Secondary", basePrice: 82, unit: "tons", inputs: ["stone", "gas"] },
  { id: "fuel", name: "Refined Fuel", tier: "Secondary", basePrice: 110, unit: "bbl", inputs: ["oil"] },
  { id: "medicine", name: "Pharmaceuticals", tier: "Secondary", basePrice: 240, unit: "crates", inputs: ["water", "food"] },
  { id: "electronics", name: "Electronics", tier: "Secondary", basePrice: 290, unit: "crates", inputs: ["copper", "glass"] },
  { id: "machinery", name: "Heavy Machinery", tier: "Secondary", basePrice: 340, unit: "units", inputs: ["steel", "copper"] },
  { id: "vehicles", name: "Motor Vehicles", tier: "Secondary", basePrice: 480, unit: "units", inputs: ["steel", "electronics"] },
  { id: "luxury", name: "Luxury Goods", tier: "Secondary", basePrice: 690, unit: "crates", inputs: ["wood", "minerals"] },
  // Advanced
  { id: "chips", name: "Semiconductors", tier: "Advanced", basePrice: 620, unit: "wafers", inputs: ["minerals", "electronics"] },
  { id: "ai_hw", name: "AI Compute Racks", tier: "Advanced", basePrice: 1150, unit: "racks", inputs: ["chips", "electronics"] },
  { id: "batteries", name: "Grid Batteries", tier: "Advanced", basePrice: 510, unit: "packs", inputs: ["minerals", "copper"] },
  { id: "solar", name: "Solar Arrays", tier: "Advanced", basePrice: 420, unit: "panels", inputs: ["glass", "chips"] },
  { id: "robots", name: "Industrial Robots", tier: "Advanced", basePrice: 980, unit: "units", inputs: ["chips", "machinery"] },
  { id: "fusion", name: "Fusion Cores", tier: "Advanced", basePrice: 2400, unit: "cores", inputs: ["minerals", "ai_hw"] }
];

// 14 Infrastructure Categories (Levels 1 to 10) (Part 3)
export const INFRASTRUCTURE_CATEGORIES = [
  {
    id: "roads",
    name: "Road Network",
    icon: "train",
    baseCost: 28000,
    baseMaint: 450,
    buildDays: 25,
    desc: "Controls travel speed, trade transport costs, traffic congestion, and business logistics."
  },
  {
    id: "water",
    name: "Water System",
    icon: "anchor",
    baseCost: 24000,
    baseMaint: 380,
    buildDays: 20,
    desc: "Clean drinking water & industrial supply. Prevents disease and supports population growth."
  },
  {
    id: "electricity",
    name: "Power Grid",
    icon: "bolt",
    baseCost: 35000,
    baseMaint: 620,
    buildDays: 30,
    desc: "Supplies electricity to homes and factories. Shortages cripple industrial output."
  },
  {
    id: "internet",
    name: "Digital & Fiber Grid",
    icon: "chip",
    baseCost: 32000,
    baseMaint: 500,
    buildDays: 24,
    desc: "Boosts technology companies, remote work, research output, and corporate efficiency."
  },
  {
    id: "healthcare",
    name: "Healthcare System",
    icon: "heart",
    baseCost: 40000,
    baseMaint: 780,
    buildDays: 32,
    desc: "Clinics, Hospitals & Research Medical Centres. Raises life expectancy and epidemic resilience."
  },
  {
    id: "education",
    name: "Education & Universities",
    icon: "book",
    baseCost: 38000,
    baseMaint: 720,
    buildDays: 30,
    desc: "Primary Schools to Research Universities. Drives innovation, skilled workers, and salaries."
  },
  {
    id: "police",
    name: "Police & Security",
    icon: "shield",
    baseCost: 26000,
    baseMaint: 540,
    buildDays: 20,
    desc: "Reduces crime, corruption, and business theft. Safe cities attract luxury residents and HQs."
  },
  {
    id: "fire",
    name: "Fire & Rescue",
    icon: "shield",
    baseCost: 22000,
    baseMaint: 420,
    buildDays: 18,
    desc: "Protects housing, forests, and industrial zones from devastating fires and accidents."
  },
  {
    id: "garbage",
    name: "Waste & Recycling",
    icon: "leaf",
    baseCost: 20000,
    baseMaint: 360,
    buildDays: 18,
    desc: "Maintains city cleanliness. Poor waste collection triggers pollution and tourist flight."
  },
  {
    id: "sewage",
    name: "Sewage & Water Treatment",
    icon: "globe",
    baseCost: 23000,
    baseMaint: 390,
    buildDays: 22,
    desc: "Protects river/coastal water quality, public health, and environmental ratings."
  },
  {
    id: "parks",
    name: "Parks & Botanical Gardens",
    icon: "leaf",
    baseCost: 19000,
    baseMaint: 310,
    buildDays: 16,
    desc: "Elevates citizen happiness, district land values, air cleanliness, and tourism."
  },
  {
    id: "transit",
    name: "Public Transit Network",
    icon: "train",
    baseCost: 42000,
    baseMaint: 690,
    buildDays: 35,
    desc: "Bus routes, Metro lines & commuter rail. Slashes traffic and boosts worker mobility."
  },
  {
    id: "government",
    name: "Civic Administration",
    icon: "crown",
    baseCost: 30000,
    baseMaint: 480,
    buildDays: 25,
    desc: "Town Hall & Ministry complexes. Improves tax collection efficiency and lowers corruption."
  },
  {
    id: "emergency",
    name: "Disaster Command",
    icon: "bolt",
    baseCost: 29000,
    baseMaint: 450,
    buildDays: 22,
    desc: "Flood barriers, early warning sensors, and rapid emergency response teams."
  }
];

// Power Plant Sources (Part 3 & 8)
export const POWER_SOURCES = [
  { id: "Coal", name: "Coal Power", pollution: 28, costMult: 0.8, era: 0 },
  { id: "Oil", name: "Oil Thermal", pollution: 22, costMult: 0.95, era: 0 },
  { id: "Gas", name: "Natural Gas", pollution: 13, costMult: 1.0, era: 1 },
  { id: "Hydro", name: "Hydroelectric", pollution: 2, costMult: 1.1, era: 1 },
  { id: "Nuclear", name: "Nuclear Fission", pollution: 3, costMult: 1.25, era: 2 },
  { id: "Solar", name: "Solar Farms", pollution: 0, costMult: 0.9, era: 3 },
  { id: "Wind", name: "Offshore Wind", pollution: 0, costMult: 0.92, era: 3 },
  { id: "Fusion", name: "Tokamak Fusion", pollution: 0, costMult: 0.65, era: 4 }
];

// Monuments (Part 3 & 9)
export const MONUMENTS = [
  { id: "founders_statue", name: "Founder's Statue", cost: 65000, buildDays: 30, prestige: 12, tourism: 8, landValue: 4, desc: "Honours the settlement's founding pioneers." },
  { id: "clock_tower", name: "Historic Clock Tower", cost: 120000, buildDays: 40, prestige: 18, tourism: 14, landValue: 6, desc: "Iconic civic landmark in the Old Town square." },
  { id: "grand_fountain", name: "Grand Imperial Fountain", cost: 180000, buildDays: 45, prestige: 22, tourism: 20, landValue: 8, desc: "Marble plaza fountain attracting visitors and luxury cafés." },
  { id: "victory_monument", name: "Victory Obelisk", cost: 320000, buildDays: 60, prestige: 32, tourism: 28, landValue: 10, desc: "Towering monument celebrating national resilience." },
  { id: "royal_gardens", name: "Royal Botanical Gardens", cost: 480000, buildDays: 70, prestige: 40, tourism: 42, landValue: 14, desc: "World-renowned glasshouses and terraced gardens." },
  { id: "liberty_monument", name: "Colossus of Commerce", cost: 850000, buildDays: 90, prestige: 60, tourism: 65, landValue: 18, desc: "Beacon of global trade and international prosperity." }
];

// 12 City Districts (Part 3)
export const DEFAULT_DISTRICTS = [
  { id: "downtown", name: "Downtown Core", type: "Commercial", landValue: 62, density: "High", housingShare: 0.16 },
  { id: "old_town", name: "Historic Old Town", type: "Historic", landValue: 58, density: "Medium", housingShare: 0.12 },
  { id: "suburbs", name: "Greenview Suburbs", type: "Residential", landValue: 48, density: "Low", housingShare: 0.24 },
  { id: "industrial", name: "Ironworks Industrial Zone", type: "Industrial", landValue: 32, density: "Medium", housingShare: 0.08 },
  { id: "harbour", name: "Harbour & Logistics Quarter", type: "Trade", landValue: 54, density: "Medium", housingShare: 0.10 },
  { id: "university", name: "University & Cultural Quarter", type: "Academic", landValue: 66, density: "Medium", housingShare: 0.10 },
  { id: "financial", name: "Crown Financial District", type: "Financial", landValue: 78, density: "High", housingShare: 0.08 },
  { id: "waterfront", name: "Azure Luxury Waterfront", type: "Luxury", landValue: 84, density: "Medium", housingShare: 0.06 },
  { id: "tech_park", name: "Silicon Innovation Park", type: "Technology", landValue: 74, density: "Medium", housingShare: 0.06 }
];

// 12 Laws & Policies (Part 4)
export const POLICIES = [
  {
    id: "recycling",
    name: "Mandatory Recycling Program",
    costPerCapita: 1.8,
    effects: { cleanliness: +12, pollution: -10, happiness: +2, businessScore: -2 },
    desc: "+12 Cleanliness, -10 Pollution, +2 Happiness; adds modest municipal processing cost."
  },
  {
    id: "free_transit",
    name: "Free Public Transport",
    costPerCapita: 3.5,
    effects: { happiness: +7, pollution: -8, traffic: -18, approval: +5 },
    desc: "Eliminates transit fares. +7 Happiness, -18% Traffic, -8 Pollution; funded by Treasury."
  },
  {
    id: "tourism_promo",
    name: "Global Tourism Campaign",
    costPerCapita: 2.4,
    effects: { tourismMult: 1.28, prestige: +6, traffic: +5 },
    desc: "+28% Tourist arrivals and +6 Prestige; slightly increases city traffic."
  },
  {
    id: "industrial_exp",
    name: "Industrial Zoning Deregulation",
    costPerCapita: 0.5,
    effects: { industrialOutput: 1.22, pollution: +14, happiness: -5, businessScore: +10 },
    desc: "+22% Industrial output and strong factory attraction, but +14 Pollution and -5 Happiness."
  },
  {
    id: "green_energy",
    name: "Clean Energy Mandate",
    costPerCapita: 2.8,
    effects: { pollution: -16, cleanliness: +10, happiness: +5, industrialOutput: 0.94 },
    desc: "-16 Pollution and +10 Cleanliness; raises compliance costs for heavy industry (-6% output)."
  },
  {
    id: "affordable_housing",
    name: "Social & Affordable Housing Act",
    costPerCapita: 3.2,
    effects: { housingAffordability: +18, happiness: +6, landValue: -5, popGrowthBonus: 1.15 },
    desc: "Keeps rent affordable and attracts young families (+15% growth); slightly cools luxury land values."
  },
  {
    id: "historic_pres",
    name: "Historic Heritage Preservation",
    costPerCapita: 1.4,
    effects: { tourismMult: 1.18, prestige: +8, constructionCostMult: 1.12 },
    desc: "Protects historic architecture (+18% Tourism, +8 Prestige), but increases construction costs by 12%."
  },
  {
    id: "tech_incentives",
    name: "R&D & Tech Startup Grants",
    costPerCapita: 3.0,
    effects: { innovationBonus: +16, researchMult: 1.25, businessScore: +8 },
    desc: "+25% Research speed and +16 Innovation rating; attracts software, AI, and robotics corporations."
  },
  {
    id: "public_wifi",
    name: "Municipal High-Speed Wi-Fi",
    costPerCapita: 1.6,
    effects: { happiness: +4, innovationBonus: +6, businessScore: +4 },
    desc: "City-wide free wireless connectivity. Boosts citizen satisfaction and digital commerce."
  },
  {
    id: "business_relief",
    name: "Corporate Tax Holiday Package",
    costPerCapita: 2.0,
    effects: { businessScore: +16, corporateTaxMult: 0.78, approval: -3 },
    desc: "Strongly attracts company expansions and HQs (+16 score), but reduces corporate tax revenue by 22%."
  },
  {
    id: "luxury_tax",
    name: "Ultra-Luxury Mansion Levy",
    costPerCapita: -1.5, // generates extra revenue
    effects: { approval: +3, luxuryDemand: -14, revenueBonus: 1.06 },
    desc: "Raises extra treasury revenue from luxury estates (+6%), but reduces billionaire & celebrity attraction."
  },
  {
    id: "smart_traffic",
    name: "Low-Emission Speed & Transit Zones",
    costPerCapita: 1.0,
    effects: { crime: -3, pollution: -7, traffic: -12, happiness: +2 },
    desc: "Calms downtown traffic (-12%), lowers accidents and emissions."
  }
];

// 10 Tax Categories (Part 4)
export const TAX_CATEGORIES = [
  { id: "residential", name: "Residential Income Tax", defaultRate: 11, min: 2, max: 30, desc: "Direct tax on citizen wages. High rates reduce happiness and spur emigration." },
  { id: "commercial", name: "Commercial Sales Tax", defaultRate: 10, min: 2, max: 25, desc: "Tax on retail, hospitality, and service businesses." },
  { id: "industrial", name: "Industrial Production Tax", defaultRate: 12, min: 2, max: 28, desc: "Tax on factories, mining, and manufacturing output." },
  { id: "property", name: "Property Assessment Tax", defaultRate: 8, min: 1, max: 20, desc: "Annual levy on residential and commercial real estate values." },
  { id: "luxury", name: "Luxury Property & Goods Tax", defaultRate: 14, min: 2, max: 35, desc: "Tax on estates, yachts, and luxury goods." },
  { id: "tourism", name: "Hotel & Visitor Levy", defaultRate: 9, min: 0, max: 25, desc: "Collected from visiting tourists and hotels." },
  { id: "import", name: "Import Tariff", defaultRate: 6, min: 0, max: 25, desc: "Tariff on imported commodities. Raises revenue but increases input costs." },
  { id: "export", name: "Export Duty", defaultRate: 4, min: 0, max: 20, desc: "Duty on exported surplus goods. High duties hurt export competitiveness." },
  { id: "corporate", name: "Corporate Headquarters Tax", defaultRate: 13, min: 3, max: 30, desc: "Key factor when companies choose where to locate their Headquarters." },
  { id: "land", name: "Land Value Tax", defaultRate: 7, min: 1, max: 20, desc: "Encourages efficient land use across high-value city districts." }
];

// 12 Department Budgets (Part 4)
export const BUDGET_DEPARTMENTS = [
  { id: "roads", name: "Road Maintenance", defaultPct: 100 },
  { id: "healthcare", name: "Public Healthcare", defaultPct: 100 },
  { id: "education", name: "Schools & Universities", defaultPct: 100 },
  { id: "police", name: "Police & Justice", defaultPct: 100 },
  { id: "fire", name: "Fire & Rescue", defaultPct: 100 },
  { id: "garbage", name: "Sanitation & Waste", defaultPct: 100 },
  { id: "parks", name: "Parks & Culture", defaultPct: 100 },
  { id: "tourism", name: "Tourism Bureau", defaultPct: 100 },
  { id: "research", name: "Science & Research Grants", defaultPct: 100 },
  { id: "transport", name: "Transit Operations", defaultPct: 100 },
  { id: "emergency", name: "Emergency Reserve Fund", defaultPct: 100 },
  { id: "admin", name: "Government Administration", defaultPct: 100 }
];

// City Council Personalities (Part 4)
export const COUNCIL_ARCHETYPES = [
  { role: "Pro-Business Councilor", focus: "Corporate growth & low business taxes", icon: "skyscraper" },
  { role: "Environmental Advocate", focus: "Clean air, parks & renewable energy", icon: "leaf" },
  { role: "Education Reformer", focus: "Universities, schools & research", icon: "book" },
  { role: "Public Health Champion", focus: "Hospitals, clean water & sewage", icon: "heart" },
  { role: "Industrial Union Representative", focus: "Factory jobs & rail freight", icon: "gear" },
  { role: "Transit & Urban Planner", focus: "Buses, high-speed rail & housing", icon: "train" },
  { role: "Fiscal Conservative", focus: "Balanced budget, AAA credit & low debt", icon: "crown" }
];

// 5 Technology Eras & Research Tree (Part 8)
export const TECH_ERAS = [
  {
    index: 0,
    id: "early_industrial",
    name: "Early Industrial Era",
    yearHint: "2026–2038",
    minTechs: 0,
    desc: "Mechanised factories, steam & coal power, early railways, and foundational civic institutions.",
    techs: [
      { id: "steam_rail", name: "Steam & Early Freight Rail", category: "Transportation", cost: 120, bonus: "+15% Rail Trade Capacity", titleAward: "Pioneer of the Iron Railway" },
      { id: "coal_grid", name: "High-Pressure Coal Turbines", category: "Energy", cost: 100, bonus: "+15% Power Output", titleAward: null },
      { id: "telegraph_net", name: "Municipal Telegraph & Post", category: "Communication", cost: 110, bonus: "+8% Business Efficiency", titleAward: null },
      { id: "bessemer_steel", name: "Modern Steelworks Process", category: "Industry", cost: 140, bonus: "+20% Steel Output", titleAward: "Forge of the Nation" }
    ]
  },
  {
    index: 1,
    id: "modern",
    name: "Modern Era",
    yearHint: "2039–2054",
    minTechs: 3,
    desc: "Asphalt highways, commercial aviation, container shipping, modern universities, and mass consumer goods.",
    techs: [
      { id: "modern_highways", name: "Asphalt Expressways", category: "Transportation", cost: 260, bonus: "-18% Road Transport Cost", titleAward: null },
      { id: "container_ports", name: "Automated Container Shipping", category: "Logistics", cost: 300, bonus: "+30% Sea Trade Volume", titleAward: "Global Container Gateway" },
      { id: "commercial_aviation", name: "Commercial Jet Aviation", category: "Transportation", cost: 340, bonus: "+25% International Tourism", titleAward: "Wings of the Continent" },
      { id: "modern_medicine", name: "Antibiotics & Surgical Suites", category: "Healthcare", cost: 280, bonus: "+12 Healthcare Efficiency", titleAward: "Citadel of Modern Medicine" }
    ]
  },
  {
    index: 2,
    id: "information",
    name: "Information Era",
    yearHint: "2055–2072",
    minTechs: 7,
    desc: "Fiber optic internet, semiconductors, cloud data centres, high-speed rail, and the global knowledge economy.",
    techs: [
      { id: "fiber_backbone", name: "Gigabit Fiber Optic Grid", category: "Communication", cost: 520, bonus: "+25 Innovation Rating", titleAward: "First Gigabit Metropolis" },
      { id: "semiconductors", name: "Sub-Nanometer Lithography", category: "Computing", cost: 600, bonus: "Unlocks Chip & AI Hardware Boom", titleAward: "Silicon Crown of the World" },
      { id: "high_speed_rail", name: "Maglev High-Speed Rail", category: "Transportation", cost: 580, bonus: "+30% Regional Commute & Trade", titleAward: "Birthplace of Maglev Transit" },
      { id: "cloud_datacenters", name: "Hyperscale Cloud Computing", category: "Computing", cost: 550, bonus: "+20% Corporate Profit Margin", titleAward: null }
    ]
  },
  {
    index: 3,
    id: "sustainable",
    name: "Sustainable Era",
    yearHint: "2073–2092",
    minTechs: 11,
    desc: "Solar & wind megafarms, grid-scale batteries, carbon capture, electric transit, and green architecture.",
    techs: [
      { id: "smart_grid", name: "AI Renewable Smart Grid", category: "Energy", cost: 880, bonus: "-25% Power Maintenance & Pollution", titleAward: "First Carbon-Neutral Metropolis" },
      { id: "autonomous_buses", name: "Autonomous Electric Bus Fleet", category: "Transportation", cost: 820, bonus: "+25 Transit Satisfaction", titleAward: "Birthplace of the Autonomous Bus Network" },
      { id: "carbon_capture", name: "Direct Air Carbon Capture", category: "Environmental", cost: 920, bonus: "-35 City Pollution", titleAward: "The Green Capital of the World" },
      { id: "vertical_farms", name: "Hydroponic Vertical Agriculture", category: "Agriculture", cost: 800, bonus: "+50% Local Food Supply", titleAward: null }
    ]
  },
  {
    index: 4,
    id: "future",
    name: "Future Era",
    yearHint: "2093+",
    minTechs: 15,
    desc: "Experimental fusion energy, autonomous drone logistics, android robotics, and hyper-connected Smart Cities.",
    techs: [
      { id: "fusion_reactor", name: "Commercial Tokamak Fusion", category: "Energy", cost: 1400, bonus: "Unlimited Clean Energy & +40 Prestige", titleAward: "First City to Master Fusion Energy" },
      { id: "drone_logistics", name: "Autonomous Sky-Drone Freight", category: "Logistics", cost: 1250, bonus: "-40% All Trade Transport Costs", titleAward: "Skyport of the Future" },
      { id: "smart_city_os", name: "Civic AI Governance Core", category: "AI", cost: 1350, bonus: "+20% All Service Efficiency", titleAward: "The World's First Smart City" },
      { id: "android_robotics", name: "General Purpose Robotics", category: "Robotics", cost: 1500, bonus: "+35% Industrial & Construction Speed", titleAward: "Capital of the Robotic Age" }
    ]
  }
];

// Signature Canon Companies from the GDD (Part 5)
export const SIGNATURE_COMPANIES = [
  {
    name: "Royal Yacht Company",
    logo: "crown",
    primaryColor: "#f5c542",
    secondaryColor: "#38bdf8",
    slogan: "Crafting the Seas Since 2038",
    industry: "Luxury Shipbuilding",
    personality: "Luxury",
    founderName: "Oliver Hart",
    ceoName: "Sophia Hart",
    foundedYear: 2026,
    employees: 8400,
    marketValue: 1850000000,
    revenue: 420000000,
    profit: 96000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 184.5,
    products: ["Ocean Crown", "Imperial 900", "Royal Wave", "Monarch Series"],
    cityTitle: "Home of Royal Yacht Company",
    requiresWater: true
  },
  {
    name: "Reyes Rolls",
    logo: "wheel",
    primaryColor: "#e879f9",
    secondaryColor: "#facc15",
    slogan: "Excellence in Every Mile",
    industry: "Luxury Cars",
    personality: "Luxury",
    founderName: "Daniel Reyes",
    ceoName: "Daniel Reyes",
    foundedYear: 2026,
    employees: 9200,
    marketValue: 2200000000,
    revenue: 540000000,
    profit: 118000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 212.0,
    products: ["Phantom", "Aurora", "Majestic", "Titan V12"],
    cityTitle: "Land of Reyes Rolls",
    requiresWater: false
  },
  {
    name: "Titan Robotics",
    logo: "gear",
    primaryColor: "#38bdf8",
    secondaryColor: "#94a3b8",
    slogan: "Automating Tomorrow's World",
    industry: "Robotics",
    personality: "Innovative",
    founderName: "Emma Valen",
    ceoName: "Emma Valen",
    foundedYear: 2026,
    employees: 6800,
    marketValue: 1640000000,
    revenue: 390000000,
    profit: 88000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 156.4,
    products: ["Atlas Arm X", "ForgeBot 9", "AutoPort Crane", "Synapse Core"],
    cityTitle: "Birthplace of Titan Robotics",
    requiresWater: false
  },
  {
    name: "Blue Harbor Shipyards",
    logo: "anchor",
    primaryColor: "#0ea5e9",
    secondaryColor: "#e2e8f0",
    slogan: "Steel Hulls for Seven Seas",
    industry: "Shipbuilding",
    personality: "Industrial",
    founderName: "Victor Rhodes",
    ceoName: "Victor Rhodes",
    foundedYear: 2026,
    employees: 7500,
    marketValue: 980000000,
    revenue: 310000000,
    profit: 52000000,
    reputation: 4,
    isPublic: true,
    sharePrice: 88.2,
    products: ["Goliath Freighter", "Pacific Tanker", "Harbor Tug IV"],
    cityTitle: "World's Largest Shipyard",
    requiresWater: true
  },
  {
    name: "Atlas Rail",
    logo: "train",
    primaryColor: "#f97316",
    secondaryColor: "#fde047",
    slogan: "Connecting Continents by Steel",
    industry: "Railways",
    personality: "Government Focused",
    founderName: "Noah Sterling",
    ceoName: "Noah Sterling",
    foundedYear: 2026,
    employees: 11200,
    marketValue: 1420000000,
    revenue: 460000000,
    profit: 74000000,
    reputation: 4,
    isPublic: true,
    sharePrice: 119.0,
    products: ["Express X", "MetroLine", "CargoMax", "Bullet Sovereign"],
    cityTitle: "Capital of Atlas Rail",
    requiresWater: false
  },
  {
    name: "Pixel Microsystems",
    logo: "chip",
    primaryColor: "#22c55e",
    secondaryColor: "#a855f7",
    slogan: "Thinking in Silicon",
    industry: "Computers",
    personality: "Innovative",
    founderName: "Lucas Mori",
    ceoName: "Lucas Mori",
    foundedYear: 2026,
    employees: 5900,
    marketValue: 1920000000,
    revenue: 410000000,
    profit: 105000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 198.0,
    products: ["CrownCPU 64", "PixelBlade Server", "NanoWafer Z"],
    cityTitle: "Silicon Coast",
    requiresWater: false
  },
  {
    name: "Nova Aerospace",
    logo: "airplane",
    primaryColor: "#6366f1",
    secondaryColor: "#f43f5e",
    slogan: "Beyond the Stratosphere",
    industry: "Space Technology",
    personality: "Aggressive",
    founderName: "Adrian Foster",
    ceoName: "Adrian Foster",
    foundedYear: 2026,
    employees: 6400,
    marketValue: 1750000000,
    revenue: 380000000,
    profit: 79000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 171.5,
    products: ["StarLiner 800", "OrbitCargo", "IonBooster V"],
    cityTitle: "World Headquarters of Nova Aerospace",
    requiresWater: false
  },
  {
    name: "SkyJet Airways",
    logo: "airplane",
    primaryColor: "#38bdf8",
    secondaryColor: "#f59e0b",
    slogan: "The World Within Reach",
    industry: "Aircraft",
    personality: "Global",
    founderName: "Ava Bennett",
    ceoName: "Ava Bennett",
    foundedYear: 2026,
    employees: 8900,
    marketValue: 1120000000,
    revenue: 490000000,
    profit: 61000000,
    reputation: 4,
    isPublic: true,
    sharePrice: 94.0,
    products: ["SkyJet Clipper", "Global First Class", "AeroFreight"],
    cityTitle: "Global Aviation Hub",
    requiresWater: false
  },
  {
    name: "CloudWave Telecom",
    logo: "globe",
    primaryColor: "#06b6d4",
    secondaryColor: "#a5f3fc",
    slogan: "Every Voice, Every Continent",
    industry: "Telecommunications",
    personality: "Global",
    founderName: "Maya Collins",
    ceoName: "Maya Collins",
    foundedYear: 2026,
    employees: 7800,
    marketValue: 1340000000,
    revenue: 370000000,
    profit: 82000000,
    reputation: 4,
    isPublic: true,
    sharePrice: 128.0,
    products: ["WaveFiber 10G", "SkyLink Sat", "OmniMesh"],
    cityTitle: "Digital Backbone Capital",
    requiresWater: false
  },
  {
    name: "IronPeak Steel",
    logo: "mountain",
    primaryColor: "#ef4444",
    secondaryColor: "#fca5a5",
    slogan: "Forged in Mountain Fire",
    industry: "Steel",
    personality: "Industrial",
    founderName: "Henry Brooks",
    ceoName: "Henry Brooks",
    foundedYear: 2026,
    employees: 10500,
    marketValue: 1080000000,
    revenue: 440000000,
    profit: 64000000,
    reputation: 4,
    isPublic: true,
    sharePrice: 76.5,
    products: ["TitanBeam Alloy", "RailSteel Pro", "ArmorPlate X"],
    cityTitle: "Steel Capital",
    requiresWater: false
  },
  {
    name: "Silver Horizon Hotels",
    logo: "skyscraper",
    primaryColor: "#eab308",
    secondaryColor: "#fef08a",
    slogan: "Hospitality Above the Clouds",
    industry: "Hotels",
    personality: "Luxury",
    founderName: "Sophia Carter",
    ceoName: "Sophia Carter",
    foundedYear: 2026,
    employees: 9600,
    marketValue: 1290000000,
    revenue: 360000000,
    profit: 78000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 142.0,
    products: ["Horizon Grand Resort", "Royal Suite Towers", "Azure Spa"],
    cityTitle: "Luxury Coast",
    requiresWater: false
  },
  {
    name: "Lighthouse Energy",
    logo: "leaf",
    primaryColor: "#10b981",
    secondaryColor: "#fde047",
    slogan: "Clean Power for Centuries",
    industry: "Renewable Energy",
    personality: "Eco-Friendly",
    founderName: "Isabella Hayes",
    ceoName: "Isabella Hayes",
    foundedYear: 2026,
    employees: 5200,
    marketValue: 1190000000,
    revenue: 295000000,
    profit: 69000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 134.0,
    products: ["Helios Solar Array", "GaleTurbine V", "GridVault Battery"],
    cityTitle: "The Green Capital",
    requiresWater: false
  },
  {
    name: "Valen Robotics",
    logo: "chip",
    primaryColor: "#a855f7",
    secondaryColor: "#38bdf8",
    slogan: "Precision Minds, Tireless Hands",
    industry: "Artificial Intelligence",
    personality: "Innovative",
    founderName: "Emma Valen",
    ceoName: "Charlotte Mason",
    foundedYear: 2026,
    employees: 4800,
    marketValue: 1510000000,
    revenue: 330000000,
    profit: 91000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 165.0,
    products: ["ValenOS Neural", "MediBot Surgical", "CivicMind AI"],
    cityTitle: "AI Capital of the World",
    requiresWater: false
  },
  {
    name: "Crown Imperial Bank",
    logo: "diamond",
    primaryColor: "#f5c542",
    secondaryColor: "#ffffff",
    slogan: "Financing Nations Since 1998",
    industry: "Banking",
    personality: "Conservative",
    founderName: "Henry Brooks",
    ceoName: "Henry Brooks",
    foundedYear: 2026,
    employees: 12400,
    marketValue: 2650000000,
    revenue: 680000000,
    profit: 195000000,
    reputation: 5,
    isPublic: true,
    sharePrice: 248.0,
    products: ["Sovereign Bonds", "Municipal Infrastructure Credit", "Crown Wealth Reserve"],
    cityTitle: "World Financial Hub",
    requiresWater: false
  }
];

export const INDUSTRIES_LIST = [
  { name: "Luxury Shipbuilding", logo: "crown", resourceIn: "steel", resourceOut: "luxury" },
  { name: "Luxury Cars", logo: "wheel", resourceIn: "steel", resourceOut: "vehicles" },
  { name: "Robotics", logo: "gear", resourceIn: "chips", resourceOut: "robots" },
  { name: "Shipbuilding", logo: "anchor", resourceIn: "steel", resourceOut: "machinery" },
  { name: "Railways", logo: "train", resourceIn: "steel", resourceOut: "machinery" },
  { name: "Computers", logo: "chip", resourceIn: "minerals", resourceOut: "chips" },
  { name: "Space Technology", logo: "airplane", resourceIn: "ai_hw", resourceOut: "fusion" },
  { name: "Telecommunications", logo: "globe", resourceIn: "electronics", resourceOut: "chips" },
  { name: "Steel", logo: "mountain", resourceIn: "iron", resourceOut: "steel" },
  { name: "Hotels", logo: "skyscraper", resourceIn: "food", resourceOut: "luxury" },
  { name: "Renewable Energy", logo: "leaf", resourceIn: "glass", resourceOut: "solar" },
  { name: "Artificial Intelligence", logo: "chip", resourceIn: "chips", resourceOut: "ai_hw" },
  { name: "Banking", logo: "diamond", resourceIn: "electronics", resourceOut: "luxury" },
  { name: "Pharmaceuticals", logo: "heart", resourceIn: "water", resourceOut: "medicine" },
  { name: "Agriculture & Food", logo: "leaf", resourceIn: "water", resourceOut: "food" },
  { name: "Mining & Minerals", logo: "mountain", resourceIn: "coal", resourceOut: "minerals" },
  { name: "Construction", logo: "skyscraper", resourceIn: "stone", resourceOut: "concrete" },
  { name: "Shipping & Logistics", logo: "anchor", resourceIn: "fuel", resourceOut: "machinery" }
];

// Procedural Name Pools
export const NAME_POOLS = {
  continents: [
    { name: "Aurelia", theme: "Highly Urbanized Continent" },
    { name: "Valoria", theme: "Industrial Continent" },
    { name: "Solaria", theme: "Tourism Continent" },
    { name: "Verdania", theme: "Agricultural Continent" },
    { name: "Kaelen Peaks", theme: "Mountainous Continent" },
    { name: "Sapphire Archipelago", theme: "Island Chain" }
  ],
  countryPrefixes: ["Republic of", "Kingdom of", "Federation of", "Grand Duchy of", "Commonwealth of", "United Provinces of"],
  countryRoots: ["Aurelia", "Vesperia", "Nordmark", "Calradia", "Solvang", "Oakhaven", "Maris", "Castellan", "Veridia", "Korsova", "Belmont", "Zandora", "Edelweiss", "Caledon", "Thalassia", "Draken"],
  cityPrefixes: ["Port", "New", "Saint", "Fort", "Mount", "Lake", "Grand", "East", "West", "North", "South", "Royal", "Silver", "Golden", "Crystal", "Iron"],
  cityRoots: [
    "Azure", "Haven", "Crest", "Harbor", "Ford", "Bridge", "Vale", "brook", "spire", "gate",
    "wood", "field", "watch", "cliff", "bay", "springs", "falls", "ridge", "hollow", "beacon",
    "crown", "verge", "meadow", "cove", "summit", "point", "reach", "crossing", "anchorage", "plaza"
  ],
  firstNames: [
    "Oliver", "Emma", "Daniel", "Sophia", "Noah", "Lucas", "Ava", "Isabella", "Henry", "Maya",
    "Adrian", "Victor", "Charlotte", "Julian", "Eleanor", "Sebastian", "Clara", "Leo", "Nora", "Gabriel",
    "Elena", "Marcus", "Hannah", "Arthur", "Aria", "Felix", "Victoria", "Samuel", "Chloe", "Nathaniel",
    "Aarav", "Ananya", "Rohan", "Kavya", "Kenji", "Yuki", "Mateo", "Camila", "Liam", "Freya"
  ],
  lastNames: [
    "Hart", "Valen", "Reyes", "Carter", "Sterling", "Mori", "Bennett", "Hayes", "Brooks", "Collins",
    "Foster", "Rhodes", "Mason", "Vance", "Sinclair", "Mercer", "Kensington", "Thorne", "Lindqvist", "Moreau",
    "Deshmukh", "Verma", "Takahashi", "Navarro", "Silva", "Kowalski", "Adler", "Dubois", "shaw", "Caldwell"
  ],
  companyPrefixes: [
    "Emerald", "Oak", "Summit", "Northwind", "Aquila", "HarborLink", "Crimson", "Golden", "Vertex", "Aegis",
    "Meridian", "Solaris", "Vanguard", "Horizon", "Pinnacle", "Zenith", "Orion", "Cascade", "Cobalt", "Crescent",
    "Sovereign", "Pacific", "Alpine", "Starlight", "Redwood", "Pioneer", "Boreal", "Neptune", "Quantum", "Aethel"
  ],
  companySuffixes: [
    "Foods", "Furniture", "Construction", "Logistics", "Electronics", "Shipping", "Mining", "Motors", "BioTech", "Dynamics",
    "Industries", "Ventures", "Holdings", "Energy", "Labs", "Railways", "Aviation", "Telecom", "Robotics", "Marine"
  ]
};

// 14 Official Achievements (Part 11)
export const ACHIEVEMENTS = [
  { id: "humble_beginnings", name: "Humble Beginnings", icon: "crown", desc: "Grow your settlement into a City (Population 25,000+)." },
  { id: "million_dreams", name: "Million Dreams", icon: "skyscraper", desc: "Reach 1,000,000 citizens in your settlement." },
  { id: "billionaire_budget", name: "Billionaire Budget", icon: "diamond", desc: "Hold ◈ 1.0B or more in the city treasury." },
  { id: "innovation_nation", name: "Innovation Nation", icon: "chip", desc: "Become the #1 Most Innovative City in the world." },
  { id: "clean_future", name: "Clean Future", icon: "leaf", desc: "Achieve 95%+ Cleanliness and enter the Sustainable Era." },
  { id: "trade_empire", name: "Trade Empire", icon: "globe", desc: "Generate over ◈ 5.0M in monthly export revenue." },
  { id: "railway_king", name: "Railway King", icon: "train", desc: "Upgrade Public Transit & Rail network to Level 8+." },
  { id: "harbor_master", name: "Harbor Master", icon: "anchor", desc: "Operate a Level 6+ Port with bustling sea trade." },
  { id: "sky_high", name: "Sky High", icon: "airplane", desc: "Construct a Global Hub Airport (Level 3)." },
  { id: "corporate_magnet", name: "Corporate Magnet", icon: "skyscraper", desc: "Host 8 or more Company Headquarters in your city." },
  { id: "living_legend", name: "Living Legend", icon: "trophy", desc: "Reach #1 Overall City Ranking in the world." },
  { id: "century_mayor", name: "Century Mayor", icon: "book", desc: "Govern your city for 100 simulated years." },
  { id: "millennium_city", name: "Millennium City", icon: "crown", desc: "Reach 1,000 simulated years in a single world." },
  { id: "history_never_forgets", name: "History Never Forgets", icon: "newspaper", desc: "Record at least 50 historical archive entries & 3 Time Capsules." }
];

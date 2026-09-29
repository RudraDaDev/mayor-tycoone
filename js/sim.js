// ============================================================================
// ◈ PROJECT CROWN — Living World Simulation (vanilla JavaScript)
// Deterministic world generation; daily clock; monthly economic pulses.
// ============================================================================
import { CrownPRNG, MONTHS, dayOfYearToDate, formatCrown } from "./prng.js";
import {
  WORLD_SIZES, DIFFICULTIES, GEOGRAPHY_TYPES, CLIMATES, RESOURCES,
  INFRASTRUCTURE_CATEGORIES, DEFAULT_DISTRICTS, POLICIES, TAX_CATEGORIES,
  BUDGET_DEPARTMENTS, COUNCIL_ARCHETYPES, TECH_ERAS, SIGNATURE_COMPANIES,
  INDUSTRIES_LIST, NAME_POOLS, ACHIEVEMENTS
} from "./data.js";

const FIRST_NAMES = NAME_POOLS.firstNames;
const LAST_NAMES = NAME_POOLS.lastNames;
const CITY_TYPES = ["Village", "Town", "Port City", "Industrial City", "University City", "Tourist City", "Mining Town", "Technology City", "Capital"];
const EVENT_DEFS = [
  { id: "harvest", type: "positive", title: "A Bountiful Harvest", icon: "🌾", summary: "Favorable weather lifts regional crop yields. Food prices ease and farm exports surge.", effect: (c) => { c.happiness += 2; c.monthlyIncome *= 1.05; c.prices.food *= 0.92; } },
  { id: "festival", type: "positive", title: "Harbor Lights Festival", icon: "🎆", summary: "Visitors fill the waterfront for a week of music, food, and fireworks.", effect: (c) => { c.tourism += 8; c.happiness += 2; c.treasury += 14000; } },
  { id: "startup", type: "positive", title: "A Startup Finds Its Home", icon: "💡", summary: "A young software studio chooses your city for its first office.", effect: (c) => { c.jobs += 420; c.innovation += 4; c.businesses += 1; } },
  { id: "grant", type: "positive", title: "Regional Development Grant", icon: "🏛", summary: "The regional government awards a matching grant for civic improvements.", effect: (c) => { c.treasury += 42000; } },
  { id: "clinic", type: "positive", title: "Community Health Drive", icon: "✚", summary: "Volunteer clinicians run a successful vaccination and wellness campaign.", effect: (c) => { c.health += 4; c.happiness += 1; } },
  { id: "storm", type: "negative", title: "Coastal Storm Warning", icon: "🌧", summary: "A fierce storm disrupts shipping and damages exposed infrastructure.", effect: (c) => { c.treasury -= 18000; c.happiness -= 2; c.cleanliness -= 2; } },
  { id: "strike", type: "negative", title: "Transit Workers Walk Out", icon: "🚌", summary: "Drivers demand better conditions, slowing commutes across the city.", effect: (c) => { c.happiness -= 5; c.approval -= 4; c.employment -= 1; } },
  { id: "shortage", type: "negative", title: "Food Supply Tightens", icon: "📉", summary: "A disrupted trade route drives up staple prices across the region.", effect: (c) => { c.prices.food *= 1.22; c.happiness -= 3; } },
  { id: "factory", type: "negative", title: "Factory Accident", icon: "⚠", summary: "An industrial accident has halted production and renewed calls for safety inspections.", effect: (c) => { c.treasury -= 25000; c.pollution += 3; c.approval -= 2; } },
  { id: "outbreak", type: "negative", title: "Seasonal Illness Spreads", icon: "✚", summary: "Clinics report a rise in seasonal illness. Strong healthcare can limit the impact.", effect: (c) => { const impact = Math.max(1, 7 - c.healthcare * 0.55); c.health -= impact; c.happiness -= impact * 0.35; } }
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const round = (n, digits = 1) => Number(Number(n).toFixed(digits));
const uid = (prefix, n) => `${prefix}-${String(n).padStart(4, "0")}`;

function uniqueName(rng, prefixes, roots, used) {
  for (let tries = 0; tries < 100; tries++) {
    const name = `${rng.pick(prefixes)} ${rng.pick(roots)}`;
    if (!used.has(name)) { used.add(name); return name; }
  }
  return `${rng.pick(roots)} ${rng.int(100, 999)}`;
}

function makeCountry(rng, i, continents) {
  const root = rng.pick(NAME_POOLS.countryRoots);
  const prefix = rng.pick(NAME_POOLS.countryPrefixes);
  return {
    id: uid("nation", i + 1),
    name: `${prefix} ${root}`,
    continent: rng.pick(continents).name,
    population: rng.int(450000, 65000000),
    gdp: rng.int(4, 950) * 1e9,
    stability: rng.int(58, 96),
    education: rng.int(35, 91),
    technology: rng.int(18, 74),
    infrastructure: rng.int(32, 86),
    tourism: rng.int(15, 88),
    government: rng.pick(["Parliamentary Republic", "Constitutional Monarchy", "Federal Republic", "Civic Federation"]),
    capital: null,
    tradePolicy: rng.pick(["Open Trade", "Balanced Tariffs", "Regional Partnership"])
  };
}

function makePerson(rng, occupation = null) {
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  return {
    name: `${first} ${last}`,
    age: rng.int(27, 64),
    occupation: occupation || rng.pick(["Teacher", "Engineer", "Doctor", "Small Business Owner", "Researcher", "Port Worker", "Journalist"]),
    education: rng.pick(["Secondary", "College", "University", "Doctorate"]),
    personality: rng.pick(["Pragmatic", "Visionary", "Patient", "Ambitious", "Community-minded"]),
    happiness: rng.int(55, 92),
    influence: rng.int(10, 70),
    netWorth: rng.int(8, 850) * 10000,
    history: []
  };
}

function calcMonthlyEconomy(city, difficulty, world) {
  const population = city.population;
  const employed = population * (city.employment / 100) * 0.48;
  const incomePerWorker = 1150 + city.education * 9 + city.wealth * 2;
  const taxPressure = Object.values(city.taxes).reduce((sum, value) => sum + value, 0) / 1000;
  const taxRevenue = employed * incomePerWorker * taxPressure * 0.36;
  const businessRevenue = city.businesses * (900 + city.businessConfidence * 5);
  const tourismRevenue = city.tourism * population * 0.018;
  const grantRevenue = city.grantIncome || 0;
  const monthlyIncome = (taxRevenue + businessRevenue + tourismRevenue + grantRevenue) * difficulty.incomeMult;
  const serviceCost = Object.entries(city.infrastructure).reduce((sum, [key, level]) => {
    const def = INFRASTRUCTURE_CATEGORIES.find((x) => x.id === key);
    const funding = city.budgets[key] ?? 100;
    return sum + (def ? def.baseMaint * Math.pow(level, 1.22) * (funding / 100) : 0);
  }, 0);
  const salaryCost = employed * 470 * 0.052;
  const policyCost = city.activePolicies.reduce((sum, id) => {
    const p = POLICIES.find((x) => x.id === id);
    return sum + (p ? p.costPerCapita * population : 0);
  }, 0);
  const debtCost = city.loan ? city.loan.monthlyPayment : 0;
  const projectCost = city.projects.reduce((sum, project) => sum + (project.monthlyCost || 0), 0);
  const monthlyExpenses = (serviceCost + salaryCost + policyCost + debtCost + projectCost + population * 0.12) * difficulty.costMult;
  return { monthlyIncome, monthlyExpenses, monthlyProfit: monthlyIncome - monthlyExpenses };
}

function makeCity(rng, id, name, country, geography, climate, population, isPlayer = false) {
  const identity = geography.id === "Ocean" ? "Port City" : geography.id === "Mountains" ? "Mining Town" : rng.pick(CITY_TYPES);
  const infra = {};
  const budgets = {};
  for (const def of INFRASTRUCTURE_CATEGORIES) {
    infra[def.id] = isPlayer ? rng.int(2, 4) : rng.int(1, 6);
    budgets[def.id] = 100;
  }
  const taxes = {};
  for (const tax of TAX_CATEGORIES) taxes[tax.id] = tax.defaultRate;
  const baseHappiness = isPlayer ? 72 : rng.int(54, 90);
  const city = {
    id,
    name,
    type: identity,
    countryId: country.id,
    countryName: country.name,
    continent: country.continent,
    geography: geography.id,
    climate: climate.id,
    population: Math.round(population),
    populationDelta: 0,
    treasury: isPlayer ? 385000 : rng.int(1, 80) * 100000,
    approval: isPlayer ? 71 : rng.int(35, 92),
    happiness: clamp(baseHappiness + (isPlayer ? 0 : rng.int(-6, 6)), 25, 95),
    employment: isPlayer ? 93 : rng.int(72, 97),
    education: isPlayer ? 46 : rng.int(26, 89),
    health: isPlayer ? 68 : rng.int(42, 92),
    healthcare: isPlayer ? 3 : rng.int(1, 7),
    crime: isPlayer ? 18 : rng.int(4, 46),
    pollution: geography.id === "Forest" ? rng.int(8, 18) : rng.int(16, 40),
    cleanliness: isPlayer ? 72 : rng.int(48, 92),
    tourism: geography.id === "Ocean" || geography.id === "Lake" ? rng.int(28, 70) : rng.int(8, 42),
    infrastructureRating: isPlayer ? 43 : rng.int(28, 86),
    innovation: isPlayer ? 28 : rng.int(15, 85),
    wealth: isPlayer ? 42 : rng.int(28, 87),
    businessConfidence: rng.int(48, 90),
    businesses: isPlayer ? 38 : rng.int(22, 900),
    jobs: Math.round(population * 0.45),
    exports: rng.int(25, 600) * 10000,
    imports: rng.int(15, 520) * 10000,
    gdp: Math.round(population * rng.int(18000, 56000)),
    tradeBalance: 0,
    taxes,
    budgets,
    infrastructure: infra,
    activePolicies: [],
    projects: [],
    districts: isPlayer ? JSON.parse(JSON.stringify(DEFAULT_DISTRICTS)) : [],
    resourceProduction: {},
    resourceDemand: {},
    prices: Object.fromEntries(RESOURCES.map((r) => [r.id, r.basePrice])),
    council: isPlayer ? COUNCIL_ARCHETYPES.slice(0, 5).map((member, i) => ({ ...member, name: makePerson(rng).name, approval: rng.int(55, 86), id: `council-${i}` })) : [],
    mayor: makePerson(rng, isPlayer ? "Mayor" : "Mayor"),
    awards: [],
    landmarks: [],
    activeContract: null,
    grantsWon: 0,
    crimeChange: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyProfit: 0,
    previousPopulation: population,
    previousTreasury: isPlayer ? 385000 : 0,
    totalTaxRevenue: 0,
    totalExports: 0,
    totalImports: 0,
    isPlayer
  };
  city.tradeBalance = city.exports - city.imports;
  city.monthlyIncome = 62000;
  city.monthlyExpenses = 53500;
  city.monthlyProfit = city.monthlyIncome - city.monthlyExpenses;
  for (const r of RESOURCES) {
    const prod = rng.int(10, 100);
    city.resourceProduction[r.id] = prod;
    city.resourceDemand[r.id] = rng.int(15, 105);
  }
  return city;
}

function makeCompanyFromTemplate(rng, template, i, cityIds, playerCityId, year) {
  const headquartersCity = rng.pick(cityIds);
  return {
    id: uid("corp", i + 1),
    ...JSON.parse(JSON.stringify(template)),
    foundedYear: Math.min(template.foundedYear, year - rng.int(0, 9)),
    headquartersCityId: headquartersCity,
    headquartersCityName: null,
    employees: Math.round(template.employees * rng.range(0.42, 1.3)),
    marketValue: template.marketValue * rng.range(0.55, 1.6),
    revenue: template.revenue * rng.range(0.58, 1.5),
    profit: template.profit * rng.range(0.48, 1.5),
    sharePrice: template.sharePrice * rng.range(0.65, 1.45),
    growth: round(rng.range(-2.5, 8), 1),
    relocationRisk: rng.int(2, 40),
    expansion: rng.pick(["Hiring engineers", "Evaluating a new office", "Stable operations", "Seeking regional suppliers", "R&D expansion"]),
    history: [{ year: Math.min(template.foundedYear, year - 2), text: `${template.name} began operations.` }],
    offered: false
  };
}

function generateContract(rng, city, worldYear) {
  const contractTypes = [
    { name: "Regional University Campus", icon: "book", requirement: "Education 48+", reward: 185000, jobs: 840, effect: { education: 8, innovation: 5 }, duration: 24 },
    { name: "Civic Health Research Annex", icon: "heart", requirement: "Healthcare 55+", reward: 148000, jobs: 520, effect: { health: 9, healthcare: 1 }, duration: 20 },
    { name: "Green Port Logistics Hub", icon: "anchor", requirement: "Coastal access · Roads 4+", reward: 226000, jobs: 1250, effect: { employment: 1.2, pollution: -3, infrastructureRating: 5 }, duration: 28 },
    { name: "Clean Energy Demonstrator", icon: "leaf", requirement: "Cleanliness 65+", reward: 172000, jobs: 410, effect: { pollution: -8, innovation: 6 }, duration: 18 },
    { name: "Regional Freight Interchange", icon: "train", requirement: "Roads 4+ · Transit 3+", reward: 205000, jobs: 980, effect: { infrastructureRating: 7, employment: 0.8 }, duration: 22 },
    { name: "Advanced Materials Laboratory", icon: "gear", requirement: "Innovation 42+", reward: 240000, jobs: 620, effect: { innovation: 12, education: 4 }, duration: 26 }
  ];
  const def = rng.pick(contractTypes);
  return {
    id: `contract-${worldYear}-${rng.int(100, 9999)}`,
    title: def.name,
    icon: def.icon,
    requirement: def.requirement,
    reward: def.reward * rng.range(0.85, 1.22),
    jobs: def.jobs,
    effect: def.effect,
    duration: def.duration,
    deadline: worldYear + 1,
    daysLeft: 365,
    status: "offered",
    offer: rng.int(0, 100),
    sponsor: rng.pick(["Ministry of Regions", "National Development Fund", "Crown Infrastructure Office", "Continental Science Council"])
  };
}

function makeNews(rng, year, date, title, description, type = "info", icon = "◈", cityName = "Port Azure") {
  return {
    id: `news-${year}-${Math.floor(Math.random() * 1e8)}`,
    year,
    date: date.formatted,
    title,
    description,
    type,
    icon,
    cityName,
    timestamp: Date.now()
  };
}

export class CrownWorld {
  static create({ seed = "AURELIA-2026", worldName = "Aurelia", size = "Small", difficulty = "Standard", sandbox = false, startCity = "Port Azure" } = {}) {
    const rng = new CrownPRNG(seed);
    const config = WORLD_SIZES[size] || WORLD_SIZES.Small;
    const continents = JSON.parse(JSON.stringify(NAME_POOLS.continents)).slice(0, Math.min(6, Math.max(3, Math.ceil(config.countries / 2))));
    const countries = [];
    for (let i = 0; i < config.countries; i++) countries.push(makeCountry(rng, i, continents));
    const usedCityNames = new Set([startCity]);
    const geos = Object.values(GEOGRAPHY_TYPES);
    const climates = CLIMATES;
    const settlements = [];
    const playerCountry = countries[rng.int(0, countries.length - 1)];
    playerCountry.capital = startCity;

    const playerGeo = rng.pick([GEOGRAPHY_TYPES.Ocean, GEOGRAPHY_TYPES.River, GEOGRAPHY_TYPES.Plains]);
    const playerClimate = rng.pick([CLIMATES[0], CLIMATES[1], CLIMATES[2]]);
    const playerCity = makeCity(rng, "city-player", startCity, playerCountry, playerGeo, playerClimate, rng.int(1500, 3600), true);
    playerCity.countryName = playerCountry.name;
    playerCity.type = playerGeo.id === "Ocean" ? "Coastal Village" : "Riverside Village";
    settlements.push(playerCity);

    for (let i = 1; i < config.settlements; i++) {
      const country = countries[rng.int(0, countries.length - 1)];
      const geo = rng.pick(geos);
      const climate = rng.pick(climates);
      const name = uniqueName(rng, NAME_POOLS.cityPrefixes, NAME_POOLS.cityRoots, usedCityNames);
      const pop = Math.round(rng.int(380, 1800000) * rng.range(0.6, 1.25));
      settlements.push(makeCity(rng, uid("city", i), name, country, geo, climate, pop));
    }
    const capitalCandidates = settlements.filter((c) => c.countryId !== playerCountry.id || c.id !== playerCity.id);
    for (const country of countries) {
      if (!country.capital) {
        const match = capitalCandidates.find((c) => c.countryId === country.id);
        if (match) country.capital = match.name;
      }
    }
    const cityIds = settlements.map((c) => c.id);
    const companies = [];
    const templates = SIGNATURE_COMPANIES;
    templates.forEach((template, i) => companies.push(makeCompanyFromTemplate(rng, template, i, cityIds, playerCity.id, 2026)));
    let nextCompanyId = templates.length;
    const usedCompanies = new Set(templates.map((c) => c.name));
    const industries = INDUSTRIES_LIST;
    while (companies.length < config.companies) {
      const industry = rng.pick(industries);
      const prefix = rng.pick(NAME_POOLS.companyPrefixes);
      const suffix = rng.pick(NAME_POOLS.companySuffixes);
      let name = `${prefix} ${suffix}`;
      let attempts = 0;
      while (usedCompanies.has(name) && attempts++ < 30) name = `${rng.pick(NAME_POOLS.companyPrefixes)} ${rng.pick(NAME_POOLS.companySuffixes)}`;
      usedCompanies.add(name);
      const archetype = rng.pick(["Aggressive", "Conservative", "Innovative", "Eco-Friendly", "Industrial", "Luxury", "Global", "Local"]);
      const revenue = rng.int(9, 920) * 1e5;
      const cityId = rng.pick(cityIds);
      const nameParts = name.split(" ");
      companies.push({
        id: uid("corp", ++nextCompanyId), name, logo: industry.logo,
        primaryColor: rng.pick(["#f5c542", "#38bdf8", "#f97316", "#a78bfa", "#22c55e", "#f87171", "#e879f9"]),
        secondaryColor: "#e2e8f0", slogan: rng.pick(["Building a brighter tomorrow", "Made for the long journey", "Ideas into impact", "A better world, together", "Precision for progress"]),
        industry: industry.name, personality: archetype, founderName: makePerson(rng, "Founder").name,
        ceoName: makePerson(rng, "Chief Executive").name, foundedYear: rng.int(1978, 2026),
        headquartersCityId: cityId, headquartersCityName: null,
        employees: rng.int(80, 16500), marketValue: revenue * rng.range(1.3, 7.5), revenue,
        profit: revenue * rng.range(0.04, 0.22), reputation: rng.int(2, 5), isPublic: rng.chance(0.67),
        sharePrice: rng.range(12, 270), products: [industry.name.split(" ")[0] + " One", "Pro Series", "Crown Edition"],
        cityTitle: `${industry.name} Capital`, requiresWater: industry.name.includes("Ship"),
        growth: round(rng.range(-5, 11), 1), relocationRisk: rng.int(2, 60),
        expansion: rng.pick(["Evaluating a new office", "R&D expansion", "Hiring locally", "Seeking regional suppliers", "Stable operations"]),
        history: [{ year: rng.int(1978, 2026), text: `${name} was founded.` }], offered: false
      });
    }

    // Place signature companies in varied, meaningful hometowns when requirements allow.
    const playerHQ = companies.find((c) => c.name === "Royal Yacht Company");
    if (playerHQ) {
      const coastCities = settlements.filter((c) => c.geography === "Ocean");
      const portAzure = coastCities.find((c) => c.id === playerCity.id) || coastCities[0];
      if (portAzure) playerHQ.headquartersCityId = portAzure.id;
    }
    // Seed the player's tiny settlement with a modest local employer to make the first decisions tangible.
    const starterCompany = companies.find((c) => c.name === "Pixel Microsystems");
    if (starterCompany) {
      starterCompany.headquartersCityId = playerCity.id;
      starterCompany.headquartersCityName = playerCity.name;
      starterCompany.employees = 84;
      starterCompany.marketValue = 2600000;
      starterCompany.revenue = 720000;
      starterCompany.profit = 118000;
      starterCompany.relocationRisk = 8;
      starterCompany.history.unshift({ year: 2026, text: `Pixel Microsystems opened a small office in ${playerCity.name}.` });
    }
    const companyCityNames = new Map(settlements.map((city) => [city.id, city.name]));
    for (const company of companies) company.headquartersCityName = companyCityNames.get(company.headquartersCityId) || settlements[0].name;

    const people = Array.from({ length: Math.min(config.people, 70) }, (_, i) => ({
      id: uid("person", i + 1), ...makePerson(rng), cityId: rng.pick(cityIds), cityName: null,
      employer: rng.pick(companies).name, notable: rng.chance(0.32), bornYear: 2026 - rng.int(25, 63),
      wealthBand: rng.pick(["Working", "Middle Class", "Affluent", "Wealthy"])
    }));
    const cityMap = new Map(settlements.map((c) => [c.id, c.name]));
    people.forEach((person) => { person.cityName = cityMap.get(person.cityId); });

    const world = {
      schemaVersion: 1,
      worldName: (worldName || "Aurelia").trim() || "Aurelia",
      seed: String(seed),
      size,
      difficulty,
      sandbox: !!sandbox,
      createdAt: new Date().toISOString(),
      year: 2026,
      dayOfYear: 1,
      hour: 8,
      minute: 0,
      calendar: dayOfYearToDate(1, 2026),
      speed: 1,
      paused: false,
      tickAccumulator: 0,
      daysPerSecond: 0.72,
      playTimeSeconds: 0,
      playerCityId: playerCity.id,
      settlements,
      countries,
      continents,
      companies,
      people,
      history: [{ id: "hist-founding", year: 2026, date: "Jan 1, 2026", type: "milestone", icon: "🏛", title: `${playerCity.name} appoints its new mayor`, description: `A new administration begins in ${playerCity.name}. The town is small, but its future is wide open.` }],
      news: [],
      notifications: [],
      contracts: [],
      research: { points: 24, monthlyOutput: 5, completed: [], active: "steam_rail", progress: 21, eraIndex: 0 },
      global: { economicCycle: "Recovery", inflation: 2.1, resourcePrices: Object.fromEntries(RESOURCES.map((r) => [r.id, r.basePrice])), technologyProgress: 0, globalTension: 14 },
      rankings: [],
      achievements: [],
      monthlyHistory: [],
      eventCooldown: 22,
      nextCompanyId: companies.length + 1,
      nextPersonId: people.length + 1,
      autosaveCountdown: 300,
      autosaveEnabled: true,
      settings: { sound: true, music: false, showTutorial: true, reducedMotion: false }
    };
    for (let i = 0; i < 3; i++) world.contracts.push(generateContract(rng, playerCity, world.year));
    world.news.push(makeNews(rng, 2026, world.calendar, "A new chapter for Port Azure", "The town council welcomes a new mayor as regional leaders look toward the coast.", "milestone", "🏛", playerCity.name));
    world.rankings = CrownWorld.calculateRankings(world);
    return world;
  }

  static getPlayerCity(world) {
    return world.settlements.find((city) => city.id === world.playerCityId);
  }

  static refreshDate(world) {
    world.calendar = dayOfYearToDate(world.dayOfYear, world.year);
    const dayFraction = (world.tickAccumulator || 0) % 1;
    const hours = dayFraction * 24;
    world.hour = Math.floor(hours);
    world.minute = Math.floor((hours - world.hour) * 60);
  }

  static advance(world, realSeconds) {
    if (!world || world.paused || world.speed === 0) return [];
    const dt = Math.min(0.25, Math.max(0, realSeconds));
    world.playTimeSeconds = (world.playTimeSeconds || 0) + dt;
    world.tickAccumulator += dt * world.daysPerSecond * world.speed;
    const generatedNews = [];
    while (world.tickAccumulator >= 1) {
      world.tickAccumulator -= 1;
      const msg = CrownWorld.advanceDay(world);
      if (msg) generatedNews.push(msg);
    }
    CrownWorld.refreshDate(world);
    return generatedNews;
  }

  static advanceDay(world) {
    world.dayOfYear += 1;
    if (world.dayOfYear > 365) {
      world.dayOfYear = 1;
      world.year += 1;
    }
    world.calendar = dayOfYearToDate(world.dayOfYear, world.year);
    world.eventCooldown -= 1;
    world.autosaveCountdown = Math.max(0, (world.autosaveCountdown || 300) - (1 / Math.max(0.1, world.daysPerSecond * world.speed)));
    const day = world.dayOfYear;
    if (day % 30 === 0) {
      CrownWorld.monthlyUpdate(world);
      return `month:${world.year}:${world.calendar.monthName}`;
    }
    return null;
  }

  static monthlyUpdate(world) {
    const rng = new CrownPRNG(`${world.seed}|${world.year}|${world.dayOfYear}|${world.monthlyHistory.length}`);
    const player = CrownWorld.getPlayerCity(world);
    const diff = DIFFICULTIES[world.difficulty] || DIFFICULTIES.Standard;
    const previous = { population: player.population, treasury: player.treasury, happiness: player.happiness, crime: player.crime };

    // Regional business & world market shifts happen independently from the player.
    world.global.inflation = clamp(world.global.inflation + rng.range(-0.16, 0.19), -1.2, 12);
    const cycleRoll = rng.next();
    if (cycleRoll < 0.025) world.global.economicCycle = rng.pick(["Boom", "Slowdown", "Recession", "Recovery"]);
    world.global.technologyProgress += rng.range(0.05, 0.4);
    for (const resource of RESOURCES) {
      const demandPulse = rng.range(-0.045, 0.05);
      const price = world.global.resourcePrices[resource.id] || resource.basePrice;
      world.global.resourcePrices[resource.id] = clamp(price * (1 + demandPulse + (world.global.economicCycle === "Boom" ? 0.013 : world.global.economicCycle === "Recession" ? -0.012 : 0)), resource.basePrice * 0.38, resource.basePrice * 2.8);
    }

    // Simulate every settlement monthly, with special political/economic care for player's town.
    for (const city of world.settlements) {
      if (city.id === player.id) continue;
      const economicFactor = world.global.economicCycle === "Boom" ? 1.22 : world.global.economicCycle === "Recession" ? 0.72 : 1;
      const growthRate = (city.happiness - 50) * 0.00019 + (city.employment - 80) * 0.0001 + rng.range(-0.001, 0.0015);
      city.population = Math.max(180, Math.round(city.population * (1 + growthRate)));
      city.gdp = Math.round(city.gdp * (1 + rng.range(-0.012, 0.022) * economicFactor));
      city.employment = clamp(city.employment + rng.range(-1.2, 1.1), 38, 99);
      city.happiness = clamp(city.happiness + rng.range(-1.2, 1.1) + (city.employment - 70) * 0.015, 15, 98);
      city.crime = clamp(city.crime + rng.range(-1.3, 1.2) - city.infrastructure.police * 0.03, 1, 75);
      city.innovation = clamp(city.innovation + rng.range(-0.4, 0.65) + city.infrastructure.education * 0.035, 4, 99);
      city.treasury = Math.max(-3e8, city.treasury + (city.gdp / 1700) * economicFactor - 8000);
      if (rng.chance(0.018)) {
        const company = world.companies.find((c) => c.headquartersCityId === city.id);
        if (company && company.relocationRisk > 75) company.headquartersCityId = rng.pick(world.settlements).id;
      }
    }

    player.crimeChange = round(player.crime - previous.crime, 1);
    player.populationDelta = 0;
    const policies = player.activePolicies.map((id) => POLICIES.find((p) => p.id === id)).filter(Boolean);
    const effect = (key) => policies.reduce((sum, p) => sum + (p.effects[key] || 0), 0);
    const happinessEffect = effect("happiness") + diff.happinessBonus;
    const taxRate = Object.values(player.taxes).reduce((s, n) => s + n, 0) / Object.keys(player.taxes).length;
    const taxHappiness = (taxRate - 9) * 0.24;
    const serviceHappiness = (player.infrastructure.healthcare + player.infrastructure.education + player.infrastructure.parks + player.infrastructure.transit) * 0.27;
    player.happiness = clamp(player.happiness + (happinessEffect * 0.12) - taxHappiness * 0.1 + serviceHappiness * 0.03 + rng.range(-0.6, 0.55), 15, 99);
    player.employment = clamp(player.employment + (player.businessConfidence - 65) * 0.012 + rng.range(-0.24, 0.28), 45, 99);
    player.crime = clamp(player.crime - (player.infrastructure.police - 2) * 0.12 + effect("crime") * 0.07 + rng.range(-0.28, 0.42), 2, 75);
    player.pollution = clamp(player.pollution - (player.infrastructure.garbage - 2) * 0.12 - effect("pollution") * 0.06 + rng.range(-0.32, 0.4), 1, 95);
    player.cleanliness = clamp(player.cleanliness + (player.infrastructure.garbage - 3) * 0.14 + (player.infrastructure.parks - 3) * 0.09 + effect("cleanliness") * 0.045 + rng.range(-0.25, 0.3), 20, 99);
    player.health = clamp(player.health + (player.infrastructure.healthcare - 3) * 0.13 + rng.range(-0.22, 0.25), 25, 99);
    player.innovation = clamp(player.innovation + (player.infrastructure.education - 2) * 0.12 + effect("innovationBonus") * 0.04 + rng.range(-0.2, 0.3), 5, 99);
    player.tourism = clamp(player.tourism + (player.infrastructure.parks - 3) * 0.1 + (player.cleanliness - 65) * 0.018 + effect("tourismMult") * 1.1 + rng.range(-0.7, 0.7), 2, 99);
    player.businessConfidence = clamp(player.businessConfidence + (player.happiness - 60) * 0.045 + (100 - player.crime) * 0.008 - taxRate * 0.025 + rng.range(-1.1, 1.0), 15, 100);
    player.infrastructureRating = clamp(Object.values(player.infrastructure).reduce((s, n) => s + n, 0) / Object.keys(player.infrastructure).length * 10.1, 5, 99);
    player.wealth = clamp(player.wealth + (player.gdp / Math.max(1, player.population) - 28000) * 0.00004 + rng.range(-0.3, 0.4), 18, 99);
    player.approval = clamp(player.approval + (player.happiness - player.approval) * 0.05 + (player.monthlyProfit > 0 ? 0.3 : -0.6) + (player.crime < 16 ? 0.15 : -0.1) + rng.range(-0.45, 0.45), 5, 99);

    // Population grows only when quality-of-life and jobs support migration.
    const migration = (player.happiness - 50) * 1.45 + (player.employment - 80) * 1.1 + (player.infrastructureRating - 40) * 0.23 + rng.range(-8, 12);
    const natural = Math.max(0, player.population * 0.00055);
    player.populationDelta = Math.round(natural + migration);
    player.population = Math.max(120, player.population + player.populationDelta);
    player.jobs = Math.round(player.population * (0.37 + player.employment / 1000) + player.businesses * 4);
    player.gdp = Math.round(player.population * (player.wealth * 310 + 9200) * (player.employment / 100));

    // Dynamic world market supply & demand for the home city.
    for (const resource of RESOURCES) {
      const ratio = (player.resourceDemand[resource.id] + player.population / 220) / Math.max(5, player.resourceProduction[resource.id] + player.population / 300);
      const base = world.global.resourcePrices[resource.id] || resource.basePrice;
      player.prices[resource.id] = clamp(base * clamp(ratio, 0.55, 1.8), resource.basePrice * 0.35, resource.basePrice * 3.2);
    }

    const economy = calcMonthlyEconomy(player, diff, world);
    player.monthlyIncome = economy.monthlyIncome;
    player.monthlyExpenses = economy.monthlyExpenses;
    player.monthlyProfit = economy.monthlyProfit;
    player.previousTreasury = player.treasury;
    player.treasury += economy.monthlyProfit;
    if (player.loan) {
      const interestCharge = player.loan.remaining * player.loan.interestRate / 12;
      player.loan.remaining = Math.max(0, player.loan.remaining - Math.max(0, player.loan.monthlyPayment - interestCharge));
      player.loan.monthsLeft = Math.max(0, player.loan.monthsLeft - 1);
      if (player.loan.monthsLeft === 0 || player.loan.remaining < 50) {
        player.loan = null;
        world.notifications.unshift({ id: `loan-paid-${world.year}-${world.dayOfYear}`, type: "positive", title: "Civic loan repaid", message: "The city has cleared its development loan and restored its borrowing capacity.", icon: "◈", date: world.calendar.formatted, unread: true });
      }
    }
    player.totalTaxRevenue += Math.max(0, economy.monthlyIncome * 0.68);
    player.exports *= rng.range(0.975, 1.035);
    player.imports *= rng.range(0.98, 1.028);
    player.tradeBalance = player.exports - player.imports;
    player.totalExports += player.exports / 12;
    player.totalImports += player.imports / 12;

    // Complete construction projects and apply level effects.
    for (const project of [...player.projects]) {
      project.daysLeft -= 30;
      if (project.daysLeft <= 0) {
        if (project.kind === "infrastructure") {
          player.infrastructure[project.category] = Math.min(10, player.infrastructure[project.category] + project.levels);
          const def = INFRASTRUCTURE_CATEGORIES.find((x) => x.id === project.category);
          project.completedTitle = `${def?.name || project.category} upgraded to Level ${player.infrastructure[project.category]}`;
        } else if (project.kind === "monument") {
          player.landmarks.push(project.name);
          player.awards.push(project.name);
          player.tourism = clamp(player.tourism + project.tourism, 1, 100);
          player.approval = clamp(player.approval + 1.5, 0, 100);
          project.completedTitle = `${project.name} opens to the public`;
        }
        const completedTitle = project.completedTitle || `${project.name} completed`;
        const news = makeNews(rng, world.year, world.calendar, completedTitle, `${project.name} is now serving residents across ${player.name}.`, "positive", "🏗", player.name);
        world.news.unshift(news);
        world.history.unshift({ ...news, type: "milestone" });
        player.projects = player.projects.filter((p) => p.id !== project.id);
      }
    }

    // Research output and technology unlocks.
    const researchPolicy = policies.some((p) => p.id === "tech_incentives") ? 1.25 : 1;
    world.research.monthlyOutput = Math.max(1, Math.round((3 + player.infrastructure.education * 0.9 + player.innovation * 0.12) * researchPolicy));
    if (world.research.active) world.research.progress += world.research.monthlyOutput;
    const tech = CrownWorld.getActiveTechnology(world);
    if (tech && world.research.progress >= tech.cost) {
      world.research.progress -= tech.cost;
      world.research.completed.push(tech.id);
      world.research.active = null;
      world.research.points += tech.cost;
      const title = tech.titleAward || `${tech.name} researched`;
      const news = makeNews(rng, world.year, world.calendar, `Research breakthrough: ${tech.name}`, `${player.name} leads the region with ${tech.name}. ${tech.bonus}.`, "positive", "💡", player.name);
      world.news.unshift(news);
      world.history.unshift({ ...news, type: "technology" });
      if (tech.titleAward) player.awards.push(tech.titleAward);
      world.notifications.unshift({ id: `n-${Date.now()}`, type: "research", title: "Research complete", message: `${tech.name} is ready. Choose your next breakthrough.`, icon: "💡", date: world.calendar.formatted, unread: true });
    }

    // Company pulse, company hires/financials and relocation decisions.
    for (const company of world.companies) {
      const hq = world.settlements.find((city) => city.id === company.headquartersCityId);
      const satisfaction = hq ? ((hq.happiness + hq.infrastructureRating + hq.education + 100 - hq.crime) / 4) : 50;
      const taxRateHere = hq?.taxes?.corporate || 13;
      company.growth = round(clamp(company.growth + (satisfaction - 65) * 0.018 - (taxRateHere - 12) * 0.06 + rng.range(-1.1, 1.1), -28, 22), 1);
      const factor = 1 + company.growth / 1200;
      company.revenue = Math.max(50000, company.revenue * factor);
      company.profit = Math.max(-company.revenue * 0.4, company.profit * factor + company.revenue * rng.range(-0.009, 0.011));
      company.marketValue = Math.max(150000, company.marketValue * (1 + company.growth / 1000 + rng.range(-0.016, 0.016)));
      company.employees = Math.max(20, Math.round(company.employees * (1 + company.growth / 4200)));
      company.sharePrice = Math.max(2, company.sharePrice * (1 + company.growth / 1000 + rng.range(-0.02, 0.018)));
      company.relocationRisk = clamp(company.relocationRisk + (65 - satisfaction) * 0.035 + (taxRateHere - 12) * 0.04 + rng.range(-1, 0.8), 0, 100);
      if (company.relocationRisk > 80 && rng.chance(0.08)) {
        const alternatives = world.settlements.filter((c) => c.id !== company.headquartersCityId && (company.requiresWater ? ["Ocean", "River"].includes(c.geography) : true));
        const best = alternatives.sort((a, b) => (b.happiness + b.education + b.infrastructureRating - b.crime - b.taxes.corporate) - (a.happiness + a.education + a.infrastructureRating - a.crime - a.taxes.corporate))[0];
        if (best) {
          const oldCityName = company.headquartersCityName;
          company.headquartersCityId = best.id;
          company.headquartersCityName = best.name;
          company.relocationRisk = 25;
          const msg = makeNews(rng, world.year, world.calendar, `${company.name} relocates its headquarters`, `${company.name} has moved its global headquarters from ${oldCityName} to ${best.name}, citing long-term growth prospects.`, "warning", "🏢", best.name);
          world.news.unshift(msg);
          world.history.unshift({ ...msg, type: "corporate" });
        }
      }
    }

    // Company HQs in player's city yield local jobs and a small reputational pull.
    const hqCompanies = world.companies.filter((c) => c.headquartersCityId === player.id);
    player.businesses = Math.max(1, player.businesses + (hqCompanies.length > 3 ? 1 : 0));
    player.jobs += hqCompanies.reduce((sum, c) => sum + c.employees * 0.18, 0);
    player.jobs = Math.round(player.jobs);

    // A city contract offer refreshes every second month; active construction style contract.
    for (const contract of world.contracts) {
      if (contract.status === "accepted") {
        contract.daysLeft -= 30;
        if (contract.daysLeft <= 0) CrownWorld.completeContract(world, contract.id);
      }
    }
    if (world.contracts.filter((c) => c.status === "offered").length < 2 && rng.chance(0.52)) {
      const contract = generateContract(rng, player, world.year);
      world.contracts.unshift(contract);
      const news = makeNews(rng, world.year, world.calendar, "New regional contract available", `${contract.sponsor} is inviting bids for the ${contract.title}.`, "info", "📋", player.name);
      world.news.unshift(news);
      world.notifications.unshift({ id: `n-${Date.now()}`, type: "contract", title: "Contract opportunity", message: `${contract.title} is open for bids.`, icon: "📋", date: world.calendar.formatted, unread: true });
    }

    // Global and local random events; world is not centered on the player.
    const randomWorldEvent = rng.chance(0.14);
    if (randomWorldEvent) {
      const eventCity = rng.pick(world.settlements.filter((c) => c.id !== player.id));
      const event = rng.pick(["A distant port strike shifts shipping prices", "A regional university announces a scientific breakthrough", "Rival cities compete for a new logistics hub", "Global steel demand rises after a construction boom", "A severe drought affects farming districts"]);
      const msg = makeNews(rng, world.year, world.calendar, event, `${eventCity.name} and neighboring settlements are adapting to the latest regional changes.`, "world", "🌐", eventCity.name);
      world.news.unshift(msg);
      world.history.unshift({ ...msg, type: "world" });
    }
    if (world.eventCooldown <= 0 && rng.chance(Math.min(0.85, 0.42 * diff.disasterChance))) {
      const event = rng.pick(EVENT_DEFS);
      event.effect(player);
      player.happiness = clamp(player.happiness, 10, 100);
      player.approval = clamp(player.approval, 0, 100);
      player.treasury = Math.max(-1e8, player.treasury);
      world.eventCooldown = rng.int(34, 75);
      const msg = makeNews(rng, world.year, world.calendar, event.title, event.summary, event.type, event.icon, player.name);
      world.news.unshift(msg);
      world.history.unshift({ ...msg, type: "event" });
      world.notifications.unshift({ id: `n-${Date.now()}`, type: event.type === "negative" ? "warning" : "positive", title: event.title, message: event.summary, icon: event.icon, date: world.calendar.formatted, unread: true });
    }

    // Civic request and council confidence.
    for (const councilor of player.council) {
      councilor.approval = clamp(councilor.approval + (player.happiness - 68) * 0.025 + (player.monthlyProfit > 0 ? 0.2 : -0.3) + rng.range(-0.8, 0.7), 12, 98);
    }
    if (player.approval < 40 && rng.chance(0.13)) {
      const msg = makeNews(rng, world.year, world.calendar, "Council scrutiny intensifies", "Council members are demanding a clearer plan for household costs and essential services.", "warning", "⚖", player.name);
      world.news.unshift(msg);
      world.notifications.unshift({ id: `n-${Date.now()}`, type: "warning", title: "Council pressure", message: "Low public approval is drawing council scrutiny.", icon: "⚖", date: world.calendar.formatted, unread: true });
    }

    // Maintain bounded records.
    const snapshot = {
      year: world.year, day: world.dayOfYear, date: world.calendar.formatted,
      population: player.population, treasury: player.treasury, happiness: player.happiness,
      approval: player.approval, crime: player.crime, pollution: player.pollution,
      gdp: player.gdp, income: player.monthlyIncome, expenses: player.monthlyExpenses,
      profit: player.monthlyProfit, tourism: player.tourism, employment: player.employment
    };
    world.monthlyHistory.push(snapshot);
    if (world.monthlyHistory.length > 120) world.monthlyHistory.shift();
    player.previousPopulation = previous.population;
    player.populationDelta = player.population - previous.population;
    world.rankings = CrownWorld.calculateRankings(world);
    CrownWorld.checkAchievements(world);
    world.news = world.news.slice(0, 80);
    world.history = world.history.slice(0, 500);
    world.notifications = world.notifications.slice(0, 40);
    return snapshot;
  }

  static getActiveTechnology(world) {
    for (const era of TECH_ERAS) {
      for (const tech of era.techs) {
        if (!world.research.completed.includes(tech.id)) return tech;
      }
    }
    return null;
  }

  static setActiveTechnology(world, techId) {
    const available = TECH_ERAS.flatMap((era) => era.techs).find((tech) => tech.id === techId);
    if (!available || world.research.completed.includes(techId)) return false;
    const currentEra = TECH_ERAS.findIndex((era) => era.techs.some((tech) => tech.id === techId));
    const unlocked = world.research.completed.length >= (TECH_ERAS[currentEra]?.minTechs || 0);
    if (!unlocked) return false;
    world.research.active = techId;
    world.research.progress = 0;
    return true;
  }

  static completeContract(world, contractId) {
    const contract = world.contracts.find((c) => c.id === contractId);
    if (!contract || contract.status !== "accepted") return false;
    const city = CrownWorld.getPlayerCity(world);
    city.treasury += contract.reward;
    city.jobs += contract.jobs;
    for (const [key, val] of Object.entries(contract.effect || {})) {
      if (key in city) city[key] += val;
    }
    city.approval = clamp(city.approval + 4, 0, 100);
    contract.status = "completed";
    contract.completedYear = world.year;
    const rng = new CrownPRNG(`${world.seed}|contract|${contract.id}`);
    const news = makeNews(rng, world.year, world.calendar, `${contract.title} delivered`, `${city.name} completes its regional contract and earns ${formatCrown(contract.reward)} in funding.`, "positive", "📋", city.name);
    world.news.unshift(news);
    world.history.unshift({ ...news, type: "contract" });
    world.notifications.unshift({ id: `n-${Date.now()}`, type: "positive", title: "Contract completed", message: `${contract.title} delivered · ${formatCrown(contract.reward)} received.`, icon: "✅", date: world.calendar.formatted, unread: true });
    return true;
  }

  static calculateBidChance(world, contract) {
    const city = CrownWorld.getPlayerCity(world);
    const requirementBonus = contract.requirement.includes("Education") ? city.education : contract.requirement.includes("Healthcare") ? city.health : contract.requirement.includes("Coastal") ? (city.geography === "Ocean" || city.geography === "River" ? 72 : 12) : contract.requirement.includes("Cleanliness") ? city.cleanliness : contract.requirement.includes("Innovation") ? city.innovation : city.infrastructureRating;
    return clamp(Math.round(24 + requirementBonus * 0.52 + city.approval * 0.13 + city.infrastructureRating * 0.11 + (contract.offer || 0) * 0.17), 4, 93);
  }

  static calculateRankings(world) {
    const keys = [
      { id: "richest", label: "Richest City", get: (c) => c.gdp },
      { id: "population", label: "Largest Population", get: (c) => c.population },
      { id: "happiness", label: "Happiest City", get: (c) => c.happiness },
      { id: "education", label: "Best Education", get: (c) => c.education },
      { id: "green", label: "Cleanest City", get: (c) => c.cleanliness },
      { id: "innovation", label: "Innovation Leader", get: (c) => c.innovation },
      { id: "tourism", label: "Tourism Capital", get: (c) => c.tourism },
      { id: "safety", label: "Safest City", get: (c) => 100 - c.crime }
    ];
    return keys.map((metric) => ({
      ...metric,
      cities: [...world.settlements].sort((a, b) => metric.get(b) - metric.get(a)).slice(0, 5).map((city, i) => ({ rank: i + 1, cityId: city.id, name: city.name, value: metric.get(city), isPlayer: city.id === world.playerCityId }))
    }));
  }

  static checkAchievements(world) {
    const city = CrownWorld.getPlayerCity(world);
    const completed = new Set(world.achievements);
    const checks = {
      humble_beginnings: city.population >= 25000,
      million_dreams: city.population >= 1000000,
      billionaire_budget: city.treasury >= 1e9,
      innovation_nation: world.rankings.find((r) => r.id === "innovation")?.cities[0]?.cityId === city.id,
      clean_future: city.cleanliness >= 95 && world.research.eraIndex >= 3,
      trade_empire: city.exports >= 5e6,
      railway_king: city.infrastructure.transit >= 8,
      harbor_master: ["Ocean", "River"].includes(city.geography) && city.infrastructure.transit >= 6,
      sky_high: city.infrastructure.transit >= 9,
      corporate_magnet: world.companies.filter((c) => c.headquartersCityId === city.id).length >= 8,
      living_legend: world.rankings.find((r) => r.id === "happiness")?.cities[0]?.cityId === city.id,
      century_mayor: world.year >= 2126,
      millennium_city: world.year >= 3026,
      history_never_forgets: world.history.length >= 50 && world.monthlyHistory.length >= 3
    };
    for (const achievement of ACHIEVEMENTS) {
      if (checks[achievement.id] && !completed.has(achievement.id)) {
        world.achievements.push(achievement.id);
        world.notifications.unshift({ id: `achievement-${achievement.id}`, type: "achievement", title: `Achievement: ${achievement.name}`, message: achievement.desc, icon: "🏆", date: world.calendar.formatted, unread: true });
        world.history.unshift({ id: `ach-${achievement.id}-${world.year}`, year: world.year, date: world.calendar.formatted, type: "achievement", icon: "🏆", title: `Achievement unlocked: ${achievement.name}`, description: achievement.desc });
      }
    }
    world.research.eraIndex = Math.max(0, TECH_ERAS.findIndex((era) => world.research.completed.length < era.minTechs));
    if (world.research.completed.length >= TECH_ERAS[4].minTechs) world.research.eraIndex = 4;
  }

  static queueInfrastructure(world, categoryId, levels = 1) {
    const city = CrownWorld.getPlayerCity(world);
    const def = INFRASTRUCTURE_CATEGORIES.find((item) => item.id === categoryId);
    if (!def) return { ok: false, reason: "Infrastructure not found." };
    const current = city.infrastructure[categoryId] || 1;
    const requested = Math.max(1, Math.min(2, Math.floor(levels)));
    if (current >= 10 || current + requested > 10) return { ok: false, reason: "This service is already at its maximum level." };
    const cost = Math.round(def.baseCost * Math.pow(current, 1.38) * requested * (DIFFICULTIES[world.difficulty]?.costMult || 1) * (GEOGRAPHY_TYPES[city.geography]?.expansionCostMult || 1));
    if (!world.sandbox && city.treasury < cost) return { ok: false, reason: `You need ${formatCrown(cost)} to fund this upgrade.` };
    const days = Math.round(def.buildDays * (1 + current * 0.18) * requested);
    if (!world.sandbox) city.treasury -= cost;
    else city.treasury = Math.max(city.treasury, 0);
    city.projects.push({ id: `project-${Date.now()}-${Math.random()}`, name: def.name, kind: "infrastructure", category: categoryId, levels: requested, cost, daysLeft: days, monthlyCost: 0 });
    return { ok: true, cost, days, level: current + requested, name: def.name };
  }

  static queueMonument(world, monument) {
    const city = CrownWorld.getPlayerCity(world);
    if (!monument) return { ok: false, reason: "Monument not found." };
    if (!world.sandbox && city.treasury < monument.cost) return { ok: false, reason: `You need ${formatCrown(monument.cost)} to fund this landmark.` };
    if (!world.sandbox) city.treasury -= monument.cost;
    city.projects.push({ id: `project-${Date.now()}-${Math.random()}`, name: monument.name, kind: "monument", category: "monument", cost: monument.cost, daysLeft: monument.buildDays, monthlyCost: 0, prestige: monument.prestige, tourism: monument.tourism });
    return { ok: true, cost: monument.cost, days: monument.buildDays, name: monument.name };
  }

  static setTax(world, category, value) {
    const city = CrownWorld.getPlayerCity(world);
    const def = TAX_CATEGORIES.find((t) => t.id === category);
    if (!def) return false;
    city.taxes[category] = clamp(Number(value), def.min, def.max);
    return true;
  }

  static togglePolicy(world, policyId) {
    const city = CrownWorld.getPlayerCity(world);
    const policy = POLICIES.find((item) => item.id === policyId);
    if (!policy) return { ok: false, reason: "Policy not found." };
    const active = city.activePolicies.includes(policyId);
    if (active) city.activePolicies = city.activePolicies.filter((id) => id !== policyId);
    else city.activePolicies.push(policyId);
    return { ok: true, active: !active, policy };
  }

  static changeDepartmentBudget(world, departmentId, pct) {
    const city = CrownWorld.getPlayerCity(world);
    if (!BUDGET_DEPARTMENTS.some((d) => d.id === departmentId) && !INFRASTRUCTURE_CATEGORIES.some((d) => d.id === departmentId)) return false;
    city.budgets[departmentId] = clamp(Number(pct), 50, 150);
    return true;
  }

  static acceptContract(world, contractId, offer = 0) {
    const contract = world.contracts.find((c) => c.id === contractId && c.status === "offered");
    if (!contract) return { ok: false, reason: "This contract is no longer available." };
    contract.offer = clamp(Number(offer), 0, 100);
    const chance = CrownWorld.calculateBidChance(world, contract);
    const rng = new CrownPRNG(`${world.seed}|bid|${contract.id}|${world.year}|${contract.offer}`);
    if (rng.int(1, 100) <= chance) {
      contract.status = "accepted";
      contract.daysLeft = contract.duration * 30;
      contract.bidChance = chance;
      contract.startedYear = world.year;
      const city = CrownWorld.getPlayerCity(world);
      city.activeContract = contract.id;
      world.notifications.unshift({ id: `n-${Date.now()}`, type: "positive", title: "Bid accepted", message: `${contract.sponsor} has awarded your city the ${contract.title}.`, icon: "📋", date: world.calendar.formatted, unread: true });
      return { ok: true, chance, contract };
    }
    contract.status = "lost";
    contract.bidChance = chance;
    return { ok: false, chance, reason: `Another city won the bid. Our estimated win chance was ${chance}%.` };
  }

  static takeLoan(world, amount = 150000) {
    const city = CrownWorld.getPlayerCity(world);
    if (city.loan) return { ok: false, reason: "Repay your current civic loan before borrowing again." };
    if (city.treasury < -250000) return { ok: false, reason: "Treasury health is too low to qualify for a new loan." };
    const principal = Math.max(50000, Math.min(1000000, Math.floor(amount)));
    const interestRate = 0.065 + Math.max(0, 12 - city.infrastructureRating) * 0.0015 + Math.max(0, 60 - city.approval) * 0.0008;
    const months = 48;
    const monthlyPayment = Math.ceil((principal * (1 + interestRate * 4)) / months);
    city.treasury += principal;
    city.loan = { principal, remaining: principal, interestRate, monthsLeft: months, monthlyPayment, creditRating: city.approval > 75 ? "A" : city.approval > 55 ? "BBB" : "BB" };
    return { ok: true, principal, interestRate, monthlyPayment };
  }
}

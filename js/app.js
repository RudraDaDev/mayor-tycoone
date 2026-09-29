// ============================================================================
// ◈ PROJECT CROWN — Browser Game Application
// UI is vanilla JS; KaboomJS powers the procedural, pixelated world map scene.
// ============================================================================
import kaboom from "./vendor/kaboom.mjs";
import { CrownPRNG, formatCrown, formatCompact, formatNumber, formatPct, generateRandomSeed } from "./prng.js";
import {
  WORLD_SIZES, DIFFICULTIES, GEOGRAPHY_TYPES, CLIMATES, RESOURCES,
  INFRASTRUCTURE_CATEGORIES, POLICIES, TAX_CATEGORIES, BUDGET_DEPARTMENTS,
  TECH_ERAS, SIGNATURE_COMPANIES, MONUMENTS, ACHIEVEMENTS, getPixelIconDataURL
} from "./data.js";
import { CrownWorld } from "./sim.js";
import { storage } from "./storage.js";
import { audio } from "./audio.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
const PAGE_NAMES = { overview: "Overview", economy: "Economy", infrastructure: "Infrastructure", housing: "Housing & districts", transport: "Transportation", companies: "Companies", contracts: "Government contracts", citizens: "Citizens & society", trade: "Trade & resources", research: "Research & technology", world: "World & news", history: "History & legacy", settings: "Settings" };
const PAGE_KEYS = Object.keys(PAGE_NAMES);
let world = null;
let currentPage = "overview";
let lastFrame = 0;
let lastHudUpdate = 0;
let lastRenderMonth = -1;
let lastAutosaveAt = 0;
let kaboomGame = null;
let kaboomCanvas = null;
let listenersBound = false;
let autoSavePromise = null;
let newSaveName = null;

const startScreen = $("#start-screen");
const gameScreen = $("#game-screen");
const pageContent = $("#page-content");
const modalRoot = $("#modal-root");
const toastRoot = $("#toast-root");

function playerCity() { return world ? CrownWorld.getPlayerCity(world) : null; }
function selectedCompany(id) { return world?.companies.find((company) => company.id === id); }
function cityLogo(company, size = 34) {
  const url = getPixelIconDataURL(company.logo, company.primaryColor, company.secondaryColor, size);
  return `<img class="pixel-logo" src="${url}" alt="${safe(company.name)} logo" width="${size}" height="${size}" />`;
}
function cityPopulationType(pop) {
  if (pop >= 1000000) return "METROPOLIS";
  if (pop >= 100000) return "MAJOR CITY";
  if (pop >= 25000) return "CITY";
  if (pop >= 5000) return "TOWN";
  return "COASTAL VILLAGE";
}
function valueChange(value, suffix = "") {
  const positive = value >= 0;
  return `<span class="metric-change ${positive ? "" : "down"}">${positive ? "+" : ""}${formatCompact(value)}${suffix}</span>`;
}
function getDateLabel() {
  const c = world.calendar;
  return `${c.monthShort} ${c.day}, ${world.year}`;
}
function getWeather() {
  const city = playerCity();
  if (!city) return "CLEAR SKIES";
  const seed = new CrownPRNG(`${world.seed}|weather|${world.year}|${world.calendar.monthIndex}`);
  const weather = city.climate === "Desert" ? ["SUNNY · DRY", "BRIGHT · CLEAR", "WARM BREEZE"] : city.climate === "Cold" ? ["FROST · CLEAR", "OVERCAST · COLD", "LIGHT SNOW"] : ["CLEAR SKIES", "CLOUDY · MILD", "LIGHT BREEZE", "PASSING SHOWERS"];
  return seed.pick(weather).toUpperCase();
}
function diffColor(value, target = 0) { return value >= target ? "positive" : "negative"; }
function renderStartSaves() {
  const area = $("#saved-world-area");
  if (!area) return;
  storage.listSaves().then((saves) => {
    const latest = saves.find((s) => !s.isAutosave && !s.isBackup) || saves[0];
    const btn = $("#continue-world-btn");
    if (latest && btn) {
      btn.hidden = false;
      const date = latest.savedAt ? new Date(latest.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Local save";
      $("#continue-meta").textContent = `${latest.cityName || "Your city"} · ${latest.worldName || "World"} · Year ${latest.year || 2026} · Saved ${date}`;
    } else if (btn) btn.hidden = true;
  }).catch(() => {});
}

function randomSeedToField() { $("#seed-input").value = generateRandomSeed(); }

async function startNewWorld() {
  const seed = $("#seed-input").value.trim() || generateRandomSeed();
  const worldName = $("#world-name-input").value.trim() || "Aurelia";
  const size = $("#world-size-select").value;
  const difficulty = $("#difficulty-select").value;
  const sandbox = $("#sandbox-toggle").checked;
  const button = $("#create-world-btn");
  button.disabled = true;
  button.querySelector("span").textContent = "Generating your world…";
  // Yield one frame so the button feedback is visible before procedural generation.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    world = CrownWorld.create({ seed, worldName, size, difficulty, sandbox });
    storage.updateGuestSettings({ worldsCreated: (storage.guestProfile.worldsCreated || 0) + 1 });
    await launchGame();
    playTone("news");
    showToast("The world is yours", `${playerCity().name} is ready for its new mayor.`, "positive", "◈");
    addWelcomeNotifications();
  } catch (err) {
    console.error(err);
    showToast("World generation failed", "Please refresh and try another seed.", "negative", "⚠");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Take the mayor's chair";
  }
}

function addWelcomeNotifications() {
  const city = playerCity();
  world.notifications.unshift({ id: `welcome-${Date.now()}`, type: "info", title: "Welcome to the office", message: `You are now mayor of ${city.name}. Start with your budget, local services, and the contracts on your desk.`, icon: "🏛", date: getDateLabel(), unread: true });
  world.notifications.unshift({ id: `council-${Date.now()}`, type: "info", title: "Your council is ready", message: `${city.council.length} council members are waiting to hear your priorities.`, icon: "⚖", date: getDateLabel(), unread: true });
}

async function launchGame() {
  if (!world) return;
  startScreen.hidden = true;
  gameScreen.hidden = false;
  currentPage = "overview";
  document.title = `${playerCity().name} — Project Crown`;
  updateHud();
  renderPage();
  await storage.saveWorld(world, { isAutosave: true, existingId: "autosave_primary" }).catch(() => {});
  lastFrame = performance.now();
  lastHudUpdate = 0;
  requestAnimationFrame(gameLoop);
  bindGameUI();
}

async function continueLatestWorld() {
  const btn = $("#continue-world-btn");
  if (btn) btn.disabled = true;
  try {
    const state = await storage.loadMostRecentSave();
    if (!state) {
      showToast("No saved world found", "Create a new world to get started.", "warning", "▣");
      return;
    }
    world = state;
    if (!world.calendar) CrownWorld.refreshDate(world);
    if (!Array.isArray(world.notifications)) world.notifications = [];
    await launchGame();
    showToast("Welcome back, Mayor", `${playerCity().name} is ready when you are.`, "positive", "↗");
  } catch (err) {
    console.error(err);
    showToast("Couldn't load this world", "Try importing the save file again.", "negative", "⚠");
  } finally { if (btn) btn.disabled = false; }
}

function updateHud() {
  if (!world || gameScreen.hidden) return;
  const city = playerCity();
  const geo = GEOGRAPHY_TYPES[city.geography];
  $("#sidebar-city-name").textContent = city.name;
  $("#sidebar-city-type").textContent = cityPopulationType(city.population);
  $("#top-world-name").textContent = world.worldName;
  $("#top-date").textContent = getDateLabel();
  $("#top-season").textContent = `${world.calendar.season.toUpperCase()} · ${getWeather()}`;
  $("#top-treasury").textContent = formatCrown(city.treasury);
  const monthlyDelta = city.monthlyProfit;
  const profit = $("#top-profit");
  profit.textContent = `${monthlyDelta >= 0 ? "+" : "−"}${formatCrown(Math.abs(monthlyDelta))} / MO`;
  profit.classList.toggle("negative", monthlyDelta < 0);
  $("#status-seed").textContent = world.seed;
  const activeContracts = world.contracts.filter((c) => c.status === "offered").length;
  $("#contract-count").textContent = activeContracts;
  $("#contract-count").hidden = activeContracts === 0;
  $("#world-status").textContent = world.paused ? "PAUSED" : "LIVE";
  $("#world-status").style.color = world.paused ? "#e8be65" : "#63c6a7";
  $("#status-live").textContent = world.paused ? "PAUSED" : "RUNNING";
  $("#status-live").style.color = world.paused ? "#e8be65" : "#91a0aa";
  $("#status-sim-detail").innerHTML = `${(world.daysPerSecond * world.speed).toFixed(2)} days / sec <i>·</i> LOCAL SAVE ENABLED`;
  $("#pause-btn").classList.toggle("paused", world.paused);
  $("#pause-btn").textContent = world.paused ? "▶" : "Ⅱ";
  $("#speed-select").value = String(world.speed || 1);
  const unread = world.notifications.some((n) => n.unread);
  $("#notification-dot").classList.toggle("show", unread);
  $("#news-dot").classList.toggle("show", unread);
  $("#mayor-name").textContent = city.mayor.name;
  $("#mayor-avatar").textContent = city.mayor.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  document.title = `${city.name} · ${formatCrown(city.treasury)} — Project Crown`;
}

function gameLoop(timestamp) {
  if (gameScreen.hidden || !world) return;
  const dt = Math.min(0.25, (timestamp - (lastFrame || timestamp)) / 1000);
  lastFrame = timestamp;
  const oldMonthKey = `${world.year}-${world.calendar?.monthIndex ?? 0}`;
  const signals = CrownWorld.advance(world, dt);
  const newMonthKey = `${world.year}-${world.calendar?.monthIndex ?? 0}`;
  if (signals.some((s) => s?.startsWith("month:")) || oldMonthKey !== newMonthKey) {
    const newNews = world.news.filter((n) => n.timestamp > timestamp - 1000);
    if (newNews.length) playTone("news");
    renderPage();
    lastRenderMonth = newMonthKey;
  }
  if (timestamp - lastHudUpdate > 550) {
    updateHud();
    lastHudUpdate = timestamp;
  }
  if (world.autosaveEnabled && performance.now() - lastAutosaveAt > 5 * 60 * 1000 && !autoSavePromise) {
    autoSavePromise = storage.saveWorld(world, { isAutosave: true, existingId: "autosave_primary" }).then(() => {
      lastAutosaveAt = performance.now();
      if (!gameScreen.hidden) showToast("Autosaved", `${playerCity().name} · ${getDateLabel()}`, "info", "▣", 2400);
    }).catch(() => {}).finally(() => { autoSavePromise = null; });
  }
  requestAnimationFrame(gameLoop);
}

function navigate(page) {
  if (!PAGE_NAMES[page]) return;
  currentPage = page;
  $$(".nav-item[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
  $("#top-page-name").textContent = PAGE_NAMES[page];
  if (page === "world") {
    world.notifications.forEach((n) => { if (n.type === "world" || n.type === "info") n.unread = false; });
  }
  renderPage();
  updateHud();
  if (window.innerWidth < 780) $("#page-scroll").scrollTo({ top: 0, behavior: "smooth" });
}

function renderPage() {
  if (!world) return;
  const routes = {
    overview: renderOverview,
    economy: renderEconomy,
    infrastructure: renderInfrastructure,
    housing: renderHousing,
    transport: renderTransport,
    companies: renderCompanies,
    contracts: renderContracts,
    citizens: renderCitizens,
    trade: renderTrade,
    research: renderResearch,
    world: renderWorldPage,
    history: renderHistory,
    settings: renderSettings
  };
  pageContent.innerHTML = (routes[currentPage] || renderOverview)();
  requestAnimationFrame(() => {
    drawCharts();
    if (currentPage === "world") initKaboomMap();
    if (currentPage === "companies") paintCompanyLogos();
  });
}

function pageHeading(kicker, title, subtitle = "", actions = "") {
  return `<div class="page-heading"><div class="page-heading-left"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div><div class="heading-actions">${actions}</div></div>`;
}
function metricCard(label, value, note, icon, trend = null, color = "") {
  const change = trend == null ? "" : valueChange(trend, label === "Population" ? " / mo" : "");
  return `<div class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon ${color}">${icon}</span></div><div class="metric-value ${String(value).length > 8 ? "small" : ""}">${value}</div><div class="metric-bottom"><span>${note}</span>${change}</div></div>`;
}
function panelHead(icon, title, trailing = "") { return `<div class="panel-head"><div class="panel-title"><span class="title-icon">${icon}</span>${title}</div>${trailing}</div>`; }
function panel(icon, title, body, trailing = "", classes = "") { return `<section class="panel ${classes}">${panelHead(icon, title, trailing)}<div class="panel-body">${body}</div></section>`; }
function fakeSparkline(id, color = "#48d6b0") { return `<canvas class="sparkline" id="${id}" aria-hidden="true" data-color="${color}"></canvas>`; }

function renderOverview() {
  const city = playerCity();
  const cityHQs = world.companies.filter((c) => c.headquartersCityId === city.id);
  const unread = world.news.slice(0, 4);
  const recentSnapshots = world.monthlyHistory.slice(-5);
  const healthAlerts = [];
  if (city.monthlyProfit < 0) healthAlerts.push(["Budget deficit", "Current spending is higher than monthly revenue.", "negative"]);
  if (city.happiness < 45) healthAlerts.push(["Public satisfaction falling", "Consider easing taxes or improving local services.", "warning"]);
  if (city.crime > 35) healthAlerts.push(["Crime needs attention", "Police coverage is below what residents expect.", "warning"]);
  if (city.cleanliness < 50) healthAlerts.push(["Cleanliness slipping", "Waste collection and parks can help restore the city.", "warning"]);
  if (!healthAlerts.length) healthAlerts.push(["All systems steady", "Your administration has room to plan the next investment.", "positive"]);
  const jobsDemand = Math.round(city.population * (city.employment / 100) * .43);
  const serviceRows = [["Education", city.education, "book"], ["Healthcare", city.health, "heart"], ["Cleanliness", city.cleanliness, "leaf"], ["Safety", 100 - city.crime, "shield"]];
  return `
    <div class="overview-headline"><div><div class="welcome-title">Good morning, <span>Mayor.</span></div><div class="welcome-subtitle">${city.name} · ${city.countryName} <span class="muted">·</span> ${GEOGRAPHY_TYPES[city.geography]?.label || city.geography} <span class="muted">·</span> ${city.climate}</div></div><div class="live-world-badge"><i></i> THE WORLD IS MOVING</div></div>
    <div class="stats-grid">
      ${metricCard("Population", formatCompact(city.population), `${city.populationDelta >= 0 ? "+" : ""}${formatNumber(city.populationDelta)} this month`, "♙", city.populationDelta)}
      ${metricCard("Treasury", formatCrown(city.treasury), "Municipal reserve", "◈", city.monthlyProfit)}
      ${metricCard("Monthly balance", formatCrown(city.monthlyProfit), `${formatCrown(city.monthlyIncome)} income`, "↗", city.monthlyProfit)}
      ${metricCard("Public approval", `${Math.round(city.approval)}%`, "Mayor's confidence", "✳", city.approval - 65)}
      ${metricCard("Happiness", `${Math.round(city.happiness)}%`, "Citizen satisfaction", "♡", city.happiness - 65)}
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-left">
        <section class="panel chart-card">${panelHead("⌁", "City at a glance", `<div class="chart-legend"><span class="legend-line"><i></i> POPULATION</span><span class="legend-line"><i class="gold-line"></i> APPROVAL</span></div>`)}<div class="panel-body"><div class="chart-wrap"><canvas id="overview-chart" aria-label="Population and public approval trend chart"></canvas></div><div class="chart-legend"><span>LAST 12 MONTHS</span><span class="small-note">CITY HISTORY · MONTHLY</span></div></div></section>
        ${panel("▤", "The city's pulse", `<div class="pulse-row"><span>Employment</span><span class="pulse-value">${Math.round(city.employment)}%</span></div><div class="pulse-row"><span>Estimated job openings</span><span class="pulse-value">${formatNumber(Math.max(0, city.jobs - jobsDemand))}</span></div><div class="pulse-row"><span>GDP · annual estimate</span><span class="pulse-value">${formatCrown(city.gdp)}</span></div><div class="pulse-row"><span>Tourism index</span><span class="pulse-value">${Math.round(city.tourism)} <span class="muted">/ 100</span></span></div><div class="pulse-row"><span>Companies headquartered</span><span class="pulse-value">${cityHQs.length} <span class="muted">/ ${world.companies.length} nearby</span></span></div><div style="margin-top:11px">${serviceRows.map(([name, value, icon]) => `<div class="service-mini"><span class="service-mini-label">${icon === "book" ? "Education" : icon === "heart" ? "Healthcare" : icon === "leaf" ? "Cleanliness" : "Safety"}</span><div class="progress-track"><div class="progress-fill ${value < 45 ? "red-fill" : value < 65 ? "gold-fill" : ""}" style="width:${clamp(value, 0, 100)}%"></div></div><span class="service-mini-value">${Math.round(value)}</span></div>`).join("")}</div>`, `<button class="text-action" data-action="navigate" data-page="citizens">CITIZENS →</button>`)}
        <div class="worldline-panel"><div class="worldline-icon">◈</div><div class="worldline-copy"><b>The world doesn't wait for the mayor.</b><p>${world.companies.length} companies, ${formatCompact(world.settlements.length)} settlements, and a whole lot of ambition—already in motion.</p></div><button data-action="navigate" data-page="world">EXPLORE WORLD →</button></div>
      </div>
      <div class="dashboard-right">
        ${panel("◉", "Needs your attention", `<div class="news-list">${healthAlerts.map(([title, msg, type]) => `<div class="news-row ${type}"><div class="news-icon">${type === "negative" ? "!" : type === "warning" ? "⌁" : "✓"}</div><div><b>${title}</b><p>${msg}</p></div><time>NOW</time></div>`).join("")}</div>`, "<span class='tag teal-tag'>CITY STATUS</span>")}
        <section class="panel news-panel">${panelHead("▣", "Around your city", `<button class="text-action" data-action="navigate" data-page="world">ALL NEWS →</button>`)}<div class="panel-body"><div class="news-list">${unread.length ? unread.map((item) => `<div class="news-row ${item.type === "warning" ? "warning" : item.type === "negative" ? "negative" : "positive"}"><div class="news-icon">${item.icon || "◈"}</div><div><b>${safe(item.title)}</b><p>${safe(item.description)}</p></div><time>${safe(item.date || "TODAY")}</time></div>`).join("") : `<div class="empty-state"><div class="empty-icon">▣</div><b>Quiet on the waterfront</b><p>New developments will find their way here.</p></div>`}</div></div></section>
        ${panel("📋", "On your desk", `<div class="pulse-row"><span>Open government bids</span><span class="pulse-value">${world.contracts.filter((c) => c.status === "offered").length}</span></div><div class="pulse-row"><span>Projects underway</span><span class="pulse-value">${city.projects.length}</span></div><div class="pulse-row"><span>Active research</span><span class="pulse-value">${CrownWorld.getActiveTechnology(world)?.name || "Choose a research path"}</span></div><button class="soft-btn" style="width:100%;margin-top:10px" data-action="navigate" data-page="contracts">Review contracts <span style="float:right">→</span></button>`, `<span class='small-note'>${getDateLabel()}</span>`)}
      </div>
    </div>`;
}

function renderEconomy() {
  const city = playerCity();
  const savings = Math.max(0, Math.round(city.treasury / Math.max(1, city.monthlyExpenses)));
  const taxRows = TAX_CATEGORIES.map((tax) => {
    const rate = city.taxes[tax.id] ?? tax.defaultRate;
    const impact = rate > 17 ? "Business flight risk" : rate < 6 ? "Revenue opportunity" : "Balanced tax burden";
    return `<tr><td>${tax.name}<span class="td-note">${tax.desc}</span></td><td><div class="tax-slider"><input type="range" min="${tax.min}" max="${tax.max}" value="${rate}" data-tax="${tax.id}" /><output id="tax-value-${tax.id}">${rate}%</output></div></td><td class="tax-impact">${impact}</td></tr>`;
  }).join("");
  const avgBudget = Math.round(Object.values(city.budgets).reduce((a, b) => a + b, 0) / Object.values(city.budgets).length);
  const policyRows = POLICIES.map((policy) => `<div class="policy-card"><div class="policy-icon">${policy.id === "recycling" || policy.id === "green_energy" ? "♧" : policy.id === "tech_incentives" ? "✳" : policy.id === "free_transit" ? "↔" : policy.id === "tourism_promo" ? "☆" : "◈"}</div><div class="policy-copy"><b>${policy.name}</b><p>${policy.desc}</p></div><button class="policy-toggle ${city.activePolicies.includes(policy.id) ? "on" : ""}" data-action="toggle-policy" data-id="${policy.id}" aria-label="Toggle ${safe(policy.name)}"></button></div>`).join("");
  return `${pageHeading("FINANCE & PUBLIC POLICY", "Economy & budget", "Every civic choice has a price. Every tax has a constituency.", `<button class="outline-btn" data-action="take-loan">◈ Borrow funds</button>`)}
    <div class="economy-stats">${metricCard("City treasury", formatCrown(city.treasury), `${savings} months of runway`, "◈", city.treasury - (city.previousTreasury || city.treasury))}${metricCard("Monthly revenue", formatCrown(city.monthlyIncome), "Taxes · commerce · visitors", "↗", city.monthlyIncome * .035)}${metricCard("Monthly spending", formatCrown(city.monthlyExpenses), "Services · payroll · policy", "↘", -city.monthlyExpenses * .02)}${metricCard("Budget position", formatCrown(city.monthlyProfit), city.monthlyProfit >= 0 ? "Surplus this month" : "Deficit this month", "⌁", city.monthlyProfit)}</div>
    <div class="economy-grid"><div class="dashboard-left">
      ${panel("◈", "Revenue & tax policy", `<table class="budget-table"><thead><tr><th>REVENUE SOURCE</th><th>TAX RATE</th><th>POLICY OUTLOOK</th></tr></thead><tbody>${taxRows}</tbody></table><div style="margin-top:14px;padding:11px 12px;background:#111a23;border:1px solid #253440;border-radius:4px;font-size:9px;color:#85959e;line-height:1.55">Tax changes take effect at the next monthly budget review. Businesses and households respond gradually—watch approval and relocation risk.</div>`, `<span class="tag gold-tag">10 TAX LEVERS</span>`)}
      ${panel("▤", "Department funding", `<div class="small-note" style="margin:-1px 0 11px">${avgBudget}% average funding · Lower funding saves cash but degrades services over time.</div>${BUDGET_DEPARTMENTS.map((dept) => { const val = city.budgets[dept.id] ?? 100; return `<div class="budget-line"><span>${dept.name}</span><label class="tiny-slider"><input type="range" min="50" max="150" step="5" value="${val}" data-budget="${dept.id}" /><output id="budget-value-${dept.id}">${val}%</output></label></div>`; }).join("")}`, "<span class='panel-subtitle'>50—150%</span>")}
    </div><div class="dashboard-right">
      ${panel("♧", "City policies", `<div class="policy-list">${policyRows}</div>`, `<span class="panel-subtitle">TRADE-OFFS MATTER</span>`)}
      ${panel("▧", "Credit & borrowing", `<div class="pulse-row"><span>Credit rating</span><span class="pulse-value">${city.loan?.creditRating || (city.approval > 75 ? "A" : city.approval > 55 ? "BBB" : "BB")}</span></div><div class="pulse-row"><span>Current civic debt</span><span class="pulse-value">${formatCrown(city.loan?.remaining || 0)}</span></div><div class="pulse-row"><span>Available reserve</span><span class="pulse-value">${formatCrown(city.treasury)}</span></div><div style="font-size:9px;line-height:1.55;color:#83939d;margin-top:12px">A development loan can unlock early improvements. Principal, interest, and monthly repayments are recorded in the city ledger.</div><button class="soft-btn" style="width:100%;margin-top:11px" data-action="take-loan">Apply for a ◈ 150K development loan</button>`, `<span class="tag blue-tag">${city.loan ? "ACTIVE LOAN" : "NO DEBT"}</span>`)}
      ${panel("↗", "Economic outlook", `<div class="worldline-copy"><b>${world.global.economicCycle} cycle</b><p>Regional inflation is ${world.global.inflation.toFixed(1)}%. Companies and market prices continue to change across the world while you plan.</p></div><div class="pulse-row" style="margin-top:11px"><span>Inflation</span><span class="pulse-value">${world.global.inflation.toFixed(1)}%</span></div><div class="pulse-row"><span>Business confidence</span><span class="pulse-value">${Math.round(city.businessConfidence)} / 100</span></div>`)}
    </div></div>`;
}

function renderInfrastructure() {
  const city = playerCity();
  const average = Object.values(city.infrastructure).reduce((a, b) => a + b, 0) / Object.keys(city.infrastructure).length;
  const summary = INFRASTRUCTURE_CATEGORIES.slice(0, 8).map((item) => `<div class="infra-card"><div class="infra-card-top"><span class="infra-card-icon">${infraGlyph(item.id)}</span><span class="tag">LVL ${city.infrastructure[item.id]}</span></div><div class="infra-card-name">${item.name.replace(" Network", "")}</div><div class="infra-card-level">Level ${city.infrastructure[item.id]} <span class="muted">/ 10</span></div><div class="progress-track"><div class="progress-fill ${city.infrastructure[item.id] < 3 ? "gold-fill" : ""}" style="width:${city.infrastructure[item.id] * 10}%"></div></div></div>`).join("");
  const rows = INFRASTRUCTURE_CATEGORIES.map((item) => {
    const level = city.infrastructure[item.id];
    const cost = Math.round(item.baseCost * Math.pow(level, 1.38) * (DIFFICULTIES[world.difficulty]?.costMult || 1) * (GEOGRAPHY_TYPES[city.geography]?.expansionCostMult || 1));
    const active = city.projects.some((p) => p.category === item.id);
    const disabled = level >= 10 || city.treasury < cost && !world.sandbox || active;
    return `<div class="infra-row"><div class="infra-row-icon">${infraGlyph(item.id)}</div><div class="infra-row-title"><b>${item.name}</b><small>${item.desc}</small></div><span class="infra-level">LEVEL ${level} / 10</span><span class="infra-maint">${formatCrown(item.baseMaint * Math.pow(level, 1.22))}<br /><span class="muted">/ month upkeep</span></span><button class="upgrade-btn" data-action="upgrade" data-id="${item.id}" ${disabled ? "disabled" : ""}>${active ? "IN PROGRESS" : level >= 10 ? "MAX LEVEL" : `UPGRADE · ${formatCrown(cost)}`}</button></div>`;
  }).join("");
  const projects = city.projects.length ? city.projects.map((project) => `<div class="project-item"><div class="project-meta"><b>${project.name}</b><span>${project.daysLeft} DAYS LEFT</span></div><div class="progress-track"><div class="progress-fill" style="width:${clamp(100 - project.daysLeft / 2, 4, 94)}%"></div></div><small>${project.kind === "monument" ? "LANDMARK PROJECT" : `CIVIC WORKS · ${formatCrown(project.cost)}`}</small></div>`).join("") : `<div class="empty-state"><div class="empty-icon">⌁</div><b>Nothing under construction</b><p>Infrastructure projects and landmarks will appear here as your city grows.</p></div>`;
  const monuments = MONUMENTS.filter((m) => !city.landmarks.includes(m.name)).slice(0, 3).map((monument) => `<div class="pulse-row"><span>${monument.name}</span><button class="table-action" data-action="monument" data-id="${monument.id}">PLAN · ${formatCrown(monument.cost)}</button></div>`).join("");
  return `${pageHeading("CIVIC WORKS", "Infrastructure", "Invest in the foundations that let a settlement become a city.", `<span class="tag teal-tag">${city.infrastructureRating.toFixed(0)} INFRA RATING</span>`)}
    <div class="infrastructure-overview">${summary}</div><div class="infra-main-grid"><div>${panel("▤", "Public services & networks", `<div class="infra-list">${rows}</div>`, `<span class="panel-subtitle">${INFRASTRUCTURE_CATEGORIES.length} SYSTEMS</span>`)}
      ${panel("⌂", "Landmarks & monuments", `${monuments || "<div class='small-note'>Every available landmark has been built.</div>"}<div class="small-note" style="line-height:1.6;margin-top:12px">A completed landmark adds to the city's permanent reputation and visitor appeal.</div>`, "<span class='tag gold-tag'>LEGACY PROJECTS</span>")}
    </div><div class="dashboard-right">${panel("⌁", "Construction queue", `<div>${projects}</div>`, `<span class="tag">${city.projects.length} PROJECT${city.projects.length === 1 ? "" : "S"}</span>`)}${panel("⌂", "A settlement on the rise", `<div class="pulse-row"><span>Location</span><span class="pulse-value">${GEOGRAPHY_TYPES[city.geography]?.label}</span></div><div class="pulse-row"><span>Expansion costs</span><span class="pulse-value">${Math.round((GEOGRAPHY_TYPES[city.geography]?.expansionCostMult || 1) * 100)}% baseline</span></div><div class="pulse-row"><span>Average service level</span><span class="pulse-value">${average.toFixed(1)} / 10</span></div><p style="color:#82929b;font-size:9px;line-height:1.6;margin:11px 0 0">${(GEOGRAPHY_TYPES[city.geography]?.bonuses || []).join(" · ")}</p>`)}</div></div>`;
}
function infraGlyph(id) { return ({ roads: "↔", water: "≈", electricity: "ϟ", internet: "▦", healthcare: "✚", education: "▤", police: "⬡", fire: "♨", garbage: "♧", sewage: "≈", parks: "♧", transit: "↔", government: "▥", emergency: "⚠" })[id] || "◈"; }

function renderHousing() {
  const city = playerCity();
  const demand = clamp(Math.round((city.happiness * .38 + city.employment * .32 + city.approval * .2 + city.infrastructureRating * .1) + (city.populationDelta > 0 ? 8 : -8)), 8, 100);
  const priceBase = 85000 + city.wealth * 2100 + city.infrastructureRating * 650 + city.tourism * 300;
  const avgRent = Math.round(priceBase * 0.0085);
  const shortage = clamp(Math.round(demand - 48 + city.populationDelta * .15), -24, 54);
  const districts = city.districts?.length ? city.districts : [];
  const districtRows = districts.map((d) => {
    const land = clamp(d.landValue + (city.happiness - 65) * .09 - city.crime * .05 + city.infrastructureRating * .025 - city.pollution * .045, 12, 100);
    return `<tr><td><b>${d.name}</b><span class="td-note">${d.type} · ${d.density} density</span></td><td><span class="resource-price">${formatCrown(priceBase * land / 52)}</span></td><td><span class="tag ${land > 70 ? "gold-tag" : ""}">${Math.round(land)} INDEX</span></td><td>${Math.round(100 * d.housingShare)}%</td></tr>`;
  }).join("");
  const housingTypes = [["Affordable housing", "Needs public investment", city.activePolicies.includes("affordable_housing") ? "POLICY ACTIVE" : "LOW SUPPLY"], ["Apartments & townhouses", "Tracks job growth", demand > 58 ? "DEVELOPING" : "STABLE"], ["Detached homes", "Suburban preference", city.geography === "Plains" ? "LAND AVAILABLE" : "MODERATE"], ["Waterfront & luxury", "Tourism and wealth", ["Ocean", "River", "Lake"].includes(city.geography) ? "SCENIC PREMIUM" : "LIMITED"]];
  return `${pageHeading("HOUSING & LAND VALUE", "Homes & districts", "Demand responds to jobs, incomes, services, safety, and the reputation you build.", `<button class="soft-btn" data-action="navigate" data-page="economy">⌁ Housing policy</button>`)}
    <div class="economy-stats">${metricCard("Housing demand", `${demand}%`, demand > 65 ? "Developers are watching" : "Room for growth", "⌂", demand - 50)}${metricCard("Average home value", formatCrown(priceBase), "Citywide estimate", "◈", city.wealth - 50)}${metricCard("Typical monthly rent", formatCrown(avgRent), "Median household estimate", "▤", -shortage)}${metricCard("Supply pressure", shortage > 12 ? "Tight" : shortage < -7 ? "Surplus" : "Balanced", `${shortage > 0 ? "+" : ""}${shortage} index points`, "⌁", -shortage)}</div>
    <div class="economy-grid"><div>${panel("⌂", "District land values", `<table class="budget-table"><thead><tr><th>DISTRICT</th><th>EST. PROPERTY VALUE</th><th>LAND INDEX</th><th>HOUSING SHARE</th></tr></thead><tbody>${districtRows}</tbody></table>`, `<span class="panel-subtitle">${districts.length} DISTRICTS</span>`)}${panel("▤", "Housing mix", `<div class="policy-list">${housingTypes.map(([name, detail, tag]) => `<div class="policy-card"><div class="policy-icon">⌂</div><div class="policy-copy"><b>${name}</b><p>${detail}</p></div><span class="tag ${tag === "LOW SUPPLY" ? "gold-tag" : ""}">${tag}</span></div>`).join("")}</div>`)}</div>
      <div class="dashboard-right">${panel("⌁", "What shapes the market", `<div class="pulse-row"><span>Population trend</span><span class="pulse-value ${city.populationDelta >= 0 ? "positive" : "negative"}">${city.populationDelta >= 0 ? "+" : ""}${formatNumber(city.populationDelta)} / mo</span></div><div class="pulse-row"><span>Employment</span><span class="pulse-value">${city.employment.toFixed(1)}%</span></div><div class="pulse-row"><span>Safety rating</span><span class="pulse-value">${(100 - city.crime).toFixed(0)} / 100</span></div><div class="pulse-row"><span>Quality of life</span><span class="pulse-value">${city.happiness.toFixed(0)} / 100</span></div><div class="pulse-row"><span>Affordable housing act</span><span class="pulse-value">${city.activePolicies.includes("affordable_housing") ? "ACTIVE" : "OFF"}</span></div>`)}${panel("♧", "Land values respond to", `<div class="service-mini"><span class="service-mini-label">Safety</span><div class="progress-track"><div class="progress-fill" style="width:${100 - city.crime}%"></div></div><span class="service-mini-value">${(100 - city.crime).toFixed(0)}</span></div><div class="service-mini"><span class="service-mini-label">Clean air</span><div class="progress-track"><div class="progress-fill" style="width:${100 - city.pollution}%"></div></div><span class="service-mini-value">${(100 - city.pollution).toFixed(0)}</span></div><div class="service-mini"><span class="service-mini-label">City services</span><div class="progress-track"><div class="progress-fill" style="width:${city.infrastructureRating}%"></div></div><span class="service-mini-value">${city.infrastructureRating.toFixed(0)}</span></div><p style="color:#84949d;font-size:9px;line-height:1.6;margin:12px 0 0">Parks, schools, transport, low crime, and clean air all make a district more desirable.</p>`)}</div></div>`;
}

function renderTransport() {
  const city = playerCity();
  const coast = ["Ocean", "River"].includes(city.geography);
  const road = city.infrastructure.roads;
  const transit = city.infrastructure.transit;
  const traffic = clamp(Math.round(18 + city.population / 1800 - road * 4.2 - transit * 3.8), 2, 94);
  const seaBonus = GEOGRAPHY_TYPES[city.geography]?.tradeBonus || 1;
  const systems = [
    ["Road freight", "Highway and regional road links", road, "roads", "↔", `${Math.round(100 - traffic)}% flow`],
    ["City bus network", "Coverage for workers and families", transit, "transit", "▰", `${Math.round(transit * 9.5)}% coverage`],
    ["Commuter & freight rail", "Regional passenger and cargo lines", Math.max(1, transit - 1), "transit", "▤", `${Math.round(transit * 670)} daily riders`],
    [coast ? "Harbor & sea links" : "Port access", coast ? "Waterborne trade and coastal visitors" : "Requires river or ocean frontage", coast ? city.infrastructure.roads : 0, "roads", "⚓", coast ? `${Math.round((seaBonus - 1) * 100 + 100)}% sea trade index` : "NOT AVAILABLE"]
  ];
  return `${pageHeading("MOBILITY & LOGISTICS", "Transportation", "Move residents to work, goods to market, and opportunity between cities.", `<button class="soft-btn" data-action="navigate" data-page="infrastructure">Upgrade networks →</button>`)}
    <div class="economy-stats">${metricCard("Road condition", `${Math.min(100, road * 9 + 34)}%`, `Network level ${road}`, "↔", road - 4)}${metricCard("Traffic pressure", `${traffic}%`, traffic > 65 ? "Commuters are losing time" : "Flow is manageable", "⌁", 44 - traffic)}${metricCard("Transit coverage", `${Math.round(transit * 9.5)}%`, `Network level ${transit}`, "▰", transit - 3)}${metricCard("Trade efficiency", `${Math.round(clamp(44 + road * 5 + transit * 2.8 + (coast ? 9 : 0), 20, 98))}%`, coast ? "Coastal trade advantage" : "Land routes only", "⇄", road * 2)}</div>
    <div class="infra-main-grid"><div>${panel("↔", "Regional transport systems", systems.map(([name, desc, level, id, icon, status]) => `<div class="infra-row"><div class="infra-row-icon">${icon}</div><div class="infra-row-title"><b>${name}</b><small>${desc}</small></div><span class="infra-level">${level ? `LEVEL ${level}` : "LOCKED"}</span><span class="infra-maint">${status}</span><button class="upgrade-btn" data-action="navigate" data-page="infrastructure">${level ? "VIEW NETWORK" : "LOCATION NEEDED"}</button></div>`).join(""), `<span class="tag ${coast ? "teal-tag" : ""}">${coast ? "WATER ACCESS" : "INLAND"}</span>`)}${panel("▤", "Mobility priorities", `<div class="policy-list">${[["Public transit funding", "Spend more to extend routes, keep fares predictable, and attract workers.", city.budgets.transit || 100], ["Road maintenance", "A reliable road surface reduces freight times and repair costs.", city.budgets.roads || 100], ["Green travel policy", "Low-emission zones lower pollution while easing peak traffic.", city.activePolicies.includes("smart_traffic") ? 100 : 0]].map(([label, desc, val]) => `<div class="policy-card"><div class="policy-icon">↔</div><div class="policy-copy"><b>${label}</b><p>${desc}</p></div><span class="tag ${val > 0 ? "teal-tag" : ""}">${typeof val === "number" && val <= 100 ? `${Math.round(val)}%` : val}</span></div>`).join("")}</div><button class="soft-btn" style="width:100%;margin-top:12px" data-action="navigate" data-page="economy">Change transport budget →</button>`)}</div>
      <div class="dashboard-right">${panel("⇄", "Freight & trade routes", `<div class="pulse-row"><span>Local export value</span><span class="pulse-value">${formatCrown(city.exports)}</span></div><div class="pulse-row"><span>Import costs</span><span class="pulse-value">${formatCrown(city.imports)}</span></div><div class="pulse-row"><span>Trade balance</span><span class="pulse-value ${city.tradeBalance >= 0 ? "positive" : "negative"}">${formatCrown(city.tradeBalance)}</span></div><div class="pulse-row"><span>Sea connection</span><span class="pulse-value">${coast ? "AVAILABLE" : "LANDLOCKED"}</span></div><div class="small-note" style="line-height:1.55;margin-top:10px">AI settlements search for the cheapest suppliers. New roads, railways, ports, and global demand all reshape the routes.</div>`, "<span class='tag'>WORLD ECONOMY</span>")}${panel("◈", "Infrastructure outlook", `<div class="worldline-copy"><b>${traffic > 65 ? "Commuters are feeling the squeeze" : "The city keeps moving"}</b><p>${traffic > 65 ? "Upgrade roads or public transit before congestion slows business and citizen satisfaction." : "A reliable network attracts new employers and puts more of your region within reach."}</p></div><button class="soft-btn" style="width:100%;margin-top:12px" data-action="navigate" data-page="infrastructure">Plan a network upgrade →</button>`)}</div></div>`;
}

function renderCompanies() {
  const city = playerCity();
  const filters = ["All industries", ...new Set(world.companies.map((c) => c.industry))];
  const hqs = world.companies.filter((c) => c.headquartersCityId === city.id);
  const notable = hqs[0] || world.companies.find((c) => c.name === "Royal Yacht Company") || world.companies[0];
  return `${pageHeading("BUSINESS & CORPORATE LIFE", "Companies", "Independent companies expand, compete, relocate, and create a life of their own.", `<span class="tag">${world.companies.length} WORLDWIDE</span>`)}
    <div class="company-highlight">${cityLogo(notable, 44)}<div class="company-highlight-copy"><div class="eyebrow">${hqs.length ? "BASED IN YOUR CITY" : "A COMPANY TO WATCH"}</div><b>${safe(notable.name)}</b><small>${safe(notable.slogan)} · ${safe(notable.industry)}</small></div><div class="company-highlight-stat"><div class="eyebrow">MARKET VALUE</div><b class="mono">${formatCrown(notable.marketValue)}</b></div><button class="table-action" data-action="inspect-company" data-id="${notable.id}">VIEW PROFILE ↗</button></div>
    <div class="economy-stats">${metricCard("Headquarters here", `${hqs.length}`, "Companies calling this city home", "▦", hqs.length)}${metricCard("Local company jobs", formatCompact(hqs.reduce((sum,c)=>sum+c.employees,0)), "At headquarters", "♙", hqs.length)}${metricCard("Business confidence", `${Math.round(city.businessConfidence)}%`, "Corporate outlook", "↗", city.businessConfidence - 60)}${metricCard("Innovation rating", `${Math.round(city.innovation)}`, "Out of 100", "✳", city.innovation - 35)}</div>
    <div class="panel" style="overflow:hidden">${panelHead("▦", "The corporate world", `<span class="panel-subtitle">WORLD HEADQUARTERS · DYNAMIC MARKET</span>`)}<div class="panel-body"><div class="company-list-toolbar"><input class="search-field" id="company-search" type="search" placeholder="Search company or industry…" /><select class="filter-select" id="company-filter">${filters.map((f) => `<option>${safe(f)}</option>`).join("")}</select><select class="filter-select" id="company-sort"><option value="value">Sort: Market value</option><option value="growth">Sort: Growth</option><option value="employees">Sort: Employees</option><option value="name">Sort: Company name</option></select></div><div style="overflow:auto"><table class="company-table"><thead><tr><th>COMPANY</th><th>INDUSTRY</th><th>HEADQUARTERS</th><th>EMPLOYEES</th><th>MARKET VALUE</th><th>GROWTH</th><th>ACTION</th></tr></thead><tbody id="company-table-body">${companyRows(world.companies)}</tbody></table></div></div></div>`;
}
function companyRows(companies) {
  return [...companies].sort((a, b) => b.marketValue - a.marketValue).map((company) => `<tr data-company-row data-name="${safe(company.name.toLowerCase())}" data-industry="${safe(company.industry)}" data-value="${company.marketValue}" data-growth="${company.growth}" data-employees="${company.employees}"><td><div class="company-identity">${cityLogo(company, 28)}<div><b>${safe(company.name)}</b><small>${safe(company.slogan)}</small></div></div></td><td><span class="tag">${safe(company.industry)}</span></td><td><span class="hq-pill">${safe(company.headquartersCityName)}</span></td><td class="mono">${formatCompact(company.employees)}</td><td class="mono">${formatCrown(company.marketValue)}</td><td class="${company.growth >= 0 ? "positive-num" : "negative"}">${company.growth >= 0 ? "+" : ""}${company.growth.toFixed(1)}%</td><td><button class="table-action" data-action="inspect-company" data-id="${company.id}">PROFILE</button></td></tr>`).join("");
}

function renderContracts() {
  const city = playerCity();
  const contracts = [...world.contracts].filter((c) => ["offered", "accepted", "completed"].includes(c.status));
  const offered = contracts.filter((c) => c.status === "offered");
  const accepted = contracts.filter((c) => c.status === "accepted");
  const cards = contracts.map((contract) => {
    const wonChance = CrownWorld.calculateBidChance(world, contract);
    const accepted = contract.status === "accepted";
    return `<article class="contract-card ${accepted ? "accepted" : ""} ${contract.status === "completed" ? "completed" : ""}"><div class="contract-card-top"><div class="contract-icon">${contract.icon === "book" ? "▤" : contract.icon === "anchor" ? "⚓" : contract.icon === "heart" ? "✚" : contract.icon === "leaf" ? "♧" : contract.icon === "train" ? "↔" : "✳"}</div><div><h3>${safe(contract.title)}</h3><span class="sponsor">SPONSORED BY ${safe(contract.sponsor.toUpperCase())}</span></div><span class="contract-status tag ${accepted ? "teal-tag" : contract.status === "completed" ? "gold-tag" : ""}">${accepted ? "IN PROGRESS" : contract.status === "completed" ? "DELIVERED" : "OPEN BID"}</span></div><p>Requirements: ${safe(contract.requirement)}. ${accepted ? `Your city has ${contract.daysLeft} days to deliver.` : "Rival cities are also preparing offers."}</p><div class="contract-stats"><div>PROJECT GRANT<b>${formatCrown(contract.reward)}</b></div><div>EST. JOBS<b>+${formatNumber(contract.jobs)}</b></div><div>DELIVERY<b>${contract.duration} MONTHS</b></div></div><div class="contract-bottom">${accepted ? `<span class="contract-bid">DELIVERY IN ${Math.ceil(contract.daysLeft / 30)} MONTHS · PUBLIC WORKS</span>` : contract.status === "completed" ? `<span class="contract-bid">COMPLETED · ${contract.completedYear || world.year}</span>` : `<label class="contract-bid">BID INCENTIVE <input class="bid-range" type="range" min="0" max="100" value="${contract.offer || 0}" data-bid-range="${contract.id}" /><output id="bid-value-${contract.id}">${contract.offer || 0}%</output></label>`}${accepted || contract.status === "completed" ? "" : `<button class="primary-btn" data-action="bid" data-id="${contract.id}">Submit bid →</button>`}</div><div class="small-note" style="margin-top:8px">Current estimated win chance: ${wonChance}% · offer lowers chance, increases the city's future tax incentives</div></article>`;
  }).join("");
  const requirements = [["Education", city.education, 60], ["Infrastructure", city.infrastructureRating, 60], ["Public approval", city.approval, 65], ["Cleanliness", city.cleanliness, 60]];
  return `${pageHeading("NATIONAL & REGIONAL OPPORTUNITIES", "Contracts & bids", "Compete with other mayors to bring long-term projects and jobs home.", `<span class="tag gold-tag">${offered.length} OPEN OPPORTUNITIES</span>`)}
    <div class="contract-grid"><div class="contract-list">${cards || `<div class="panel"><div class="empty-state"><div class="empty-icon">▧</div><b>No current contracts</b><p>New regional projects arrive as the world moves forward. Check back after the next budget cycle.</p></div></div>`}</div><aside class="dashboard-right"><section class="panel contract-sidebar-card">${panelHead("▧", "Your bid profile", "<span class='tag'>MAYOR'S OFFICE</span>")}<div class="panel-body"><p>Institutions weigh civic readiness, local needs, and your proposed incentives when choosing a host city.</p>${requirements.map(([label, value, threshold]) => `<div style="margin:12px 0"><div class="pulse-row" style="padding:0 0 6px;border:0"><span>${label}</span><span class="pulse-value">${Math.round(value)} / 100</span></div><div class="progress-track"><div class="progress-fill ${value < threshold ? "gold-fill" : ""}" style="width:${clamp(value, 0, 100)}%"></div></div></div>`).join("")}<div class="contract-stat"><span>Currently delivering</span><b>${accepted.length} contract${accepted.length === 1 ? "" : "s"}</b></div><div class="contract-stat"><span>Government grants won</span><b>${city.grantsWon}</b></div><div class="contract-stat"><span>Bid reputation</span><b>${city.approval >= 70 ? "Trusted" : "Developing"}</b></div></div></section>${panel("◈", "How to win", `<p style="font-size:9px;color:#8b9ba1;line-height:1.65;margin:0">Fund education and essential services to strengthen future bids. A larger incentive can help, but it commits your administration to tax concessions if the project is awarded.</p><button class="soft-btn" style="width:100%;margin-top:12px" data-action="navigate" data-page="infrastructure">Review city services →</button>`)}</aside></div>`;
}

function renderCitizens() {
  const city = playerCity();
  const people = world.people.filter((person) => person.cityId === city.id).slice(0, 10);
  const ageGroups = [["Children & teens", 21, "book"], ["Young adults", 19, "♙"], ["Working adults", 44, "▦"], ["Seniors", 16, "heart"]];
  const adult = Math.round(city.population * .61);
  return `${pageHeading("PEOPLE & PUBLIC LIFE", "Citizens & society", "A city's numbers have names, families, ambitions, and reasons to stay—or leave.", `<span class="tag teal-tag">${formatCompact(city.population)} RESIDENTS</span>`)}
    <div class="economy-stats">${metricCard("Residents", formatNumber(city.population), `${city.populationDelta >= 0 ? "+" : ""}${formatNumber(city.populationDelta)} this month`, "♙", city.populationDelta)}${metricCard("Employment", `${city.employment.toFixed(1)}%`, "Working-age participation", "▦", city.employment - 80)}${metricCard("Education", `${city.education.toFixed(0)} / 100`, `${city.infrastructure.education} service level`, "▤", city.education - 45)}${metricCard("Public health", `${city.health.toFixed(0)} / 100`, `${city.infrastructure.healthcare} healthcare level`, "✚", city.health - 60)}</div>
    <div class="economy-grid"><div>${panel("♙", "A city of generations", ageGroups.map(([label, share, icon]) => `<div class="service-mini"><span class="service-mini-label">${label}</span><div class="progress-track"><div class="progress-fill ${label.includes("Senior") ? "gold-fill" : ""}" style="width:${share}%"></div></div><span class="service-mini-value">${share}%</span></div><div class="pulse-row"><span>Estimated group</span><span class="pulse-value">${formatNumber(Math.round(city.population * share / 100))}</span></div>`).join("") + `<div class="pulse-row" style="margin-top:9px"><span>Families seeking work</span><span class="pulse-value">${formatNumber(Math.round(city.population * .16 * (1 - city.employment / 100)))}</span></div><div class="pulse-row"><span>Residents served by city jobs</span><span class="pulse-value">${formatNumber(adult)}</span></div>`, `<span class="panel-subtitle">POPULATION PROFILE</span>`)}${panel("♙", "Community wellbeing", `<div class="pulse-row"><span>Happiness</span><span class="pulse-value">${city.happiness.toFixed(0)} / 100</span></div><div class="pulse-row"><span>Mayor approval</span><span class="pulse-value">${city.approval.toFixed(0)} / 100</span></div><div class="pulse-row"><span>Crime</span><span class="pulse-value">${city.crime.toFixed(0)} / 100</span></div><div class="pulse-row"><span>Healthcare access</span><span class="pulse-value">Level ${city.infrastructure.healthcare}</span></div><div class="pulse-row"><span>Schools & universities</span><span class="pulse-value">Level ${city.infrastructure.education}</span></div><button class="soft-btn" style="width:100%;margin-top:12px" data-action="navigate" data-page="economy">Review policies & taxes →</button>`)}</div>
      <div class="dashboard-right">${panel("⚖", "Your city council", city.council.length ? city.council.map((member) => `<div class="pulse-row"><span><b style="display:block;color:#d6e0e2;font-size:9px">${safe(member.name)}</b><small style="display:block;color:#778a94;font-size:8px;margin-top:3px">${safe(member.role)}</small></span><span class="pulse-value">${member.approval}%</span></div>`).join("") : "<div class='small-note'>Council seats are elected as the settlement grows.</div>" , `<span class="tag">${city.council.length} MEMBERS</span>`)}${panel("✦", "Notable residents", people.length ? people.map((person) => `<div class="pulse-row"><span><b style="color:#d5dfe0;font-size:9px">${safe(person.name)}</b><small style="display:block;color:#7e909a;font-size:8px;margin-top:3px">${safe(person.occupation)} · ${person.age}</small></span><span class="tag">${person.wealthBand}</span></div>`).join("") : `<div class="empty-state"><div class="empty-icon">♙</div><b>New stories are being written</b><p>Notable residents may move to your city as it grows.</p></div>`, `<span class="panel-subtitle">${people.length} PEOPLE OF NOTE</span>`)}${panel("⌂", "What keeps a family here", `<div class="small-note" style="line-height:1.7">Stable work, attainable housing, safe streets, a clean environment, good schools, and access to care help your neighbors put down roots.</div><button class="soft-btn" style="width:100%;margin-top:12px" data-action="navigate" data-page="housing">View housing & districts →</button>`)}</div></div>`;
}

function renderTrade() {
  const city = playerCity();
  const resources = RESOURCES.map((resource) => {
    const price = city.prices[resource.id] || resource.basePrice;
    const base = resource.basePrice;
    const supply = city.resourceProduction[resource.id] || 0;
    const demand = city.resourceDemand[resource.id] || 0;
    const balance = supply - demand;
    return `<tr><td><b>${resource.name}</b><span class="td-note">${resource.tier} · ${resource.unit}</span></td><td class="resource-price">${formatCrown(price)}</td><td class="mono">${supply}</td><td class="mono">${demand}</td><td class="${balance >= 0 ? "positive-num" : "negative"}">${balance >= 0 ? "+" : ""}${balance}</td><td class="resource-trend ${price <= base ? "positive" : "gold"}">${price <= base ? "▼" : "▲"} ${Math.abs((price / base - 1) * 100).toFixed(0)}%</td></tr>`;
  }).join("");
  const deficit = RESOURCES.filter((resource) => (city.resourceProduction[resource.id] || 0) < (city.resourceDemand[resource.id] || 0)).length;
  return `${pageHeading("SUPPLY CHAINS & MARKETS", "Trade & resources", "Prices move with production, demand, distance, and events across the world.", `<span class="tag blue-tag">${world.global.economicCycle.toUpperCase()} CYCLE</span>`)}
    <div class="economy-stats">${metricCard("Exports", formatCrown(city.exports), "Monthly regional sales", "↗", city.exports * .025)}${metricCard("Imports", formatCrown(city.imports), "Goods brought in", "↙", -city.imports * .016)}${metricCard("Trade balance", formatCrown(city.tradeBalance), city.tradeBalance >= 0 ? "Net exporter" : "Net importer", "⇄", city.tradeBalance)}${metricCard("Supply gaps", `${deficit} goods`, "Demand exceeds production", "⌁", -deficit)}</div>
    <div class="economy-grid"><div>${panel("⇄", "Regional commodity exchange", `<div style="overflow:auto"><table class="resource-table"><thead><tr><th>COMMODITY</th><th>MARKET PRICE</th><th>LOCAL SUPPLY</th><th>LOCAL DEMAND</th><th>BALANCE</th><th>TREND</th></tr></thead><tbody>${resources}</tbody></table></div>`, `<span class="panel-subtitle">${RESOURCES.length} COMMODITIES · MONTHLY</span>`)}${panel("⌁", "A changing world economy", `<div class="pulse-row"><span>Global cycle</span><span class="pulse-value">${world.global.economicCycle}</span></div><div class="pulse-row"><span>Regional inflation</span><span class="pulse-value">${world.global.inflation.toFixed(1)}%</span></div><div class="pulse-row"><span>Regional links</span><span class="pulse-value">${Math.max(2, Math.round(Math.log10(world.settlements.length) * 2))} active corridors</span></div><div class="small-note" style="line-height:1.65;margin-top:11px">An industry closure in one settlement can push costs up everywhere. Distant mayors make decisions without asking permission.</div>`)}</div><div class="dashboard-right">${panel("◈", "Local production", `<div class="pulse-row"><span>Terrain advantage</span><span class="pulse-value">${GEOGRAPHY_TYPES[city.geography]?.label}</span></div><div class="pulse-row"><span>Exports / month</span><span class="pulse-value">${formatCrown(city.exports)}</span></div><div class="pulse-row"><span>Imports / month</span><span class="pulse-value">${formatCrown(city.imports)}</span></div><div class="pulse-row"><span>Foreign trade access</span><span class="pulse-value">${city.geography === "Ocean" ? "GLOBAL PORT" : ["River"].includes(city.geography) ? "RIVER ROUTE" : "INLAND NETWORK"}</span></div><p class="small-note" style="line-height:1.6;margin:11px 0 0">${(GEOGRAPHY_TYPES[city.geography]?.bonuses || []).join(" · ")}</p>`, "<span class='tag'>YOUR CITY</span>")}${panel("⌁", "Supply gaps", `<p class="small-note" style="line-height:1.6;margin-top:0">Shortages push up prices, but businesses may seek local suppliers if the market opportunity lasts.</p>${RESOURCES.filter((r) => (city.resourceProduction[r.id] || 0) < (city.resourceDemand[r.id] || 0)).slice(0, 5).map((r) => `<div class="pulse-row"><span>${r.name}</span><span class="negative">−${(city.resourceDemand[r.id] || 0) - (city.resourceProduction[r.id] || 0)} units</span></div>`).join("") || "<div class='small-note'>No immediate commodity shortages.</div>"}`)}</div></div>`;
}

function renderResearch() {
  const techs = TECH_ERAS.flatMap((era) => era.techs.map((tech) => ({ ...tech, era }))) ;
  const active = CrownWorld.getActiveTechnology(world);
  const completed = world.research.completed;
  const eraIndex = clamp(world.research.eraIndex || 0, 0, TECH_ERAS.length - 1);
  const progress = active ? clamp(world.research.progress / active.cost * 100, 0, 100) : 100;
  const eraNodes = TECH_ERAS.map((era, i) => `<div class="era-node ${i < eraIndex ? "done" : i === eraIndex ? "current" : ""}"><span class="era-dot">${i < eraIndex ? "✓" : i + 1}</span><span class="era-label">${era.name.replace(" Era", "")}</span></div>`).join("");
  const techCards = techs.map((tech) => {
    const done = completed.includes(tech.id);
    const isActive = world.research.active === tech.id;
    const erasUnlocked = completed.length >= (tech.era.minTechs || 0);
    return `<div class="technology-card ${isActive ? "active-tech" : ""} ${done ? "completed-tech" : ""}"><div class="tech-icon">${tech.category === "Transportation" ? "↔" : tech.category === "Energy" ? "ϟ" : tech.category === "Healthcare" ? "✚" : tech.category === "Computing" ? "▦" : tech.category === "Communication" ? "◉" : "✳"}</div><div><b>${safe(tech.name)}</b><small>${safe(tech.category)} · ${safe(tech.bonus)}</small></div><div class="tech-cost">${done ? "✓ COMPLETE" : isActive ? `${Math.round(progress)}%` : `◈ ${tech.cost}`}<br />${!done && !isActive && !erasUnlocked ? "<small>ERA LOCKED</small>" : ""}</div>${done ? "" : isActive ? `<span class="tag teal-tag">RESEARCHING</span>` : `<button class="tech-select" data-action="set-tech" data-id="${tech.id}" ${erasUnlocked ? "" : "disabled"}>${erasUnlocked ? "SELECT" : "LOCKED"}</button>`}</div>`;
  }).join("");
  return `${pageHeading("HUMAN PROGRESS", "Research & technology", "Discoveries spread through the world. Early adopters earn a lasting reputation.", `<span class="tag purple">${world.research.points} RESEARCH BANK</span>`)}
    <div class="research-hero"><div class="research-glyph">✳</div><div class="research-hero-copy"><div class="eyebrow">CURRENT BREAKTHROUGH · ${TECH_ERAS[eraIndex]?.name.toUpperCase()}</div><h2>${active ? active.name : "All known research completed"}</h2><p>${active ? `${active.category} · ${active.bonus}` : "The world is ready for its next leap."}</p></div><div class="research-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><small><span>${Math.floor(world.research.progress)} / ${active?.cost || 0} RP</span><span>${world.research.monthlyOutput} RP / mo</span></small></div></div>
    <div class="panel">${panelHead("✳", "Technology eras", `<span class="panel-subtitle">${completed.length} BREAKTHROUGHS RECORDED</span>`)}<div class="panel-body"><div class="era-track">${eraNodes}</div><div style="font-size:9px;line-height:1.5;color:#8392a0;margin:0 0 15px">${TECH_ERAS[eraIndex]?.desc || "Your city is helping shape global progress."}</div><div class="research-list">${techCards}</div></div></div>
    <div class="worldline-panel" style="margin-top:13px"><div class="worldline-icon">⌁</div><div class="worldline-copy"><b>Knowledge is a city-wide investment.</b><p>Education, universities, a skilled workforce, and innovation incentives all increase research output.</p></div><button data-action="navigate" data-page="infrastructure">IMPROVE EDUCATION →</button></div>`;
}

function renderWorldPage() {
  const news = world.news.slice(0, 9);
  const rankingCards = world.rankings.map((ranking) => `<div class="ranking-card"><h4>${ranking.label}</h4>${ranking.cities.slice(0, 4).map((entry) => `<div class="ranking-entry ${entry.isPlayer ? "player-rank" : ""}"><span class="rank">${String(entry.rank).padStart(2, "0")}</span><b>${safe(entry.name)}</b><span class="rank-val">${ranking.id === "population" ? formatCompact(entry.value) : Math.round(entry.value)}</span></div>`).join("")}</div>`).join("");
  return `${pageHeading("A LIVING WORLD", "World & news", "Your city is a small part of a world that is changing every day.", `<span class="tag teal-tag">${world.continents.length} CONTINENTS · ${world.countries.length} COUNTRIES</span>`)}
    <div class="world-top-grid"><section class="panel">${panelHead("◎", `${world.worldName} · regional atlas`, `<span class="panel-subtitle">SEED ${safe(world.seed)}</span>`)}<div class="world-map-frame"><canvas id="world-map-canvas" aria-label="Procedural pixel world map"></canvas><div class="map-overlay">ATLAS VIEW · SETTLEMENTS ${world.settlements.length}</div><div class="map-coordinates">${world.continents.length} CONTINENTS · ${world.countries.length} NATIONS</div></div></section>
      <section class="panel">${panelHead("▣", "World dispatch", `<span class="panel-subtitle">LIVE FROM ${world.news.length} HEADLINES</span>`)}<div class="panel-body"><div class="world-news-list">${news.map((item) => `<article class="world-news-row"><div class="news-meta"><span>${safe(item.cityName || "WORLD DESK")}</span><time>${safe(item.date || "TODAY")}</time></div><h4>${safe(item.title)}</h4><p>${safe(item.description)}</p></article>`).join("") || `<div class="empty-state"><div class="empty-icon">▣</div><b>The wire is quiet</b><p>World dispatches arrive as the simulation unfolds.</p></div>`}</div></div></section></div>
    <div class="panel">${panelHead("◈", "The world's cities", `<span class="panel-subtitle">LIVE RANKINGS · ${world.settlements.length} SETTLEMENTS</span>`)}<div class="panel-body"><div class="ranking-grid">${rankingCards}</div></div></div>`;
}

function renderHistory() {
  const city = playerCity();
  const entries = [...world.history].slice(0, 36);
  const unlocked = ACHIEVEMENTS.filter((achievement) => world.achievements.includes(achievement.id));
  const timeline = entries.map((entry) => `<div class="timeline-item ${entry.type === "event" ? "event" : entry.type === "warning" ? "warning" : ""}"><div class="timeline-meta"><span>${entry.icon || "◈"} · ${(entry.type || "RECORD").toUpperCase()}</span><time>${safe(entry.date || `YEAR ${entry.year}`)}</time></div><h4>${safe(entry.title)}</h4><p>${safe(entry.description)}</p></div>`).join("");
  return `${pageHeading("THE WORLD REMEMBERS", "History & legacy", "Every project, breakthrough, and hard-won recovery becomes part of the city's story.", `<button class="soft-btn" data-action="export">⇩ Export save file</button>`)}
    <div class="economy-stats">${metricCard("Years governed", `${world.year - 2026}`, "A new administration", "▤", 1)}${metricCard("Milestones recorded", formatNumber(world.history.length), "In the city archive", "▣", world.history.length)}${metricCard("Awards & titles", `${city.awards.length}`, "City reputation", "🏆", city.awards.length)}${metricCard("Achievements", `${world.achievements.length} / ${ACHIEVEMENTS.length}`, "A life in public service", "✦", world.achievements.length)}</div>
    <div class="history-layout"><section class="panel">${panelHead("▣", "The city archive", `<select class="time-filter" id="history-filter"><option value="all">ALL RECORDS</option><option value="milestone">MILESTONES</option><option value="event">EVENTS</option><option value="technology">DISCOVERIES</option></select>`)}<div class="panel-body"><div class="timeline" id="timeline-list">${timeline || `<div class="empty-state"><div class="empty-icon">▣</div><b>History is just beginning</b><p>Your first decisions will be the opening chapter.</p></div>`}</div></div></section>
      <div class="dashboard-right">${panel("🏆", "A city worth remembering", unlocked.length ? unlocked.map((a) => `<div class="award-card"><div class="award-icon">✦</div><div><b>${safe(a.name)}</b><small>${safe(a.desc)}</small></div></div>`).join("") : `<div class="empty-state"><div class="empty-icon">✦</div><b>Your story is just beginning</b><p>Achievements recognize growth, care, innovation, and a city that stands the test of time.</p></div>`, `<span class="panel-subtitle">${unlocked.length} EARNED</span>`)}${panel("◈", "The story so far", `<div class="pulse-row"><span>Founded as</span><span class="pulse-value">${city.type}</span></div><div class="pulse-row"><span>World seed</span><span class="pulse-value">${safe(world.seed)}</span></div><div class="pulse-row"><span>Most valuable company</span><span class="pulse-value">${safe([...world.companies].sort((a,b)=>b.marketValue-a.marketValue)[0]?.name || "—")}</span></div><div class="pulse-row"><span>City identity</span><span class="pulse-value">${city.awards[city.awards.length - 1] || "A story in progress"}</span></div><div class="small-note" style="line-height:1.6;margin-top:10px">When you retire, this world will still be here. Every save preserves its own history.</div>`)}</div></div>`;
}

function renderSettings() {
  const guest = storage.guestProfile;
  return `${pageHeading("YOUR OFFICE", "Settings & save files", "Your world is saved on this device. Export a backup to take it anywhere.", `<button class="primary-btn" data-action="save">▣ Save now</button>`)}
    <div class="settings-grid"><div class="dashboard-left">${panel("▣", "Local save & backup", `<div class="setting-row"><div><b>Autosave</b><small>Save this world every five real-time minutes.</small></div><button class="policy-toggle ${world.autosaveEnabled ? "on" : ""}" data-action="toggle-autosave"></button></div><div class="setting-row"><div><b>Storage location</b><small>IndexedDB with localStorage fallback</small></div><span class="tag teal-tag">THIS DEVICE</span></div><div class="setting-row"><div><b>Guest profile</b><small>${safe(guest.guestId)} · ${guest.worldsCreated || 1} world${(guest.worldsCreated || 1) === 1 ? "" : "s"} created</small></div><span class="tag">LOCAL</span></div><div class="settings-buttons" style="margin-top:14px"><button class="soft-btn" data-action="open-saves">Browse local saves</button><button class="soft-btn" data-action="export">Export current world ↓</button><button class="soft-btn" data-action="import">Import save ↑</button><input id="import-file-game" type="file" accept=".json,.crown.json,application/json" hidden /></div>`)}${panel("⚙", "World configuration", `<div class="setting-row"><div><b>World name</b><small>${safe(world.worldName)}</small></div><span class="tag">${world.size.toUpperCase()}</span></div><div class="setting-row"><div><b>Difficulty</b><small>${DIFFICULTIES[world.difficulty]?.desc || "Standard simulation."}</small></div><span class="tag ${world.difficulty === "Relaxed" ? "teal-tag" : world.difficulty === "Realistic" ? "red-tag" : ""}">${safe(world.difficulty.toUpperCase())}</span></div><div class="setting-row"><div><b>Sandbox</b><small>Economy and policy rules can still be explored.</small></div><span class="tag ${world.sandbox ? "teal-tag" : ""}">${world.sandbox ? "ENABLED" : "DISABLED"}</span></div><div class="setting-row"><div><b>Deterministic seed</b><small>${safe(world.seed)}</small></div><button class="table-action" data-action="copy-seed">COPY</button></div>`)}</div><div class="dashboard-right">${panel("♫", "Audio & experience", `<div class="setting-row"><div><b>Pixel sound effects</b><small>Soft, synthesized interface sounds.</small></div><button class="policy-toggle ${audio.sfxEnabled ? "on" : ""}" data-action="toggle-sfx"></button></div><div class="setting-row"><div><b>Ambient music</b><small>Procedural seasonal tones.</small></div><button class="policy-toggle ${audio.musicEnabled ? "on" : ""}" data-action="toggle-music"></button></div><div class="setting-row"><div><b>Simulation speed</b><small>Choose a pace in the top-right clock.</small></div><span class="tag">${world.speed}×</span></div><div class="setting-row"><div><b>Reduced motion</b><small>Less movement in interface transitions.</small></div><button class="policy-toggle ${world.settings.reducedMotion ? "on" : ""}" data-action="toggle-motion"></button></div>`)}${panel("⌂", "The mayor's record", `<div class="pulse-row"><span>Current year</span><span class="pulse-value">${world.year}</span></div><div class="pulse-row"><span>Population</span><span class="pulse-value">${formatNumber(playerCity().population)}</span></div><div class="pulse-row"><span>World settlements</span><span class="pulse-value">${world.settlements.length}</span></div><div class="pulse-row"><span>Companies simulated</span><span class="pulse-value">${world.companies.length}</span></div><button class="danger-btn" style="width:100%;margin-top:14px" data-action="main-menu">Return to title screen</button>`)}</div></div>`;
}

function drawCharts() {
  const canvas = $("#overview-chart");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const width = rect.width, height = rect.height;
  ctx.clearRect(0, 0, width, height);
  const history = world.monthlyHistory.slice(-12);
  const city = playerCity();
  const values = history.length >= 2 ? history : Array.from({ length: 12 }, (_, i) => ({ population: city.population * (0.9 + i * 0.009 + Math.sin(i * 0.7) * 0.005), approval: city.approval - 7 + i * .58 + Math.sin(i * .83) * 2.1 }));
  const pop = values.map((v) => Number(v.population) || city.population);
  const approval = values.map((v) => Number(v.approval) || city.approval);
  const pad = { l: 42, r: 13, t: 10, b: 20 };
  const plotW = width - pad.l - pad.r, plotH = height - pad.t - pad.b;
  const minP = Math.min(...pop) * .993, maxP = Math.max(...pop) * 1.007;
  const minA = Math.max(0, Math.min(...approval) - 8), maxA = Math.min(100, Math.max(...approval) + 8);
  ctx.font = "8px DM Mono, monospace";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = pad.t + plotH * i / 3;
    ctx.strokeStyle = "#25343e"; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    const label = formatCompact(maxP - (maxP - minP) * i / 3, 0);
    ctx.fillStyle = "#728491"; ctx.fillText(label, 0, y + 3);
  }
  function line(series, min, max, color, fill = false) {
    const points = series.map((v, i) => ({ x: pad.l + plotW * i / Math.max(1, series.length - 1), y: pad.t + plotH - ((v - min) / Math.max(1, max - min)) * plotH }));
    if (fill && points.length) { ctx.beginPath(); ctx.moveTo(points[0].x, pad.t + plotH); points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(points[points.length - 1].x, pad.t + plotH); ctx.closePath(); ctx.fillStyle = `${color}14`; ctx.fill(); }
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    const p = points[points.length - 1]; if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  }
  line(pop, minP, maxP, "#48d6b0", true);
  // Draw public approval on a normalized secondary scale.
  line(approval, minA, maxA, "#e8be65", false);
  ctx.fillStyle = "#71828e";
  ["12 MO AGO", "9 MO", "6 MO", "3 MO", "NOW"].forEach((label, i) => { const x = pad.l + plotW * i / 4; ctx.fillText(label, x - 17, height - 4); });
  const spark = $$("canvas.sparkline");
  spark.forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const d = window.devicePixelRatio || 1; el.width = r.width * d; el.height = r.height * d;
    const c = el.getContext("2d"); c.scale(d, d); c.clearRect(0, 0, r.width, r.height); c.strokeStyle = el.dataset.color || "#48d6b0"; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 12; i++) { const x = r.width * i / 11, y = r.height * (.28 + .48 * (1 - Math.sin(i * .56 + .3) * .38 - i * .025)); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  });
}

function paintCompanyLogos() {
  // Logos are pre-rasterized to compact, crisp pixel canvases and loaded as data URLs.
}

function initKaboomMap() {
  const canvas = $("#world-map-canvas");
  if (!canvas || !world) return;
  if (kaboomCanvas === canvas && kaboomGame) return;
  // The map is a Kaboom scene embedded in the management terminal, not a rendered city.
  try {
    if (kaboomGame?.quit) kaboomGame.quit();
    kaboomCanvas = canvas;
    const k = kaboom({ canvas, width: 960, height: 360, background: [13, 25, 33], global: false, crisp: true, stretch: true, letterbox: false });
    kaboomGame = k;
    const rng = new CrownPRNG(`${world.seed}|atlas`);
    const W = 960, H = 360, cell = 8, cols = W / cell, rows = H / cell;
    const landColors = [[34, 93, 79], [39, 103, 83], [44, 113, 86], [49, 100, 80]];
    // Pixelated procedural landmasses from layered, warped ellipse fields.
    const landmasses = [
      { x: .18, y: .35, rx: .15, ry: .19, warp: .04 },
      { x: .26, y: .65, rx: .10, ry: .17, warp: .035 },
      { x: .49, y: .33, rx: .13, ry: .22, warp: .025 },
      { x: .61, y: .67, rx: .10, ry: .15, warp: .04 },
      { x: .77, y: .37, rx: .15, ry: .20, warp: .035 },
      { x: .88, y: .69, rx: .065, ry: .10, warp: .02 }
    ].slice(0, Math.max(3, world.continents.length));
    for (const land of landmasses) {
      land.x += rng.range(-.03, .03); land.y += rng.range(-.06, .05);
      land.rx *= rng.range(.83, 1.1); land.ry *= rng.range(.8, 1.1);
    }
    const landCells = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const nx = gx / cols, ny = gy / rows;
        const jitter = (rng.next() - .5) * .085;
        const landmass = landmasses.find((m) => {
          const dx = (nx - m.x) / m.rx, dy = (ny - m.y) / m.ry;
          const coastNoise = Math.sin(gx * .51 + gy * .17) * m.warp + Math.cos(gy * .37 - gx * .14) * m.warp;
          return dx * dx + dy * dy < 1.0 + jitter + coastNoise;
        });
        if (!landmass) continue;
        const isMountain = rng.chance(.09) || (gy > rows * .3 && gy < rows * .65 && rng.chance(.045));
        const isForest = !isMountain && rng.chance(.16);
        const palette = isMountain ? [[102, 109, 95], [125, 126, 106]] : isForest ? [[29, 80, 68], [34, 88, 68]] : landColors[rng.int(0, landColors.length - 1)];
        k.add([k.rect(cell - .6, cell - .6), k.pos(gx * cell, gy * cell), k.color(...palette), k.fixed()]);
        landCells.push({ x: gx * cell + cell / 2, y: gy * cell + cell / 2, mountain: isMountain });
      }
    }
    // Pixel coast glimmer and subtle latitude guides.
    for (let i = 0; i < 7; i++) {
      const y = 32 + i * 48;
      k.add([k.rect(W, 1), k.pos(0, y), k.color(37, 80, 88, 0.21), k.fixed()]);
    }
    // Procedural trade routes between well-connected ports.
    const routeNodes = world.settlements.filter((c) => ["Ocean", "River"].includes(c.geography)).slice(0, 12);
    const coords = routeNodes.map((city, i) => {
      const p = landCells[Math.floor((i + 1) * landCells.length / (routeNodes.length + 1))] || { x: 100 + i * 65, y: 110 + i * 17 };
      return { city, x: p.x, y: p.y };
    });
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i], b = coords[i + 1];
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * -18;
        if (s % 2 === 0) k.add([k.rect(3, 3), k.pos(x, y), k.color(224, 188, 94, .62), k.fixed()]);
      }
    }
    // Settlement lights; the player town is highlighted in gold.
    const visibleCities = world.settlements.slice(0, Math.min(38, world.settlements.length));
    visibleCities.forEach((city, i) => {
      const p = landCells[Math.floor((i + 2) * landCells.length / (visibleCities.length + 2))] || { x: 80 + (i * 51) % 800, y: 70 + (i * 37) % 220 };
      const isPlayer = city.id === world.playerCityId;
      const size = isPlayer ? 8 : i % 7 === 0 ? 5 : 3;
      const color = isPlayer ? [243, 202, 110] : city.type.includes("Port") ? [92, 197, 179] : [120, 177, 157];
      k.add([k.rect(size, size), k.pos(p.x - size / 2, p.y - size / 2), k.color(...color), k.fixed()]);
      if (isPlayer) {
        k.add([k.rect(19, 1), k.pos(p.x - 9, p.y + 9), k.color(235, 196, 107), k.fixed()]);
        k.add([k.text(city.name.toUpperCase(), { size: 10, font: "monospace" }), k.pos(p.x + 13, p.y - 5), k.color(239, 223, 177), k.fixed()]);
      } else if (i % 11 === 1) {
        k.add([k.text(city.name.toUpperCase(), { size: 7, font: "monospace" }), k.pos(p.x + 6, p.y + 1), k.color(119, 156, 150), k.fixed()]);
      }
    });
    // Small ocean markers and map labels.
    const captions = [[45, 298, "SAPPHIRE SEA"], [365, 42, "NORTHERN REACH"], [690, 302, "EASTERN OCEAN"]];
    captions.forEach(([x, y, text]) => k.add([k.text(text, { size: 8, font: "monospace" }), k.pos(x, y), k.color(64, 106, 116), k.fixed()]));
  } catch (error) {
    console.warn("Kaboom map unavailable", error);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#10212a"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#48d6b0"; ctx.font = "14px monospace"; ctx.fillText("WORLD ATLAS · " + world.continents.length + " CONTINENTS", 30, 50);
  }
}

function bindGameUI() {
  if (listenersBound) return;
  listenersBound = true;
  $("#main-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (button) navigate(button.dataset.page);
  });
  $("#sidebar-collapse").addEventListener("click", () => gameScreen.classList.toggle("sidebar-collapsed"));
  $("#speed-select").addEventListener("change", (event) => { world.speed = Number(event.target.value); world.paused = false; updateHud(); playTone("click"); });
  $("#pause-btn").addEventListener("click", () => { world.paused = !world.paused; updateHud(); playTone(world.paused ? "click" : "tab"); showToast(world.paused ? "Simulation paused" : "The world is moving again", world.paused ? "Take your time with the numbers." : "The calendar continues from here.", "info", world.paused ? "Ⅱ" : "▶"); });
  $("#save-now-btn").addEventListener("click", saveCurrentWorld);
  $("#notifications-btn").addEventListener("click", openNotifications);
  $("#page-content").addEventListener("click", handlePageClick);
  $("#page-content").addEventListener("input", handlePageInput);
  $("#page-content").addEventListener("change", handlePageChange);
  $("#modal-root").addEventListener("click", handleModalClick);
  $("#modal-root").addEventListener("change", handleModalChange);
  $("#modal-root").addEventListener("input", handleModalInput);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", () => { if (currentPage === "overview") drawCharts(); });
  window.addEventListener("beforeunload", () => { if (world && !gameScreen.hidden) storage.saveWorld(world, { isAutosave: true, existingId: "autosave_primary" }); });
}

function onKeyDown(event) {
  if (event.key === "Escape") { closeModal(); return; }
  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); if (world) { world.paused = !world.paused; updateHud(); } }
  if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); saveCurrentWorld(); }
  if (event.ctrlKey && event.key.toLowerCase() === "f") { event.preventDefault(); if (currentPage === "companies") $("#company-search")?.focus(); else navigate("companies"); }
  if (/^[1-4]$/.test(event.key)) { const mapping = { "1": "overview", "2": "economy", "3": "infrastructure", "4": "companies" }; navigate(mapping[event.key]); }
}

function handlePageInput(event) {
  const el = event.target;
  if (el.matches("[data-tax]")) {
    CrownWorld.setTax(world, el.dataset.tax, el.value);
    const out = $(`#tax-value-${el.dataset.tax}`); if (out) out.textContent = `${el.value}%`;
  }
  if (el.matches("[data-budget]")) {
    CrownWorld.changeDepartmentBudget(world, el.dataset.budget, el.value);
    const out = $(`#budget-value-${el.dataset.budget}`); if (out) out.textContent = `${el.value}%`;
  }
  if (el.matches("[data-bid-range]")) {
    const contract = world.contracts.find((c) => c.id === el.dataset.bidRange); if (contract) contract.offer = Number(el.value);
    const out = $(`#bid-value-${el.dataset.bidRange}`); if (out) out.textContent = `${el.value}%`;
  }
  if (el.id === "company-search" || el.id === "company-filter" || el.id === "company-sort") filterCompanies();
}
function handlePageChange(event) {
  if (event.target.id === "import-file-game") handleImport(event.target.files[0]);
  if (event.target.id === "company-filter" || event.target.id === "company-sort") filterCompanies();
  if (event.target.id === "history-filter") {
    const filter = event.target.value;
    const entries = filter === "all" ? world.history : world.history.filter((item) => item.type === filter);
    const root = $("#timeline-list");
    if (root) root.innerHTML = entries.slice(0, 36).map((entry) => `<div class="timeline-item ${entry.type === "event" ? "event" : ""}"><div class="timeline-meta"><span>${entry.icon || "◈"} · ${(entry.type || "record").toUpperCase()}</span><time>${safe(entry.date || `YEAR ${entry.year}`)}</time></div><h4>${safe(entry.title)}</h4><p>${safe(entry.description)}</p></div>`).join("") || `<div class="small-note">No entries in this category yet.</div>`;
  }
}
function filterCompanies() {
  const search = ($("#company-search")?.value || "").trim().toLowerCase();
  const filter = $("#company-filter")?.value || "All industries";
  const sortBy = $("#company-sort")?.value || "value";
  const rows = $$('[data-company-row]');
  rows.forEach((row) => { row.hidden = !(row.dataset.name.includes(search) && (filter === "All industries" || row.dataset.industry === filter)); });
  const body = $("#company-table-body"); if (!body) return;
  const visible = rows.filter((row) => !row.hidden);
  const sorted = visible.sort((a, b) => {
    if (sortBy === "name") return a.dataset.name.localeCompare(b.dataset.name);
    return Number(b.dataset[sortBy] || 0) - Number(a.dataset[sortBy] || 0);
  });
  sorted.forEach((row) => body.appendChild(row));
}

function handlePageClick(event) {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const type = action.dataset.action;
  const id = action.dataset.id;
  if (type === "navigate") return navigate(action.dataset.page);
  if (type === "upgrade") {
    const result = CrownWorld.queueInfrastructure(world, id, 1);
    if (!result.ok) showToast("Upgrade not available", result.reason, "warning", "▤");
    else { playTone("upgrade"); showToast("Project funded", `${result.name} · ${formatCrown(result.cost)} · ${result.days} days`, "positive", "▤"); renderPage(); updateHud(); }
  }
  if (type === "monument") {
    const monument = MONUMENTS.find((m) => m.id === id); const result = CrownWorld.queueMonument(world, monument);
    if (!result.ok) showToast("Project not funded", result.reason, "warning", "🏛");
    else { playTone("construct"); showToast("Landmark project approved", `${result.name} · expected in ${result.days} days`, "positive", "🏛"); renderPage(); updateHud(); }
  }
  if (type === "toggle-policy") {
    const result = CrownWorld.togglePolicy(world, id);
    if (result.ok) { const city = playerCity(); playTone("click"); showToast(result.active ? "Policy enacted" : "Policy suspended", `${result.policy.name} · ${result.active ? "effective at next budget review" : "removed from city policy"}`, result.active ? "positive" : "warning", "⚖"); renderPage(); }
  }
  if (type === "bid") {
    const contract = world.contracts.find((c) => c.id === id);
    const result = CrownWorld.acceptContract(world, id, contract?.offer || 0);
    if (result.ok) { playTone("award"); playerCity().grantsWon += 1; showToast("The contract is yours", `${result.contract.title} · delivery begins now.`, "positive", "📋"); }
    else { playTone("alert"); showToast("The bid went elsewhere", result.reason, "warning", "📋"); }
    renderPage(); updateHud();
  }
  if (type === "inspect-company") openCompanyProfile(id);
  if (type === "set-tech") {
    const ok = CrownWorld.setActiveTechnology(world, id);
    if (ok) { playTone("research"); showToast("Research selected", `${CrownWorld.getActiveTechnology(world)?.name || id} is now in development.`, "info", "✳"); renderPage(); }
    else showToast("Research is locked", "Complete earlier breakthroughs to open this era.", "warning", "✳");
  }
  if (type === "take-loan") openLoanModal();
  if (type === "toggle-autosave") { world.autosaveEnabled = !world.autosaveEnabled; renderPage(); showToast(`Autosave ${world.autosaveEnabled ? "enabled" : "paused"}`, "Your preference is saved with this world.", "info", "▣"); }
  if (type === "toggle-sfx") { audio.sfxEnabled = !audio.sfxEnabled; world.settings.sound = audio.sfxEnabled; renderPage(); if (audio.sfxEnabled) playTone("click"); }
  if (type === "toggle-music") { const state = audio.toggleMusic(); world.settings.music = state; renderPage(); if (state) showToast("Ambient music on", "A gentle seasonal tone will accompany your session.", "info", "♫"); }
  if (type === "toggle-motion") { world.settings.reducedMotion = !world.settings.reducedMotion; renderPage(); }
  if (type === "save") saveCurrentWorld();
  if (type === "open-saves") openSavesModal();
  if (type === "export") storage.exportSaveFile(world);
  if (type === "import") $("#import-file-game")?.click();
  if (type === "copy-seed") navigator.clipboard?.writeText(world.seed).then(() => showToast("Seed copied", world.seed, "info", "◈")).catch(() => showToast("World seed", world.seed, "info", "◈"));
  if (type === "main-menu") openMainMenuConfirm();
}

function handleModalClick(event) {
  if (event.target.classList.contains("modal-backdrop")) closeModal();
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const type = action.dataset.action;
  if (type === "close-modal") closeModal();
  if (type === "modal-load") loadSaveById(action.dataset.id);
  if (type === "modal-delete") deleteSaveById(action.dataset.id);
  if (type === "modal-export") storage.exportSaveFile(world);
  if (type === "modal-company-offer") openCompanyOfferModal(idFromAction(action));
  if (type === "modal-company-offer-confirm") offerCompany(idFromAction(action), Number($("#company-incentive")?.value || 20));
  if (type === "modal-company-close") closeModal();
  if (type === "modal-loan-confirm") {
    const amount = Number($("#loan-amount")?.value || 150000);
    const result = CrownWorld.takeLoan(world, amount);
    if (result.ok) { playTone("cash"); closeModal(); showToast("Development loan approved", `${formatCrown(result.principal)} · ${(result.interestRate * 100).toFixed(1)}% interest · ${formatCrown(result.monthlyPayment)} monthly`, "positive", "◈"); renderPage(); updateHud(); }
    else { $("#loan-error").textContent = result.reason; $("#loan-error").hidden = false; }
  }
  if (type === "modal-mark-read") { world.notifications.forEach((n) => n.unread = false); openNotifications(); updateHud(); }
  if (type === "modal-main-menu") { storage.saveWorld(world, { isAutosave: true, existingId: "autosave_primary" }).finally(() => { closeModal(); gameScreen.hidden = true; startScreen.hidden = false; renderStartSaves(); }); }
}
function idFromAction(action) { return action.dataset.id; }
function handleModalChange(event) {
  if (event.target.id === "import-file-game" || event.target.id === "import-file-modal") handleImport(event.target.files[0]);
  if (event.target.id === "load-import-start") handleImport(event.target.files[0]);
}
function handleModalInput(event) {
  if (event.target.id === "loan-amount") { const out = $("#loan-value"); if (out) out.textContent = formatCrown(Number(event.target.value)); }
  if (event.target.id === "company-incentive") {
    const out = $("#company-incentive-value"); if (out) out.textContent = `${event.target.value}%`;
    const company = selectedCompany($("[data-action=modal-company-offer-confirm]")?.dataset.id);
    const cost = company ? Math.round(48000 + company.employees * .85 + Number(event.target.value) * 1500) : 0;
    const costOut = $("#offer-cost-value"); if (costOut) costOut.textContent = formatCrown(cost);
  }
}

function modalTemplate(title, content, actions = "", options = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${options.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${safe(title)}"><div class="modal-head"><h2>${title}</h2><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></div><div class="modal-body">${content}</div>${actions ? `<div class="modal-footer">${actions}</div>` : ""}</section></div>`;
}
function closeModal() { modalRoot.innerHTML = ""; }
function openSavesModal() {
  storage.listSaves().then((saves) => {
    const rows = saves.map((save) => `<div class="save-row"><div class="save-icon">${save.isAutosave ? "◷" : "◈"}</div><div class="save-copy"><b>${safe(save.saveName || `${save.cityName} · ${save.worldName}`)}</b><small>${safe(save.cityName || "Settlement")} · ${safe(save.worldName)} · Year ${save.year || 2026} · ${safe(save.difficulty || "Standard")}</small><small>${save.savedAt ? new Date(save.savedAt).toLocaleString() : "Local save"} ${save.isAutosave ? "· AUTOSAVE" : ""}</small></div><span class="save-treasury">${formatCrown(save.treasury || 0)}</span><button class="table-action" data-action="modal-load" data-id="${safe(save.id)}">LOAD</button><button class="danger-btn" data-action="modal-delete" data-id="${safe(save.id)}">×</button></div>`).join("");
    modalTemplate("Local save files", rows || `<div class="empty-state"><div class="empty-icon">▣</div><b>No saves yet</b><p>Create a world and save your progress. Exports can move between devices.</p></div>`, `<button class="soft-btn" data-action="modal-export">Export current world</button><button class="primary-btn" data-action="close-modal">Done</button>`, { wide: true });
  });
}
async function loadSaveById(id) {
  const state = await storage.loadSave(id);
  if (!state) return showToast("Save could not be loaded", "This save may have been deleted or moved.", "negative", "▣");
  world = state; closeModal(); renderPage(); updateHud(); showToast("World loaded", `${playerCity().name} · ${world.worldName}`, "positive", "↗");
}
async function deleteSaveById(id) {
  await storage.deleteSave(id); openSavesModal(); showToast("Local save removed", "This file is no longer in your save list.", "warning", "▣");
}
function openNotifications() {
  const notifications = world.notifications.slice(0, 30);
  const rows = notifications.map((n) => `<div class="notification-row ${n.unread ? "unread" : ""}"><span class="notification-symbol">${n.icon || "◈"}</span><div><b>${safe(n.title)}</b><p>${safe(n.message)}</p><small>${safe(n.date || getDateLabel())}</small></div></div>`).join("");
  modalTemplate("Your notifications", rows || `<div class="empty-state"><div class="empty-icon">♢</div><b>All caught up</b><p>City alerts, bids, milestones, and world news appear here.</p></div>`, `<button class="soft-btn" data-action="modal-mark-read">Mark all read</button><button class="primary-btn" data-action="close-modal">Close</button>`, { wide: true });
  world.notifications.forEach((n) => n.unread = false); updateHud();
}
function openLoanModal() {
  const city = playerCity();
  if (city.loan) return showToast("A loan is already active", `Outstanding balance: ${formatCrown(city.loan.remaining)}.`, "warning", "◈");
  const apr = 0.065 + Math.max(0, 12 - city.infrastructureRating) * .0015 + Math.max(0, 60 - city.approval) * .0008;
  const markup = `<p style="font-size:10px;color:#95a4ab;line-height:1.65;margin-top:0">A civic development loan can help fund early upgrades. Payments are drawn from your treasury at each monthly budget review.</p><div class="loan-summary"><div><span>INTEREST RATE</span><b>${(apr * 100).toFixed(1)}% APR</b></div><div><span>TERM</span><b>48 MONTHS</b></div><div><span>CREDIT PROFILE</span><b>${city.approval > 75 ? "A" : city.approval > 55 ? "BBB" : "BB"}</b></div></div><label class="field-label" for="loan-amount">BORROW AMOUNT <output id="loan-value">${formatCrown(150000)}</output></label><input id="loan-amount" type="range" min="50000" max="1000000" step="25000" value="150000" style="width:100%;accent-color:#48d6b0" /><p class="small-note">Monthly payment is calculated across a four-year term including interest.</p><div id="loan-error" class="negative" style="font-size:9px;margin-top:8px" hidden></div>`;
  modalTemplate("Apply for a civic loan", markup, `<button class="soft-btn" data-action="close-modal">Not now</button><button class="primary-btn" data-action="modal-loan-confirm">Accept terms & receive funds</button>`);
}

function openCompanyProfile(id) {
  const company = selectedCompany(id); if (!company) return;
  const city = playerCity();
  const inCity = company.headquartersCityId === city.id;
  const localScore = clamp(Math.round((city.businessConfidence * .18 + city.infrastructureRating * .15 + city.education * .16 + (100 - city.crime) * .14 + (100 - city.pollution) * .12 + city.happiness * .12 + (100 - city.taxes.corporate * 2) * .13) + (company.requiresWater && ["Ocean", "River"].includes(city.geography) ? 12 : 0)), 0, 100);
  const history = [...(company.history || [])].slice(-5).reverse().map((event) => `<div class="history-entry"><time>${event.year}</time><span>${safe(event.text)}</span></div>`).join("");
  const footer = inCity ? `<button class="soft-btn" data-action="modal-company-close">Close profile</button><button class="primary-btn" data-action="modal-company-offer" data-id="${company.id}">Discuss expansion →</button>` : `<button class="soft-btn" data-action="modal-company-close">Close profile</button><button class="primary-btn" data-action="modal-company-offer" data-id="${company.id}">Invite to ${safe(city.name)} →</button>`;
  modalTemplate(`${safe(company.name)} · corporate profile`, `<div class="company-profile-layout"><div class="panel"><div class="profile-top">${cityLogo(company, 50)}<div><h2>${safe(company.name)}</h2><p>${safe(company.slogan)}</p><span class="tag">${safe(company.industry)}</span></div></div><div class="panel-body"><div class="pulse-row"><span>Founder</span><span class="pulse-value">${safe(company.founderName)}</span></div><div class="pulse-row"><span>Chief executive</span><span class="pulse-value">${safe(company.ceoName)}</span></div><div class="pulse-row"><span>Headquarters</span><span class="pulse-value">${safe(company.headquartersCityName)}</span></div><div class="pulse-row"><span>Employees</span><span class="pulse-value">${formatNumber(company.employees)}</span></div><div class="pulse-row"><span>Market value</span><span class="pulse-value">${formatCrown(company.marketValue)}</span></div><div class="pulse-row"><span>Annual revenue</span><span class="pulse-value">${formatCrown(company.revenue)}</span></div><div class="pulse-row"><span>Net profit</span><span class="pulse-value ${company.profit >= 0 ? "positive" : "negative"}">${formatCrown(company.profit)}</span></div><div class="pulse-row"><span>Share price</span><span class="pulse-value">${company.isPublic ? `◈ ${company.sharePrice.toFixed(2)}` : "PRIVATE"}</span></div><div class="pulse-row"><span>Corporate reputation</span><span class="pulse-value">${"★".repeat(Math.min(5, company.reputation))}${"☆".repeat(Math.max(0, 5 - company.reputation))}</span></div><div class="section-label" style="margin-top:15px">SIGNATURE PRODUCTS</div><div class="product-list">${(company.products || []).map((item) => `<span class="profile-product">${safe(item)}</span>`).join("")}</div></div></div><div class="dashboard-right"><section class="panel"><div class="panel-body"><div class="eyebrow">CITY COMPETITIVENESS</div><div class="metric-value">${localScore}<span style="font-size:11px;color:#81929a"> / 100</span></div><div class="progress-track" style="margin-top:9px"><div class="progress-fill ${localScore < 45 ? "gold-fill" : ""}" style="width:${localScore}%"></div></div><p style="font-size:9px;line-height:1.6;color:#8797a0">${inCity ? "This company already calls your city home. Keep taxes fair and services reliable to lower relocation risk." : `Your local offer competes with ${Math.max(4, Math.round(world.countries.length * .8))} other settlements. Strengthen the services this company values.`}</p><div class="pulse-row"><span>Relocation risk</span><span class="pulse-value ${company.relocationRisk > 60 ? "negative" : ""}">${Math.round(company.relocationRisk)}%</span></div><div class="pulse-row"><span>Company growth</span><span class="pulse-value ${company.growth >= 0 ? "positive" : "negative"}">${company.growth >= 0 ? "+" : ""}${company.growth.toFixed(1)}%</span></div><div class="pulse-row"><span>Expansion plan</span><span class="pulse-value">${safe(company.expansion)}</span></div></div></section><section class="panel"><div class="panel-head"><div class="panel-title"><span class="title-icon">▣</span>Corporate history</div></div><div class="panel-body">${history || "<div class='small-note'>History will grow as the world evolves.</div>"}</div></section></div></div>`, footer, { wide: true });
}
function openCompanyOfferModal(id) {
  const company = selectedCompany(id); if (!company) return;
  const city = playerCity();
  const inCity = company.headquartersCityId === city.id;
  const baseCost = inCity ? Math.max(25000, Math.round(25000 + company.employees * .6)) : Math.round(48000 + company.employees * .85);
  const score = clamp(Math.round((city.businessConfidence * .18 + city.infrastructureRating * .15 + city.education * .16 + (100 - city.crime) * .14 + (100 - city.pollution) * .12 + city.happiness * .12 + (100 - city.taxes.corporate * 2) * .13) + (company.requiresWater && ["Ocean", "River"].includes(city.geography) ? 12 : 0)), 0, 100);
  const markup = `<div class="company-offer-intro">${cityLogo(company, 40)}<div><b>${inCity ? "Support a local expansion" : `Invite ${safe(company.name)} to your city`}</b><p>${inCity ? "A targeted expansion grant can improve capacity and reduce relocation risk." : "Make a measured civic offer. The company weighs your city against competing locations."}</p></div></div><div class="pulse-row"><span>City competitiveness</span><span class="pulse-value">${score} / 100</span></div><div class="pulse-row"><span>Support package</span><span class="pulse-value" id="offer-cost-value">${formatCrown(baseCost + 20 * 1500)}</span></div>${inCity ? "" : `<label class="field-label" for="company-incentive">TAX & RELOCATION INCENTIVE <output id="company-incentive-value">20%</output></label><input id="company-incentive" type="range" min="0" max="50" step="5" value="20" style="width:100%;accent-color:#48d6b0" /><div class="small-note" style="line-height:1.6;margin-top:10px">A larger incentive improves the bid but increases the upfront relocation package. No funds are spent if the company declines.</div>`}<div id="offer-error" class="negative" style="font-size:9px;margin-top:8px" hidden></div>`;
  modalTemplate(inCity ? "Expansion partnership" : "Corporate invitation", markup, `<button class="soft-btn" data-action="close-modal">Cancel</button><button class="primary-btn" data-action="modal-company-offer-confirm" data-id="${company.id}">${inCity ? "Fund expansion" : "Submit city offer"} →</button>`);
}

function offerCompany(id, support = 20) {
  const company = selectedCompany(id); if (!company) return;
  const city = playerCity();
  if (company.headquartersCityId === city.id) {
    const spend = Math.max(0, Math.round(25000 + company.employees * .6));
    if (!world.sandbox && city.treasury < spend) { closeModal(); return showToast("Treasury too low", `An expansion grant would cost ${formatCrown(spend)}.`, "warning", "◈"); }
    if (!world.sandbox) city.treasury -= spend;
    company.employees = Math.round(company.employees * 1.07);
    company.marketValue *= 1.04;
    company.relocationRisk = Math.max(0, company.relocationRisk - 14);
    city.jobs += Math.round(company.employees * .07);
    city.approval = clamp(city.approval + 1.5, 0, 100);
    closeModal(); playTone("cash"); showToast("Expansion agreement signed", `${company.name} will expand in ${city.name} · ${formatCrown(spend)} city support.`, "positive", "▦"); renderPage(); updateHud();
    return;
  }
  const incentive = clamp(Number(support) || 0, 0, 50);
  const cost = Math.round(48000 + company.employees * .85 + incentive * 1500);
  if (!world.sandbox && city.treasury < cost) { closeModal(); return showToast("Treasury too low", `The relocation package requires ${formatCrown(cost)}.`, "warning", "◈"); }
  const score = clamp(Math.round((city.businessConfidence * .18 + city.infrastructureRating * .15 + city.education * .16 + (100 - city.crime) * .14 + (100 - city.pollution) * .12 + city.happiness * .12 + (100 - city.taxes.corporate * 2) * .13) + (company.requiresWater && ["Ocean", "River"].includes(city.geography) ? 12 : 0)), 0, 100);
  const rng = new CrownPRNG(`${world.seed}|company-offer|${company.id}|${world.year}|${world.dayOfYear}|${Math.round(score)}|${incentive}`);
  const chance = clamp(Math.round(score * .72 + 14 + incentive * .18), 8, 94);
  closeModal();
  if (rng.int(1, 100) <= chance) {
    if (!world.sandbox) city.treasury -= cost;
    const oldCity = company.headquartersCityName;
    company.headquartersCityId = city.id;
    company.headquartersCityName = city.name;
    company.relocationRisk = 12;
    company.history.unshift({ year: world.year, text: `${company.name} moved its headquarters from ${oldCity} to ${city.name}.` });
    city.businesses += 1;
    city.jobs += Math.round(company.employees * .24);
    city.approval = clamp(city.approval + 3, 0, 100);
    city.innovation = clamp(city.innovation + (company.personality === "Innovative" ? 5 : 2), 0, 100);
    city.awards.push(company.cityTitle);
    const news = { id: `company-news-${Date.now()}`, year: world.year, date: getDateLabel(), type: "positive", icon: "🏢", title: `${company.name} chooses ${city.name}`, description: `The company has accepted the city's offer to host its headquarters. ${formatNumber(company.employees)} global employees and a new chapter in city history.`, cityName: city.name, timestamp: Date.now() };
    world.news.unshift(news); world.history.unshift({ ...news, type: "corporate" });
    playTone("award"); showToast("A new headquarters arrives", `${company.name} · chance ${chance}% · ${formatNumber(company.employees)} employees.`, "positive", "🏢");
  } else {
    company.relocationRisk = Math.min(100, company.relocationRisk + 3);
    showToast("The company chose another city", `${company.name} passed on the package. The bid had an estimated ${chance}% chance.`, "warning", "▦");
  }
  renderPage(); updateHud();
}

function openMainMenuConfirm() {
  modalTemplate("Return to the title screen?", `<p style="color:#9baab1;font-size:10px;line-height:1.6">Your current world is saved locally first. You can continue it later or start a new seeded world.</p>`, `<button class="soft-btn" data-action="close-modal">Stay in office</button><button class="primary-btn" data-action="modal-main-menu">Save & return</button>`);
}
async function saveCurrentWorld() {
  if (!world) return;
  try {
    const meta = await storage.saveWorld(world, { customName: `${playerCity().name} · ${world.worldName}` });
    lastAutosaveAt = performance.now();
    playTone("cash"); showToast("World saved locally", `${meta.saveName} · ${getDateLabel()}`, "positive", "▣");
  } catch (err) { console.error(err); showToast("Save failed", "Try exporting a save file instead.", "negative", "⚠"); }
}
async function handleImport(file) {
  if (!file) return;
  try {
    const imported = await storage.importSaveFile(file);
    world = imported;
    if (startScreen.hidden) { closeModal(); renderPage(); updateHud(); }
    else await launchGame();
    showToast("Save imported", `${playerCity().name} · ${world.worldName}`, "positive", "↗");
  } catch (err) { showToast("Import failed", err.message || "This file doesn't appear to be a Project Crown save.", "negative", "⚠"); }
}
function showToast(title, message, type = "info", icon = "◈", duration = 4200) {
  if (!toastRoot) return;
  const node = document.createElement("div");
  node.className = `toast ${type === "warning" ? "warning" : type === "negative" ? "negative" : ""}`;
  node.innerHTML = `<b>${icon} &nbsp;${safe(title)}</b><p>${safe(message)}</p><div class="toast-meta">${world ? getDateLabel() : "PROJECT CROWN"}</div>`;
  toastRoot.appendChild(node);
  setTimeout(() => { node.style.opacity = "0"; node.style.transform = "translateX(10px)"; node.style.transition = ".2s"; setTimeout(() => node.remove(), 220); }, duration);
}
function playTone(name) { if (world?.settings?.sound === false) return; audio.play(name); }

// Start screen controls and guest save-file import.
$("#random-seed").addEventListener("click", () => { randomSeedToField(); playTone("click"); });
$("#create-world-btn").addEventListener("click", startNewWorld);
$("#continue-world-btn").addEventListener("click", continueLatestWorld);
$("#sound-start").addEventListener("click", () => { audio.sfxEnabled = !audio.sfxEnabled; if (audio.sfxEnabled) audio.play("click"); $("#sound-start").textContent = audio.sfxEnabled ? "♫" : "♪"; });
$("#open-saves-btn").addEventListener("click", () => {
  const temp = document.createElement("div"); temp.id = "start-modal-root"; temp.className = "start-modal-root"; document.body.appendChild(temp);
  storage.listSaves().then((saves) => {
    temp.innerHTML = `<div class="modal-backdrop"><section class="modal wide" role="dialog"><div class="modal-head"><h2>Your local worlds</h2><button class="modal-close" id="close-start-modal">×</button></div><div class="modal-body">${saves.map((s) => `<div class="save-row"><div class="save-icon">◈</div><div class="save-copy"><b>${safe(s.saveName || s.cityName)}</b><small>${safe(s.worldName)} · Year ${s.year} · ${safe(s.difficulty)}</small></div><button class="primary-btn" data-load-start="${safe(s.id)}">LOAD</button></div>`).join("") || `<div class="empty-state"><div class="empty-icon">▣</div><b>No save files yet</b><p>Your worlds will be stored here on this device.</p></div>`}</div></section></div>`;
    $("#close-start-modal", temp).addEventListener("click", () => temp.remove());
    temp.addEventListener("click", async (e) => { const btn = e.target.closest("[data-load-start]"); if (btn) { const state = await storage.loadSave(btn.dataset.loadStart); if (state) { world = state; temp.remove(); await launchGame(); } } if (e.target.classList.contains("modal-backdrop")) temp.remove(); });
  });
});
$("#import-start-btn").addEventListener("click", () => $("#import-file-start").click());
$("#import-file-start").addEventListener("change", (e) => handleImport(e.target.files[0]));
renderStartSaves();

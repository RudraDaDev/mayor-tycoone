// Project Crown: a small regional buy/sell game. Vanilla JS UI + Kaboom pixel map.
import kaboom from "./vendor/kaboom.mjs";

const SAVE_KEY = "project-crown-trader-save-v1";
const WAREHOUSE_CAPACITY = [30, 50, 80, 120, 170, 230];
const WAREHOUSE_COST = [2500, 6500, 14000, 28000, 50000];
const MARKETS = [
  { id: "azure", name: "Port Azure", kind: "COASTAL PORT", icon: "⚓", note: "Busy harbor · fish and imports", factors: { food: 1.07, fish: .78, timber: 1.02, stone: 1.11, coal: 1.05, iron: 1.10, copper: 1.12, fuel: .95, tools: 1.08 } },
  { id: "ironridge", name: "Ironridge", kind: "MINING TOWN", icon: "◆", note: "Mountain works · ore and fuel", factors: { food: 1.22, fish: 1.32, timber: 1.09, stone: .91, coal: .78, iron: .80, copper: .84, fuel: .88, tools: .96 } },
  { id: "greenvale", name: "Greenvale", kind: "FARMING VALLEY", icon: "♧", note: "Fertile farms · food and timber", factors: { food: .76, fish: 1.03, timber: .79, stone: 1.12, coal: 1.16, iron: 1.18, copper: 1.06, fuel: 1.09, tools: 1.13 } },
  { id: "crowncity", name: "Crown City", kind: "CAPITAL MARKET", icon: "♜", note: "Big buyers · tools and industry", factors: { food: 1.10, fish: 1.13, timber: 1.17, stone: 1.08, coal: 1.08, iron: 1.13, copper: .91, fuel: 1.16, tools: .76 } }
];
const GOODS = [
  { id: "food", name: "Grain", category: "FOOD", icon: "🌾", base: 42 },
  { id: "fish", name: "Fish", category: "FOOD", icon: "🐟", base: 56 },
  { id: "timber", name: "Timber", category: "MATERIALS", icon: "▰", base: 68 },
  { id: "stone", name: "Stone", category: "MATERIALS", icon: "⬡", base: 52 },
  { id: "coal", name: "Coal", category: "FUEL", icon: "◼", base: 94 },
  { id: "iron", name: "Iron ore", category: "ORE", icon: "◆", base: 145 },
  { id: "copper", name: "Copper", category: "ORE", icon: "⬢", base: 208 },
  { id: "fuel", name: "Fuel", category: "FUEL", icon: "▧", base: 192 },
  { id: "tools", name: "Tools", category: "GOODS", icon: "⚒", base: 278 }
];
const $ = (q, root = document) => root.querySelector(q);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtMoney = (value) => {
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  if (n >= 1e6) return `${sign}◈ ${(n / 1e6).toFixed(2)}M`;
  if (n >= 10000) return `${sign}◈ ${(n / 1000).toFixed(1)}K`;
  return `${sign}◈ ${Math.round(n).toLocaleString()}`;
};
const fmtShort = (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : Math.round(value).toString();

function freshState() {
  return {
    cash: 12500,
    profit: 0,
    warehouseLevel: 1,
    selectedMarket: "azure",
    cycle: 1,
    globalPrices: Object.fromEntries(GOODS.map((good) => [good.id, 1])),
    trend: Object.fromEntries(GOODS.map((good) => [good.id, 0])),
    cargo: Object.fromEntries(GOODS.map((good) => [good.id, { quantity: 0, averageCost: 0 }])),
    ledger: [],
    tradesMade: 0
  };
}

function readSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!parsed || !parsed.cargo || !parsed.globalPrices) return freshState();
    const base = freshState();
    return { ...base, ...parsed, cargo: { ...base.cargo, ...parsed.cargo }, globalPrices: { ...base.globalPrices, ...parsed.globalPrices }, trend: { ...base.trend, ...parsed.trend } };
  } catch { return freshState(); }
}
let state = readSave();
let cycleSeconds = 12;
let mapEngine = null;
let oldPrices = { ...state.globalPrices };

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (err) { console.warn("Could not save local trading game", err); }
}
function getMarket(id = state.selectedMarket) { return MARKETS.find((market) => market.id === id) || MARKETS[0]; }
function getPrice(good, market = getMarket()) {
  const marketFactor = market.factors[good.id] || 1;
  const movement = state.globalPrices[good.id] || 1;
  const mid = good.base * marketFactor * movement;
  return { buy: Math.max(1, Math.round(mid * 1.035)), sell: Math.max(1, Math.round(mid * .965)), mid };
}
function capacity() { return WAREHOUSE_CAPACITY[clamp(state.warehouseLevel - 1, 0, WAREHOUSE_CAPACITY.length - 1)]; }
function cargoCount() { return Object.values(state.cargo).reduce((sum, item) => sum + (item.quantity || 0), 0); }
function marketIndex(market) {
  const average = GOODS.reduce((sum, good) => sum + market.factors[good.id], 0) / GOODS.length;
  return Math.round(average * 100);
}
function topOpportunity(good) {
  let best = null;
  for (const buyer of MARKETS) for (const seller of MARKETS) {
    if (buyer.id === seller.id) continue;
    const buyPrice = getPrice(good, buyer).buy;
    const sellPrice = getPrice(good, seller).sell;
    const margin = sellPrice - buyPrice;
    if (!best || margin > best.margin) best = { buyAt: buyer, sellAt: seller, margin };
  }
  return best;
}

function renderMarkets() {
  const root = $("#market-strip");
  root.innerHTML = MARKETS.map((market) => {
    const active = market.id === state.selectedMarket;
    return `<button class="market-card ${active ? "active" : ""}" data-action="market" data-id="${market.id}" aria-pressed="${active}"><span class="market-marker">${market.icon}</span><span class="market-copy"><b>${market.name}</b><small>${market.kind}</small></span><span class="market-index">${marketIndex(market)}<small>PRICE IDX</small></span></button>`;
  }).join("");
  const market = getMarket();
  $("#exchange-title").textContent = `${market.name.toUpperCase()} EXCHANGE`;
  $("#exchange-subtitle").textContent = `${market.note} · live regional board`;
}

function renderGoods() {
  const market = getMarket();
  $("#goods-body").innerHTML = GOODS.map((good) => {
    const price = getPrice(good, market);
    const held = state.cargo[good.id]?.quantity || 0;
    const direction = state.trend[good.id] || 0;
    const trend = direction > 0 ? `<span class="price-trend up">▲</span>` : direction < 0 ? `<span class="price-trend down">▼</span>` : `<span class="price-trend">—</span>`;
    return `<tr>
      <td><div class="good-name"><span class="good-icon">${good.icon}</span><span><b>${good.name}</b><small>${good.category}</small></span></div></td>
      <td><span class="price-cell buy">${fmtMoney(price.buy)}</span>${trend}</td>
      <td><span class="price-cell sell">${fmtMoney(price.sell)}</span></td>
      <td><span class="holding-count ${held ? "" : "none"}">${held}</span></td>
      <td><input class="qty-input" type="number" inputmode="numeric" min="1" max="${capacity()}" value="1" aria-label="${good.name} quantity" data-qty="${good.id}" /></td>
      <td><div class="trade-actions"><button class="buy-button" data-action="buy" data-id="${good.id}" title="Buy ${good.name} at this market">BUY</button><button class="sell-button" data-action="sell" data-id="${good.id}" ${held ? "" : "disabled"} title="Sell ${good.name} at this market">SELL</button></div></td>
    </tr>`;
  }).join("");
}

function renderCargo() {
  const total = cargoCount();
  const cap = capacity();
  $("#hold-counter").textContent = `${total} / ${cap}`;
  $("#stat-cargo").innerHTML = `${total} <small>/ ${cap}</small>`;
  $("#capacity-fill").style.width = `${Math.min(100, (total / cap) * 100)}%`;
  $("#capacity-fill").style.background = total >= cap ? "#e98177" : "#4bd1ae";
  const rows = GOODS.filter((good) => state.cargo[good.id]?.quantity > 0).map((good) => {
    const item = state.cargo[good.id];
    return `<div class="hold-row"><span class="hold-good"><i>${good.icon}</i>${good.name}</span><span class="hold-qty">× ${item.quantity}</span><button class="sell-one" data-action="sell-all" data-id="${good.id}">SELL ALL</button></div>`;
  }).join("");
  $("#hold-list").innerHTML = rows;
  $("#hold-empty").hidden = total > 0;
}

function renderWarehouse() {
  const level = state.warehouseLevel;
  const cap = capacity();
  const nextCap = WAREHOUSE_CAPACITY[level] || null;
  const cost = WAREHOUSE_COST[level - 1];
  $("#infra-badge").textContent = `LV ${level}`;
  $("#infra-capacity").textContent = `${cap} cargo units`;
  $("#infra-next").textContent = nextCap ? `${nextCap} cargo units` : "MAX LEVEL";
  $("#next-upgrade-note").textContent = nextCap ? `Capacity upgrade available` : "Largest warehouse";
  const button = $("#upgrade-button");
  const maxed = !nextCap;
  button.disabled = maxed || state.cash < cost;
  $("#upgrade-button span").textContent = maxed ? "Warehouse fully upgraded" : `Upgrade to level ${level + 1}`;
  $("#upgrade-cost").textContent = maxed ? "MAX" : fmtMoney(cost);
  $("#upgrade-hint").textContent = maxed ? "Your cargo hold is as large as it gets." : state.cash < cost ? "Trade a little longer to afford the upgrade." : `Adds ${nextCap - cap} cargo spaces.`;
  $("#stat-level").textContent = `LEVEL ${level}`;
}

function renderOpportunities() {
  const best = GOODS.map((good) => ({ good, ...topOpportunity(good) })).filter((item) => item.margin > 0).sort((a, b) => b.margin - a.margin).slice(0, 3);
  $("#opportunity-list").innerHTML = best.map(({ good, buyAt, sellAt, margin }) => `<div class="opportunity-row"><span class="opp-icon">${good.icon}</span><span class="opp-copy"><b>${good.name}</b><small>${buyAt.name} → ${sellAt.name}</small></span><span class="opp-margin">+${fmtMoney(margin)} / unit</span></div>`).join("") || `<div class="ledger-empty">No strong price gaps right now.</div>`;
}

function renderLedger() {
  const ledger = state.ledger.slice(0, 6);
  $("#trade-count").textContent = state.tradesMade ? `${state.tradesMade} TRADE${state.tradesMade === 1 ? "" : "S"} MADE` : "NO TRADES YET";
  $("#ledger-list").innerHTML = ledger.length ? ledger.map((trade) => `<div class="ledger-row"><span class="ledger-symbol ${trade.side === "sell" ? "sell" : ""}">${trade.side === "buy" ? "↓" : "↑"}</span><span class="ledger-desc"><b>${trade.side === "buy" ? "Bought" : "Sold"} ${trade.quantity} ${safe(trade.good)}</b><small>${safe(trade.market)}</small></span><span class="ledger-market">${safe(trade.priceEach)} / unit</span><span class="ledger-time">CYCLE ${String(trade.cycle).padStart(3, "0")}</span><span class="ledger-amount ${trade.side === "buy" ? "negative" : "positive"}">${trade.side === "buy" ? "−" : "+"}${fmtMoney(trade.total).replace("◈ ", "◈ ")}</span></div>`).join("") : `<div class="ledger-empty">Your trades will show up here.</div>`;
}

function render() {
  const current = getMarket();
  $("#top-cash").textContent = fmtMoney(state.cash);
  $("#stat-cash").textContent = fmtMoney(state.cash);
  $("#stat-profit").textContent = fmtMoney(state.profit);
  $("#stat-profit").style.color = state.profit < 0 ? "var(--red)" : "";
  $("#cycle-number").textContent = String(state.cycle).padStart(3, "0");
  renderMarkets();
  renderGoods();
  renderCargo();
  renderWarehouse();
  renderOpportunities();
  renderLedger();
}

function addLedger(side, good, quantity, price, total) {
  state.ledger.unshift({ side, good: good.name, market: getMarket().name, quantity, priceEach: fmtMoney(price), total, cycle: state.cycle });
  state.ledger = state.ledger.slice(0, 30);
  state.tradesMade += 1;
}
function getQuantity(id) {
  const input = $(`[data-qty="${id}"]`);
  const parsed = Math.floor(Number(input?.value || 1));
  return clamp(Number.isFinite(parsed) ? parsed : 1, 1, capacity());
}

function buyGood(id, requested = null) {
  const good = GOODS.find((item) => item.id === id);
  if (!good) return;
  const quantity = requested ?? getQuantity(id);
  const amount = Math.max(1, Math.floor(quantity));
  const free = capacity() - cargoCount();
  if (free <= 0) return toast("Cargo hold is full", "Upgrade your warehouse or sell some goods first.", true);
  const qty = Math.min(amount, free);
  const price = getPrice(good).buy;
  const total = price * qty;
  if (total > state.cash) return toast("Not enough crowns", `You need ${fmtMoney(total)} to buy ${qty} ${good.name}.`, true);
  const item = state.cargo[id];
  item.averageCost = ((item.averageCost * item.quantity) + total) / (item.quantity + qty);
  item.quantity += qty;
  state.cash -= total;
  addLedger("buy", good, qty, price, total);
  save(); render();
  toast(`Bought ${qty} ${good.name}`, `${getMarket().name} · ${fmtMoney(total)} total`);
}

function sellGood(id, requested = null) {
  const good = GOODS.find((item) => item.id === id);
  const item = state.cargo[id];
  if (!good || !item?.quantity) return toast("Nothing to sell", `You don't have any ${good?.name || "goods"} in the hold.`, true);
  const quantity = requested ?? getQuantity(id);
  const qty = Math.min(item.quantity, Math.max(1, Math.floor(quantity)));
  const price = getPrice(good).sell;
  const total = price * qty;
  state.cash += total;
  state.profit += (price - item.averageCost) * qty;
  item.quantity -= qty;
  if (item.quantity === 0) item.averageCost = 0;
  addLedger("sell", good, qty, price, total);
  save(); render();
  toast(`Sold ${qty} ${good.name}`, `${getMarket().name} · ${fmtMoney(total)} received`);
}

function upgradeWarehouse() {
  const level = state.warehouseLevel;
  const nextCapacity = WAREHOUSE_CAPACITY[level];
  const cost = WAREHOUSE_COST[level - 1];
  if (!nextCapacity) return toast("Already at maximum", "Your warehouse is fully upgraded.", true);
  if (state.cash < cost) return toast("Not enough crowns", `The upgrade costs ${fmtMoney(cost)}.`, true);
  state.cash -= cost;
  state.warehouseLevel += 1;
  save(); render();
  toast(`Warehouse upgraded to level ${state.warehouseLevel}`, `Cargo capacity is now ${capacity()} units.`);
}

function changeMarket(id) {
  if (!MARKETS.some((market) => market.id === id) || id === state.selectedMarket) return;
  state.selectedMarket = id;
  save(); render();
}

function tickMarket() {
  state.cycle += 1;
  for (const good of GOODS) {
    const previous = state.globalPrices[good.id] || 1;
    const swing = (Math.random() - .48) * .095;
    const next = clamp(previous * (1 + swing), .62, 1.72);
    state.globalPrices[good.id] = Number(next.toFixed(3));
    state.trend[good.id] = next > previous + .001 ? 1 : next < previous - .001 ? -1 : 0;
  }
  cycleSeconds = 12;
  save(); render();
}

function toast(title, message, bad = false) {
  const root = $("#toast-root");
  const item = document.createElement("div");
  item.className = `toast ${bad ? "bad" : ""}`;
  item.innerHTML = `<b>${bad ? "⚠" : "◈"} &nbsp;${safe(title)}</b><p>${safe(message)}</p><small>CYCLE ${String(state.cycle).padStart(3, "0")}</small>`;
  root.appendChild(item);
  setTimeout(() => { item.style.opacity = "0"; item.style.transform = "translateX(8px)"; item.style.transition = ".2s"; setTimeout(() => item.remove(), 220); }, 3200);
}

function showResetModal() {
  const root = document.createElement("div");
  root.className = "modal-backdrop";
  root.innerHTML = `<section class="modal" role="dialog" aria-modal="true"><h2>Start over?</h2><p>This clears your cash, cargo, warehouse, and trade history from this device.</p><div class="modal-actions"><button class="modal-cancel" data-action="cancel-reset">Keep trading</button><button class="modal-confirm" data-action="confirm-reset">Reset save</button></div></section>`;
  document.body.appendChild(root);
  root.addEventListener("click", (event) => {
    if (event.target === root || event.target.closest("[data-action=cancel-reset]")) root.remove();
    if (event.target.closest("[data-action=confirm-reset]")) { state = freshState(); save(); render(); root.remove(); toast("Fresh start", "Your new trading business is ready."); }
  });
}

function initPixelMap() {
  const canvas = $("#trade-map");
  if (!canvas) return;
  try {
    const k = kaboom({ canvas, width: 320, height: 100, background: [14, 28, 31], global: false, crisp: true, stretch: false, letterbox: false });
    mapEngine = k;
    // Tiny map-like scene: dotted sea, islands, and four exchange lights.
    const r = (x, y, w, h, color) => k.add([k.rect(w, h), k.pos(x, y), k.color(...color), k.fixed()]);
    for (let x = 5; x < 320; x += 14) for (let y = 5; y < 100; y += 13) if ((x + y) % 3 === 0) r(x, y, 1, 1, [30, 60, 61]);
    const islands = [[28, 22, 60, 37], [130, 41, 54, 31], [229, 19, 63, 43], [232, 74, 33, 14]];
    islands.forEach(([x, y, w, h], index) => {
      for (let ix = x; ix < x + w; ix += 6) for (let iy = y; iy < y + h; iy += 6) {
        const edge = Math.abs(ix - (x + w / 2)) / (w / 2) + Math.abs(iy - (y + h / 2)) / (h / 2);
        if (edge < 1.45 && Math.random() > .12) r(ix, iy, 5, 5, index === 1 ? [103, 108, 76] : [49, 104, 78]);
      }
    });
    const towns = [[56, 40], [154, 55], [250, 40], [245, 79]];
    towns.forEach(([x, y], i) => {
      r(x - 2, y - 2, 6, 6, i === 0 ? [232, 189, 98] : [90, 201, 166]);
      for (let j = 0; j < 13; j++) {
        const t = j / 13;
        r(x + (towns[(i + 1) % towns.length][0] - x) * t, y + (towns[(i + 1) % towns.length][1] - y) * t, 1, 1, [183, 157, 92]);
      }
    });
  } catch (error) {
    console.warn("Pixel atlas could not initialize", error);
  }
}

$("#market-strip").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action=market]");
  if (button) changeMarket(button.dataset.id);
});
$("#goods-body").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "buy") buyGood(button.dataset.id);
  if (button.dataset.action === "sell") sellGood(button.dataset.id);
});
$("#hold-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action=sell-all]");
  if (button) sellGood(button.dataset.id, state.cargo[button.dataset.id]?.quantity || 0);
});
$("#upgrade-button").addEventListener("click", upgradeWarehouse);
$("#reset-button").addEventListener("click", showResetModal);
$("#goods-body").addEventListener("change", (event) => {
  if (event.target.matches("[data-qty]")) event.target.value = clamp(Math.floor(Number(event.target.value) || 1), 1, capacity());
});

render();
initPixelMap();
setInterval(() => {
  cycleSeconds -= 1;
  $("#cycle-clock").textContent = `NEXT UPDATE IN ${cycleSeconds}s`;
  if (cycleSeconds <= 0) tickMarket();
}, 1000);

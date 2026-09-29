// ============================================================================
// ◈ PROJECT CROWN — Seeded PRNG & Formatting Utilities (js/prng.js)
// ============================================================================

export class CrownPRNG {
  constructor(seedStr = "AURELIA-2026") {
    this.seedStr = String(seedStr || "AURELIA-2026").trim().toUpperCase();
    this.state = this._hashString(this.seedStr);
  }

  _hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  // Mulberry32 deterministic float [0, 1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max] inclusive
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Float in [min, max)
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Boolean with probability p
  chance(p = 0.5) {
    return this.next() < p;
  }

  // Pick one item from array
  pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Pick N unique items from array
  sample(arr, n) {
    const copy = [...arr];
    const out = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(this.next() * copy.length);
      out.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return out;
  }

  // Shuffle array in place
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Official ◈ Currency Formatter
export function formatCrown(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "◈ 0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}◈ ${(abs / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `${sign}◈ ${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}◈ ${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}◈ ${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}◈ ${Math.round(abs).toLocaleString()}`;
}

export function formatSignedCrown(value, decimals = 1) {
  if (value > 0) return `+${formatCrown(value, decimals)}`;
  return formatCrown(value, decimals);
}

export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return Math.round(value).toLocaleString();
}

export function formatCompact(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}${Math.round(abs)}`;
}

export function formatPct(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${Number(value).toFixed(decimals)}%`;
}

export const MONTHS = [
  { name: "January", short: "Jan", days: 31, season: "Winter" },
  { name: "February", short: "Feb", days: 28, season: "Winter" },
  { name: "March", short: "Mar", days: 31, season: "Spring" },
  { name: "April", short: "Apr", days: 30, season: "Spring" },
  { name: "May", short: "May", days: 31, season: "Spring" },
  { name: "June", short: "Jun", days: 30, season: "Summer" },
  { name: "July", short: "Jul", days: 31, season: "Summer" },
  { name: "August", short: "Aug", days: 31, season: "Summer" },
  { name: "September", short: "Sep", days: 30, season: "Autumn" },
  { name: "October", short: "Oct", days: 31, season: "Autumn" },
  { name: "November", short: "Nov", days: 30, season: "Autumn" },
  { name: "December", short: "Dec", days: 31, season: "Winter" }
];

export function dayOfYearToDate(dayOfYear, year) {
  let d = ((dayOfYear - 1) % 365) + 1;
  for (let m = 0; m < MONTHS.length; m++) {
    if (d <= MONTHS[m].days) {
      return {
        day: d,
        monthIndex: m,
        monthName: MONTHS[m].name,
        monthShort: MONTHS[m].short,
        season: MONTHS[m].season,
        year,
        formatted: `${MONTHS[m].short} ${d}, ${year}`,
        fullFormatted: `${MONTHS[m].name} ${d}, ${year}`
      };
    }
    d -= MONTHS[m].days;
  }
  return {
    day: 31,
    monthIndex: 11,
    monthName: "December",
    monthShort: "Dec",
    season: "Winter",
    year,
    formatted: `Dec 31, ${year}`,
    fullFormatted: `December 31, ${year}`
  };
}

export function generateRandomSeed() {
  const words = [
    "AURELIA", "CROWN", "AZURE", "SOLARIS", "VALEN", "REYES",
    "MERIDIAN", "TITAN", "VERIDIAN", "HYPERION", "VANGUARD", "ECLIPSE"
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

// ============================================================================
// ◈ PROJECT CROWN — Guest Storage Engine: IndexedDB + localStorage + Export
// ============================================================================

const DB_NAME = "ProjectCrownDB";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const LS_INDEX_KEY = "project_crown_saves_index_v1";
const LS_GUEST_KEY = "project_crown_guest_profile_v1";
const LS_LAST_SAVE_KEY = "project_crown_last_active_save_v1";

class CrownStorageManager {
  constructor() {
    this.dbPromise = this._initIndexedDB();
    this.guestProfile = this._loadOrCreateGuestProfile();
  }

  _loadOrCreateGuestProfile() {
    try {
      const raw = localStorage.getItem(LS_GUEST_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
    const profile = {
      guestId: "GUEST-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      displayName: "Mayor (Guest)",
      createdAt: new Date().toISOString(),
      worldsCreated: 0,
      autosaveMinutes: 5
    };
    this._saveGuestProfile(profile);
    return profile;
  }

  _saveGuestProfile(profile) {
    this.guestProfile = profile;
    try {
      localStorage.setItem(LS_GUEST_KEY, JSON.stringify(profile));
    } catch (e) {
      // ignore quota error
    }
  }

  updateGuestSettings(partial) {
    this._saveGuestProfile({ ...this.guestProfile, ...partial });
    return this.guestProfile;
  }

  _initIndexedDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  _getIndex() {
    try {
      const raw = localStorage.getItem(LS_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  _setIndex(list) {
    try {
      localStorage.setItem(LS_INDEX_KEY, JSON.stringify(list));
    } catch (e) {
      // ignore
    }
  }

  async saveWorld(worldState, options = {}) {
    const {
      customName = null,
      isAutosave = false,
      isBackup = false,
      existingId = null
    } = options;

    const playerCity = worldState.settlements.find((s) => s.id === worldState.playerCityId) || worldState.settlements[0];
    const now = new Date();
    const saveId = existingId || (isAutosave ? `autosave_${Date.now()}` : `save_${Date.now()}`);

    const labelPrefix = isAutosave ? "[AUTOSAVE] " : isBackup ? "[BACKUP] " : "";
    const saveName = customName || `${labelPrefix}${playerCity.name} (${worldState.worldName})`;

    const meta = {
      id: saveId,
      saveName,
      worldName: worldState.worldName,
      seed: worldState.seed,
      cityName: playerCity.name,
      population: playerCity.population,
      treasury: playerCity.treasury,
      year: worldState.year,
      dayOfYear: worldState.dayOfYear,
      difficulty: worldState.difficulty,
      sandbox: !!worldState.sandbox,
      playTimeSeconds: worldState.playTimeSeconds || 0,
      isAutosave,
      isBackup,
      savedAt: now.toISOString(),
      version: "1.0.0"
    };

    const payload = {
      ...meta,
      state: JSON.parse(JSON.stringify(worldState))
    };

    // Save to IndexedDB
    const db = await this.dbPromise;
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readwrite");
          tx.objectStore(STORE_NAME).put(payload);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    // Also store latest active save in localStorage for instant guest reload
    try {
      localStorage.setItem(LS_LAST_SAVE_KEY, JSON.stringify(payload));
      localStorage.setItem(`crown_save_${saveId}`, JSON.stringify(payload));
    } catch (e) {
      // If localStorage hits quota, IndexedDB still holds the full save
    }

    // Update metadata index
    let index = this._getIndex().filter((item) => item.id !== saveId);
    index.unshift(meta);

    // Limit rolling autosaves to 5 (Part 11: "Autosaves overwrite the oldest autosave after the limit is reached")
    const autosaves = index.filter((item) => item.isAutosave);
    if (autosaves.length > 5) {
      const toRemove = autosaves.slice(5);
      for (const oldAuto of toRemove) {
        await this.deleteSave(oldAuto.id);
      }
      index = this._getIndex();
    } else {
      this._setIndex(index);
    }

    return meta;
  }

  async listSaves() {
    const index = this._getIndex();
    const db = await this.dbPromise;
    if (!db) return index;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          const rows = req.result || [];
          if (rows.length === 0) {
            resolve(index);
            return;
          }
          const metas = rows
            .map((r) => {
              const { state, ...meta } = r;
              return meta;
            })
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
          this._setIndex(metas);
          resolve(metas);
        };
        req.onerror = () => resolve(index);
      } catch (e) {
        resolve(index);
      }
    });
  }

  async loadSave(saveId) {
    const db = await this.dbPromise;
    if (db) {
      const record = await new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readonly");
          const req = tx.objectStore(STORE_NAME).get(saveId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
      if (record && record.state) return record.state;
    }

    try {
      const raw = localStorage.getItem(`crown_save_${saveId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.state || parsed;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async loadMostRecentSave() {
    const saves = await this.listSaves();
    if (saves.length > 0) {
      const st = await this.loadSave(saves[0].id);
      if (st) return st;
    }
    try {
      const raw = localStorage.getItem(LS_LAST_SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.state || parsed;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async deleteSave(saveId) {
    const db = await this.dbPromise;
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], "readwrite");
          tx.objectStore(STORE_NAME).delete(saveId);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }
    try {
      localStorage.removeItem(`crown_save_${saveId}`);
    } catch (e) {
      // ignore
    }
    const nextIndex = this._getIndex().filter((item) => item.id !== saveId);
    this._setIndex(nextIndex);
  }

  exportSaveFile(worldState) {
    const playerCity = worldState.settlements.find((s) => s.id === worldState.playerCityId) || worldState.settlements[0];
    const exportPacket = {
      game: "Project Crown",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      guestId: this.guestProfile.guestId,
      worldName: worldState.worldName,
      cityName: playerCity.name,
      seed: worldState.seed,
      year: worldState.year,
      state: worldState
    };

    const blob = new Blob([JSON.stringify(exportPacket, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeCity = playerCity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `project-crown-${safeCity}-y${worldState.year}.crown.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async importSaveFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const state = parsed.state || parsed;
    if (!state || !state.settlements || !state.playerCityId) {
      throw new Error("Invalid Project Crown save file format.");
    }
    await this.saveWorld(state, { customName: `[IMPORTED] ${parsed.cityName || "Settlement"} (${state.worldName})` });
    return state;
  }
}

export const storage = new CrownStorageManager();

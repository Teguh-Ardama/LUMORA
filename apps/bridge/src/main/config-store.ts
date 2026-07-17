import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BridgeConfig } from "../shared/ipc-contract";

const DEFAULTS: BridgeConfig = {
  apiUrl: null,
  deviceToken: null,
  deviceId: null,
  eventId: null,
  eventName: null,
  watchFolder: null,
  outputFolder: null,
};

/** Simple atomic JSON store in the user-data directory. */
class ConfigStore {
  private filePath = path.join(app.getPath("userData"), "bridge-config.json");
  private cache: BridgeConfig;

  constructor() {
    this.cache = this.load();
  }

  private load(): BridgeConfig {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<BridgeConfig>) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get(): BridgeConfig {
    return { ...this.cache };
  }

  set(patch: Partial<BridgeConfig>): BridgeConfig {
    this.cache = { ...this.cache, ...patch };
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.cache, null, 2));
    writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
    try {
      // best-effort tmp cleanup
      require("node:fs").unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    return this.get();
  }

  clear(): void {
    this.set({ ...DEFAULTS });
  }
}

let store: ConfigStore | null = null;
export function getConfigStore(): ConfigStore {
  store ??= new ConfigStore();
  return store;
}

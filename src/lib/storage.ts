import { decodeState, encodeState, type AppState } from "./url";

/** localStorage: the last thing calculated and which saved quote it came from. */
const STATE_KEY = "calc3d:v1";
const ACTIVE_KEY = "calc3d:active";
const PRINTER_KEY = "calc3d:printer";
const SECTIONS_KEY = "calc3d:sections";
const WORKSHOP_KEY = "calc3d:workshop";

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: nothing to persist.
  }
}

export function readState(): Partial<AppState> {
  const raw = get(STATE_KEY);
  return raw ? decodeState(new URLSearchParams(raw)) : {};
}

export function writeState(state: AppState) {
  set(STATE_KEY, encodeState(state));
}

export function clearState() {
  set(STATE_KEY, null);
}

export function readActiveId(): string | null {
  return get(ACTIVE_KEY);
}

export function writeActiveId(id: string | null) {
  set(ACTIVE_KEY, id);
}

export function readPrinterId(): string | null {
  return get(PRINTER_KEY);
}

export function writePrinterId(id: string | null) {
  set(PRINTER_KEY, id);
}

export function readWorkshopId(): string | null {
  return get(WORKSHOP_KEY);
}

export function writeWorkshopId(id: string | null) {
  set(WORKSHOP_KEY, id);
}

export type SectionId = "printer" | "labor" | "sale" | "ml";
export type SectionState = Record<SectionId, boolean>;

export const DEFAULT_SECTIONS: SectionState = { printer: false, labor: false, sale: true, ml: false };

export function readSections(): SectionState {
  const raw = get(SECTIONS_KEY);
  if (!raw) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const out = { ...DEFAULT_SECTIONS };
    for (const k of Object.keys(DEFAULT_SECTIONS) as SectionId[]) {
      if (typeof parsed[k] === "boolean") out[k] = parsed[k] as boolean;
    }
    return out;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

export function writeSections(state: SectionState) {
  set(SECTIONS_KEY, JSON.stringify(state));
}

import { decodeState, encodeState, type AppState } from "./url";

/** localStorage: the last thing calculated and which saved quote it came from. */
const STATE_KEY = "calc3d:v1";
const ACTIVE_KEY = "calc3d:active";

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

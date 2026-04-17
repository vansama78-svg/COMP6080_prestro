import { fetchJson } from "./client";
import { EMPTY_STORE, type PrestoStore } from "../types/presentation";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getStoreApi(token: string): Promise<PrestoStore> {
  const data = await fetchJson<{ store?: unknown }>("/store", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!isObject(data.store)) {
    return EMPTY_STORE;
  }

  const presentations = Array.isArray(data.store.presentations)
    ? data.store.presentations
    : [];

  return { presentations } as PrestoStore;
}

export async function putStoreApi(token: string, store: PrestoStore): Promise<void> {
  await fetchJson<Record<string, never>>("/store", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ store }),
  });
}

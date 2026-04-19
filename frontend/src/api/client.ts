import { API_BASE_URL } from "../config";

type ErrorBody = { error?: string };

export async function fetchJson<T>(
  path: string,
  init?: Parameters<typeof fetch>[1],
): Promise<T> {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${base}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed (${String(res.status)})`);
  }

  if (!res.ok) {
    const body = data as ErrorBody;
    throw new Error(body.error ?? `Request failed (${String(res.status)})`);
  }

  return data as T;
}
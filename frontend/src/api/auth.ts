import { fetchJson } from "./client";

export async function registerApi(email: string, password: string, name: string) {
  return fetchJson<{ token: string }>("/admin/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function loginApi(email: string, password: string) {
  return fetchJson<{ token: string }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutApi(token: string) {
  return fetchJson<Record<string, unknown>>("/admin/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

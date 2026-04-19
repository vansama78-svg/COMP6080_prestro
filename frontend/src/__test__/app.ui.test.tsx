import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AuthProvider } from "../context/AuthProvider";
import { ErrorProvider } from "../context/ErrorProvider";
import type { PrestoStore } from "../types/presentation";

type MockUser = {
  name: string;
  password: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createMockApiFetch() {
  const users = new Map<string, MockUser>();
  let store: PrestoStore = { presentations: [] };
  const token = "token-test";

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const auth = init?.headers
      ? new Headers(init.headers).get("Authorization")
      : null;

    if (url.pathname === "/admin/auth/register" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        email?: string;
        password?: string;
        name?: string;
      };
      if (!body.email || !body.password || !body.name) {
        return jsonResponse({ error: "Missing fields" }, 400);
      }
      if (users.has(body.email)) {
        return jsonResponse({ error: "Email already in use" }, 400);
      }
      users.set(body.email, { name: body.name, password: body.password });
      return jsonResponse({ token });
    }

    if (url.pathname === "/admin/auth/login" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        email?: string;
        password?: string;
      };
      if (!body.email || !body.password) {
        return jsonResponse({ error: "Missing fields" }, 400);
      }
      const found = users.get(body.email);
      if (!found || found.password !== body.password) {
        return jsonResponse({ error: "Invalid email/password" }, 400);
      }
      return jsonResponse({ token });
    }

    if (url.pathname === "/admin/auth/logout" && method === "POST") {
      return jsonResponse({});
    }

    if (url.pathname === "/store" && method === "GET") {
      if (auth !== `Bearer ${token}`) {
        return jsonResponse({ error: "Unauthorized" }, 403);
      }
      return jsonResponse({ store });
    }

    if (url.pathname === "/store" && method === "PUT") {
      if (auth !== `Bearer ${token}`) {
        return jsonResponse({ error: "Unauthorized" }, 403);
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { store?: PrestoStore };
      store = body.store ?? { presentations: [] };
      return jsonResponse({});
    }

    return jsonResponse({ error: `Unhandled route: ${method} ${url.pathname}` }, 404);
  };
}

function renderApp(initialPath = "/register") {
  return render(
    <ErrorProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </ErrorProvider>,
  );
}

async function registerAndCreatePresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Test User");
  await user.type(screen.getByLabelText("Email"), "test@example.com");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.type(screen.getByLabelText("Confirm password"), "secret123");
  await user.click(screen.getByRole("button", { name: "Register" }));

  await screen.findByRole("button", { name: "New presentation" });
  await user.click(screen.getByRole("button", { name: "New presentation" }));
  await user.type(screen.getByLabelText("Name"), "Demo deck");
  await user.type(screen.getByLabelText("Description"), "Slides for testing");
  await user.type(screen.getByLabelText("Thumbnail URL"), "https://example.com/thumb.png");
  await user.click(screen.getByRole("button", { name: "Create" }));
}

describe("UI paths", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(createMockApiFetch()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("covers admin happy path from register to relogin", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await registerAndCreatePresentation(user);

    await user.click(screen.getByRole("button", { name: /Demo deck/i }));

    await screen.findByRole("button", { name: "Edit title / thumbnail" });
    await user.click(screen.getByRole("button", { name: "Edit title / thumbnail" }));
    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed demo");
    const thumbInput = screen.getByLabelText("Thumbnail URL");
    await user.clear(thumbInput);
    await user.type(thumbInput, "https://example.com/new-thumb.png");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: "Renamed demo" });

    await user.click(screen.getByRole("button", { name: "New slide" }));
    await user.click(screen.getByRole("button", { name: "New slide" }));
    await waitFor(() => expect(screen.getByText("Slide 3 / 3")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Previous slide" }));
    await waitFor(() => expect(screen.getByText("Slide 2 / 3")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "Delete Presentation" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await screen.findByText("No presentations yet. Create your first one.");

    await user.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Log in" });
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByRole("button", { name: "New presentation" });
  });

  it("covers alternative path: reject deleting the only slide", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await registerAndCreatePresentation(user);
    await user.click(screen.getByRole("button", { name: /Demo deck/i }));

    await screen.findByRole("button", { name: "Delete slide" });
    await user.click(screen.getByRole("button", { name: "Delete slide" }));
    await screen.findByText(
      "Cannot delete the only slide. Please delete the presentation instead.",
    );
    await user.click(screen.getAllByRole("button", { name: "Close" })[1]);
    await waitFor(() =>
      expect(
        screen.queryByText(
          "Cannot delete the only slide. Please delete the presentation instead.",
        ),
      ).toBeNull(),
    );
  });
});

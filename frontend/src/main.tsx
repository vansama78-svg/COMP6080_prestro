import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthProvider.tsx";
import { ErrorProvider } from "./context/ErrorProvider.tsx";
import "./index.css";
import { initThemeFromStorage } from "./theme.ts";

initThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ErrorProvider>
  </StrictMode>,
);

import { Route, Routes } from "react-router-dom";
import { ErrorDialog } from "./components/ErrorDialog";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PresentationEditorPage } from "./pages/PresentationEditorPage";
import { RegisterPage } from "./pages/RegisterPage";
import "./App.css";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<RegisterPage />} path="/register" />
        <Route
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
          path="/dashboard"
        />
        <Route
          element={
            <ProtectedRoute>
              <PresentationEditorPage />
            </ProtectedRoute>
          }
          path="/presentation/:presentationId/:slideNumber"
        />
      </Routes>
      <ErrorDialog />
    </>
  );
}

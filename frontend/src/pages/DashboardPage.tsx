import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="dashboard">
      <header className="dashboard__bar">
        <h1 className="dashboard__title">Dashboard</h1>
        <button onClick={handleLogout} type="button">
          Log out
        </button>
      </header>
      <main className="page">
        <p className="page__lead">
          You are logged in. Presentations will appear here in the next milestone.
        </p>
      </main>
    </div>
  );
}

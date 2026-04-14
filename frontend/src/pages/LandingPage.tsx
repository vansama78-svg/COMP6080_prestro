import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="page">
      <h1 className="page__title">Presto</h1>
      <p className="page__lead">Welcome — create and present lightweight slideshows.</p>
      <nav aria-label="Account" className="page__actions">
        <Link className="page__link" to="/login">
          Log in
        </Link>
        <Link className="page__link" to="/register">
          Register
        </Link>
      </nav>
    </main>
  );
}

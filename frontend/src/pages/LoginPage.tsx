import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginApi } from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { token } = await loginApi(email, password);
      signIn(token);
      navigate("/dashboard");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <main className="page page--narrow">
      <h1 className="page__title">Log in</h1>
      <form className="form" noValidate onSubmit={handleSubmit}>
        <div className="form__field">
          <label htmlFor="login-email">Email</label>
          <input
            autoComplete="email"
            id="login-email"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="form__field">
          <label htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            id="login-password"
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <button className="form__submit" type="submit">
          Log in
        </button>
      </form>
      <p className="page__footer">
        No account? <Link to="/register">Register</Link>
      </p>
      <p className="page__footer">
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}

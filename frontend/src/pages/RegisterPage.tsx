import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerApi } from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";

export function RegisterPage() {
  const { isAuthenticated, signIn } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }
    try {
      const { token } = await registerApi(email, password, name);
      signIn(token);
      navigate("/dashboard");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <main className="page page--narrow">
      <h1 className="page__title">Register</h1>
      <form className="form" noValidate onSubmit={handleSubmit}>
        <div className="form__field">
          <label htmlFor="register-name">Name</label>
          <input
            autoComplete="name"
            id="register-name"
            name="name"
            onChange={(e) => setName(e.target.value)}
            required
            type="text"
            value={name}
          />
        </div>
        <div className="form__field">
          <label htmlFor="register-email">Email</label>
          <input
            autoComplete="email"
            id="register-email"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="form__field">
          <label htmlFor="register-password">Password</label>
          <input
            autoComplete="new-password"
            id="register-password"
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <div className="form__field">
          <label htmlFor="register-confirm">Confirm password</label>
          <input
            autoComplete="new-password"
            id="register-confirm"
            name="confirmPassword"
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>
        <button className="form__submit" type="submit">
          Register
        </button>
      </form>
      <p className="page__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <p className="page__footer">
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}

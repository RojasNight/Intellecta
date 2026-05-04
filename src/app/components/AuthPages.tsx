import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { BRAND } from "./brand";
import { Notice, PrimaryButton } from "./shared";
import { useAuth } from "../auth/AuthContext";

interface Props {
  mode: "login" | "register";
}

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
  };
};

export function AuthPage({ mode }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [topMessage, setTopMessage] = useState<string | null>(null);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const returnPath = useMemo(() => {
    const fromState = location.state as LocationState | null;
    return fromState?.from?.pathname
      ? `${fromState.from.pathname}${fromState.from.search ?? ""}`
      : null;
  }, [location.state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { [k: string]: string } = {};
    if (mode === "register" && !name.trim()) errs.name = "Введите имя";
    if (!email.trim()) errs.email = "Укажите email";
    else if (!validateEmail(email)) errs.email = "Неверный формат email";
    if (!password) errs.password = "Введите пароль";
    else if (password.length < 6) errs.password = "Пароль не короче 6 символов";
    if (mode === "register" && password !== confirmPassword) {
      errs.confirmPassword = "Пароли не совпадают";
    }

    setErrors(errs);
    setTopError(null);
    setTopMessage(null);
    if (Object.keys(errs).length) return;

    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("Вы вошли в аккаунт.");
        navigate(returnPath || "/recommendations", { replace: true });
        return;
      }

      const result = await signUp(name, email, password);
      if (result.requiresEmailConfirmation) {
        setTopMessage("Проверьте почту для подтверждения регистрации.");
        toast.success("Проверьте почту для подтверждения регистрации.");
        return;
      }

      toast.success("Аккаунт создан.");
      navigate(returnPath || "/preferences", { replace: true });
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Не удалось выполнить действие. Попробуйте позже.");
    }
  };

  const switchMode = () => {
    navigate(mode === "login" ? "/register" : "/login", { state: location.state });
  };

  return (
    <main className="max-w-md mx-auto px-4 md:px-0 py-12 md:py-16 fade-in">
      <div
        className="rounded-2xl border p-7 md:p-8"
        style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 8px 28px rgba(26,43,60,0.06)" }}
      >
        <h1 className="font-serif" style={{ color: BRAND.navy, fontSize: 28, lineHeight: 1.2 }}>
          {mode === "login" ? "Вход в аккаунт" : "Регистрация"}
        </h1>
        <p style={{ color: BRAND.slate, marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>
          {mode === "login"
            ? "Войдите, чтобы получить персональные рекомендации, сохранить избранное и оформить заказ."
            : "Создайте аккаунт, чтобы сохранить предпочтения и историю заказов."}
        </p>

        {topError && (
          <div
            role="alert"
            className="mt-5 rounded-md px-4 py-3"
            style={{ background: "#F8E3E3", color: "#8C2A2A", fontSize: 14 }}
          >
            {topError}
          </div>
        )}

        {topMessage && (
          <div
            role="status"
            className="mt-5 rounded-md px-4 py-3"
            style={{ background: "#E5EFE6", color: "#2E5E37", fontSize: 14 }}
          >
            {topMessage}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {mode === "register" && (
            <Field label="Имя" id="name" error={errors.name}>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-err" : undefined}
                className="w-full rounded-md border px-3 py-2.5 outline-none"
                style={{ borderColor: errors.name ? "#8C2A2A" : BRAND.lightGray, background: "white" }}
              />
            </Field>
          )}
          <Field label="Email" id="email" error={errors.email}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-err" : undefined}
              className="w-full rounded-md border px-3 py-2.5 outline-none"
              style={{ borderColor: errors.email ? "#8C2A2A" : BRAND.lightGray, background: "white" }}
            />
          </Field>
          <Field label="Пароль" id="password" error={errors.password}>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-err" : undefined}
              className="w-full rounded-md border px-3 py-2.5 outline-none"
              style={{ borderColor: errors.password ? "#8C2A2A" : BRAND.lightGray, background: "white" }}
            />
          </Field>

          {mode === "register" && (
            <Field label="Повторите пароль" id="confirmPassword" error={errors.confirmPassword}>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-err" : undefined}
                className="w-full rounded-md border px-3 py-2.5 outline-none"
                style={{ borderColor: errors.confirmPassword ? "#8C2A2A" : BRAND.lightGray, background: "white" }}
              />
            </Field>
          )}

          <PrimaryButton type="submit" full disabled={loading}>
            {loading ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </PrimaryButton>
        </form>

        <div style={{ color: BRAND.slate, fontSize: 14, marginTop: 16, textAlign: "center" }}>
          {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
          <button onClick={switchMode} style={{ color: BRAND.navy }}>
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <Notice tone="info">
          Демо-режим: данные используются только для демонстрации интерфейса.
        </Notice>
      </div>
    </main>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} style={{ color: BRAND.darkSlate, fontSize: 14, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && (
        <div id={`${id}-err`} role="alert" style={{ color: "#8C2A2A", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

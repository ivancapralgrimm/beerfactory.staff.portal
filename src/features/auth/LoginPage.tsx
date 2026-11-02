import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const codePattern = /^\d{4,12}$/;

function loginErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";

  if (code === "rate_limited") {
    return "Слишком много попыток входа. Подождите 15 минут и повторите.";
  }

  if (code === "auth_request_timeout" || code === "login_unavailable") {
    return "Сеть отвечает слишком долго. Проверьте подключение и повторите.";
  }

  return "Не удалось войти. Проверь имя, фамилию и пароль.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") || "").trim();
    const fullName = String(form.get("fullName") || "").normalize("NFKC").trim().replace(/\s+/g," ");
    const words=fullName.split(" ");

    setError("");
    if(words.length<2 || fullName.length>161){setError("Введи имя и фамилию через пробел.");return;}
    if (!codePattern.test(code)) {
      setError("Пароль должен содержать 4–12 цифр.");
      return;
    }

    setPending(true);
    try {
      const result = await login({
        fullName,
        firstName: words[0],
        lastName: words.slice(1).join(" "),
        code
      });

      navigate(result.recoveryConfigured ? "/" : "/setup-recovery", {
        replace: true
      });
    } catch (loginError) {
      console.error("BeerFactory login", loginError);
      setError(loginErrorMessage(loginError));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ВХОД ДЛЯ КОМАНДЫ"
      title="Войти в портал"
      description="Имя, фамилия и пароль. Без почты и телефона."
    >
      <form className="grid gap-2.5" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="fullName">Имя и фамилия</label>
        <Input id="fullName" name="fullName" autoComplete="username" placeholder="Имя и фамилия" required maxLength={161}/>
        <label className="sr-only" htmlFor="code">Пароль</label>
        <Input
          id="code"
          name="code"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="Пароль · 4–12 цифр"
          required
          maxLength={12}
        />

        <Button variant="primary" size="lg" className="mt-1 w-full" disabled={pending}>

          {pending ? "Проверяем…" : "Войти"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="ghost">
            <Link to="/recovery">Забыл пароль?</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/register">Создать аккаунт</Link>
          </Button>
        </div>

        <div
          role="alert"
          aria-live="polite"
          className="min-h-5 text-sm font-medium text-[var(--bf-red)]"
        >
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

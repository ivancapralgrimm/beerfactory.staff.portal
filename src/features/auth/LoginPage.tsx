import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const codePattern = /^\d{4,12}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") || "").trim();

    setError("");
    if (!codePattern.test(code)) {
      setError("Пароль должен содержать 4–12 цифр.");
      return;
    }

    setPending(true);
    try {
      const result = await login({
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        code
      });

      navigate(result.recoveryConfigured ? "/" : "/setup-recovery", {
        replace: true
      });
    } catch (loginError) {
      console.error("BeerFactory login", loginError);
      setError("Не удалось войти. Проверь имя, фамилию и пароль.");
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
        <label className="sr-only" htmlFor="firstName">Имя</label>
        <Input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          placeholder="Имя"
          required
          maxLength={80}
        />
        <label className="sr-only" htmlFor="lastName">Фамилия</label>
        <Input
          id="lastName"
          name="lastName"
          autoComplete="family-name"
          placeholder="Фамилия"
          required
          maxLength={80}
        />
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
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
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
          className="min-h-5 text-sm font-medium text-[#ff9d93]"
        >
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

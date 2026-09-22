import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { registerStaff } from "@/features/auth/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const codePattern = /^\d{4,12}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "").trim();
    const password2 = String(form.get("password2") || "").trim();
    const secretCode = String(form.get("secretCode") || "").trim();
    const secretCode2 = String(form.get("secretCode2") || "").trim();

    setError("");

    if (!codePattern.test(password)) return setError("Пароль должен содержать 4–12 цифр.");
    if (password !== password2) return setError("Пароли не совпадают.");
    if (!codePattern.test(secretCode)) return setError("Секретный код должен содержать 4–12 цифр.");
    if (secretCode !== secretCode2) return setError("Секретные коды не совпадают.");

    setPending(true);
    try {
      await registerStaff({
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        password,
        secretCode
      });
      navigate("/login", { replace: true, state: { accountCreated: true } });
    } catch (registerError) {
      setError(
        (registerError as Error).message === "user_exists"
          ? "Сотрудник с таким именем и фамилией уже существует."
          : "Не удалось создать аккаунт."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="НОВЫЙ СОТРУДНИК"
      title="Создать аккаунт"
      description="Имя, фамилия, личный пароль и секретный код для восстановления."
    >
      <Button asChild variant="ghost" className="-ml-3 mb-2">
        <Link to="/login"><ArrowLeft className="size-4" />К входу</Link>
      </Button>

      <form className="grid gap-2.5" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="regFirst">Имя</label>
        <Input id="regFirst" name="firstName" autoComplete="given-name" placeholder="Имя" required maxLength={80} />
        <label className="sr-only" htmlFor="regLast">Фамилия</label>
        <Input id="regLast" name="lastName" autoComplete="family-name" placeholder="Фамилия" required maxLength={80} />
        <label className="sr-only" htmlFor="regPassword">Пароль</label>
        <Input id="regPassword" name="password" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Пароль · 4–12 цифр" required maxLength={12} />
        <label className="sr-only" htmlFor="regPassword2">Повторите пароль</label>
        <Input id="regPassword2" name="password2" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Повторите пароль" required maxLength={12} />
        <label className="sr-only" htmlFor="regSecret">Секретный код</label>
        <Input id="regSecret" name="secretCode" type="password" inputMode="numeric" autoComplete="off" placeholder="Секретный код · 4–12 цифр" required maxLength={12} />
        <label className="sr-only" htmlFor="regSecret2">Повторите секретный код</label>
        <Input id="regSecret2" name="secretCode2" type="password" inputMode="numeric" autoComplete="off" placeholder="Повторите секретный код" required maxLength={12} />

        <Button variant="primary" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Создаём…" : "Создать аккаунт"}
        </Button>

        <div role="alert" aria-live="polite" className="min-h-5 text-sm font-medium text-[#ff9d93]">
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

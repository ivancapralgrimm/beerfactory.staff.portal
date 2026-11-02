import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {WarmIcon} from "@/components/warm/WarmIcon";
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
      variant="register"
      title="Создать аккаунт"
      description="Имя, фамилия, личный пароль и секретный код для восстановления."
    >
      <Link className="auth-concept-back" to="/login"><WarmIcon name="back" size={17}/>К входу</Link>

      <form className="auth-concept-form" onSubmit={onSubmit}>
        <label className="auth-concept-label" htmlFor="regFirst">Имя</label>
        <Input id="regFirst" name="firstName" autoComplete="given-name" placeholder="Имя" required maxLength={80} />
        <label className="auth-concept-label" htmlFor="regLast">Фамилия</label>
        <Input id="regLast" name="lastName" autoComplete="family-name" placeholder="Фамилия" required maxLength={80} />
        <label className="auth-concept-label" htmlFor="regPassword">Пароль</label>
        <Input id="regPassword" name="password" type="password" inputMode="numeric" autoComplete="new-password" placeholder="4–12 цифр" required maxLength={12} />
        <label className="auth-concept-label" htmlFor="regPassword2">Повторите пароль</label>
        <Input id="regPassword2" name="password2" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Повторите пароль" required maxLength={12} />
        <label className="auth-concept-label" htmlFor="regSecret">Секретный код</label>
        <Input id="regSecret" name="secretCode" type="password" inputMode="numeric" autoComplete="off" placeholder="Секретный код · 4–12 цифр" required maxLength={12} />
        <label className="auth-concept-label" htmlFor="regSecret2">Повторите секретный код</label>
        <Input id="regSecret2" name="secretCode2" type="password" inputMode="numeric" autoComplete="off" placeholder="Повторите секретный код" required maxLength={12} />

        <Button variant="primary" size="lg" className="mt-1 w-full" disabled={pending}>

          {pending ? "Создаём…" : "Создать аккаунт"}
        </Button>

        <div role="alert" aria-live="polite" className="auth-concept-error">
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

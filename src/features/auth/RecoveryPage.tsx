import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { recoverStaff } from "@/features/auth/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const codePattern = /^\d{4,12}$/;

export function RecoveryPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recoveryCode = String(form.get("recoveryCode") || "").trim();
    const newCode = String(form.get("newCode") || "").trim();

    setError("");
    if (!codePattern.test(recoveryCode) || !codePattern.test(newCode)) {
      setError("Коды должны содержать 4–12 цифр.");
      return;
    }

    setPending(true);
    try {
      await recoverStaff({
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        recoveryCode,
        newCode
      });
      navigate("/login", { replace: true });
    } catch (recoveryError) {
      const code = (recoveryError as Error).message;
      setError(
        code === "rate_limited"
          ? "Слишком много попыток. Повторите позже."
          : code === "invalid_recovery_code"
            ? "Секретный код не подошёл."
            : "Не удалось изменить пароль."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ВОССТАНОВЛЕНИЕ ДОСТУПА"
      title="Задать новый пароль"
      description="Имя, фамилия и секретный код подтверждают доступ к аккаунту."
    >
      <Button asChild variant="ghost" className="-ml-3 mb-2">
        <Link to="/login"><ArrowLeft className="size-4" />К входу</Link>
      </Button>

      <form className="grid gap-2.5" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="rFirstName">Имя</label>
        <Input id="rFirstName" name="firstName" placeholder="Имя" required maxLength={80} />
        <label className="sr-only" htmlFor="rLastName">Фамилия</label>
        <Input id="rLastName" name="lastName" placeholder="Фамилия" required maxLength={80} />
        <label className="sr-only" htmlFor="recoveryCode">Секретный код</label>
        <Input id="recoveryCode" name="recoveryCode" type="password" inputMode="numeric" autoComplete="off" placeholder="Секретный код" required maxLength={12} />
        <label className="sr-only" htmlFor="newCode">Новый пароль</label>
        <Input id="newCode" name="newCode" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Новый пароль · 4–12 цифр" required maxLength={12} />

        <Button variant="primary" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Сохраняем…" : "Изменить пароль"}
        </Button>

        <div role="alert" aria-live="polite" className="min-h-5 text-sm font-medium text-[#ff9d93]">
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

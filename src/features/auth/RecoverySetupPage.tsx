import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { useAuth } from "@/features/auth/auth-context";
import { setRecoveryCode } from "@/features/auth/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const codePattern = /^\d{4,12}$/;

export function RecoverySetupPage() {
  const navigate = useNavigate();
  const { state, markRecoveryConfigured } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (state.status === "booting") return null;
  if (state.status !== "authenticated") return <Navigate to="/login" replace />;

  const accessToken = state.session.access_token;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const first = String(form.get("recoveryCode") || "").trim();
    const second = String(form.get("recoveryCode2") || "").trim();

    setError("");
    if (!codePattern.test(first) || first !== second) {
      setError("Введите одинаковый секретный код из 4–12 цифр.");
      return;
    }

    setPending(true);
    try {
      await setRecoveryCode(accessToken, first);
      await markRecoveryConfigured();
      navigate("/", { replace: true });
    } catch {
      setError("Не удалось сохранить секретный код.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="ЗАЩИТА АККАУНТА"
      title="Создайте секретный код"
      description="Он понадобится, если вы забудете личный пароль."
    >
      <form className="grid gap-2.5" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="setupRecoveryCode">Секретный код</label>
        <Input id="setupRecoveryCode" name="recoveryCode" type="password" inputMode="numeric" autoComplete="off" placeholder="Секретный код · 4–12 цифр" required maxLength={12} />
        <label className="sr-only" htmlFor="setupRecoveryCode2">Повторите секретный код</label>
        <Input id="setupRecoveryCode2" name="recoveryCode2" type="password" inputMode="numeric" autoComplete="off" placeholder="Повторите секретный код" required maxLength={12} />

        <Button variant="primary" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>

        <div role="alert" aria-live="polite" className="min-h-5 text-sm font-medium text-[#ff9d93]">
          {error}
        </div>
      </form>
    </AuthLayout>
  );
}

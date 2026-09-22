import { LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export function ProfilePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();

  if (state.status !== "authenticated") return null;

  const fullName = [state.user.first_name, state.user.last_name].filter(Boolean).join(" ");
  const role = state.user.is_owner ? "Владелец" : state.user.role || "staff";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <section className="py-2">
      <p className="eyebrow">ПРОФИЛЬ</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">
        {fullName || "Сотрудник"}
      </h1>

      <Surface className="mt-5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
            <ShieldCheck className="size-5 text-[var(--bf-gold)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--bf-cream)]">{role}</p>
            <p className="mt-0.5 text-sm text-[var(--bf-dim)]">
              Auth/session уже работают через существующий Supabase backend.
            </p>
          </div>
        </div>
      </Surface>

      <Button variant="danger" className="mt-5 w-full" onClick={handleLogout}>
        <LogOut className="size-4" />Выйти из аккаунта
      </Button>
    </section>
  );
}

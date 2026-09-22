import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/features/auth/auth-context";
import { LoginPage } from "@/features/auth/LoginPage";
import { RecoveryPage } from "@/features/auth/RecoveryPage";
import { RecoverySetupPage } from "@/features/auth/RecoverySetupPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { ProfilePage } from "@/pages/ProfilePage";

function BootScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bf-bg)] px-6">
      <div className="text-center">
        <img src="/assets/icons/profile-avatar.png" alt="" width="72" height="72" className="mx-auto size-[72px]" />
        <p className="mt-4 text-sm font-semibold text-[var(--bf-muted)]">Проверяем сессию…</p>
      </div>
    </main>
  );
}

function ProtectedApp() {
  const { state } = useAuth();
  if (state.status === "booting") return <BootScreen />;
  if (state.status !== "authenticated") return <Navigate to="/login" replace />;
  if (state.recoveryRequired) return <Navigate to="/setup-recovery" replace />;
  return <AppShell />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "booting") return <BootScreen />;
  if (state.status === "authenticated") {
    return <Navigate to={state.recoveryRequired ? "/setup-recovery" : "/"} replace />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/recovery"
        element={
          <PublicOnly>
            <RecoveryPage />
          </PublicOnly>
        }
      />
      <Route path="/setup-recovery" element={<RecoverySetupPage />} />

      <Route element={<ProtectedApp />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="menu"
          element={
            <PlaceholderPage
              eyebrow="РЕЦЕПТЫ"
              title="Recipes migration"
              description="Следующим переносим source-aware IDs, поиск, фильтры, deep-link и offline last-known-good cache."
            />
          }
        />
        <Route
          path="knowledge"
          element={
            <PlaceholderPage
              eyebrow="ЗНАНИЯ"
              title="Knowledge migration"
              description="После Recipes переносим статьи, категории, read-state, изображения и offline availability."
            />
          }
        />
        <Route
          path="shift"
          element={
            <PlaceholderPage
              eyebrow="СМЕНА"
              title="Shift migration"
              description="Операционные подтверждения останутся server-authoritative. Никаких локальных фальшивых успехов."
            />
          }
        />
        <Route
          path="handover"
          element={
            <PlaceholderPage
              eyebrow="ПЕРЕДАЧА СМЕНЫ"
              title="Handover migration"
              description="Структурированные заметки и constrained RPC переедут после стабильных информационных модулей."
            />
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { WarmBack } from "@/components/warm/WarmBack";
import { WarmTitle } from "@/components/warm/WarmPage";
import { Surface } from "@/components/ui/surface";
import { useAuth } from "@/features/auth/auth-context";
import { NotificationSettingsCard } from "@/features/notifications/NotificationSettingsCard";
import "./profile-admin.css";

export function NotificationSettingsPage({ fromProfile = false }: { fromProfile?: boolean }) {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <section className="stack bf-profile-page bf-account-page">
    <WarmBack to={fromProfile ? "/profile" : "/settings"} label={fromProfile ? "В профиль" : "В настройки"} />
    <WarmTitle title={fromProfile ? "Уведомления" : "Уведомление"} description="Приложение на телефоне и сообщения команды." />
    <Surface className="bf-install-panel">
      <h2>Установка BFStaff</h2>
      <p>На iPhone откройте BFStaff в Safari: «Поделиться» → «На экран Домой». На Android выберите «Установить приложение» или «Добавить на главный экран» в меню браузера.</p>
      <p>После установки откройте приложение с домашнего экрана и включите уведомления.</p>
    </Surface>
    <NotificationSettingsCard accessToken={state.session.access_token} />
  </section>;
}

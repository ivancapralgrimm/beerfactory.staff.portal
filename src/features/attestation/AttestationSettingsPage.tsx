import { useSearchParams } from "react-router-dom";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmTitle, WarmRow } from "@/components/warm/WarmPage";
import { AttestationSettingsAdminPanel } from "./AttestationSettingsAdminPanel";

export function AttestationSettingsPage() {
  const [params] = useSearchParams();
  if (params.get("view") === "tickets") return <><WarmBack to="/settings/attestation" label="К управлению аттестацией" /><AttestationSettingsAdminPanel /></>;
  return <section className="stack bf-nav-page"><WarmBack to="/settings" label="В настройки" /><WarmTitle title="Управление аттестацией" /><div className="bf-nav-list">
    <WarmRow to="/admin?section=attempts" title="Результаты" description="История завершённых билетов" icon="check" />
    <WarmRow to="/settings/attestation?view=tickets" title="Билеты и настройки" description="Состав, разделы и порог зачёта" icon="shift" />
    <WarmRow to="/settings/attestation/questions" title="Банк вопросов" description="Редактирование, архив и удаление" icon="book" />
  </div></section>;
}

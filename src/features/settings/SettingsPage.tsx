import { useEffect, useState } from "react";
import { WarmBack } from "@/components/warm/WarmBack";
import { WarmTitle, WarmRow, WarmNotice } from "@/components/warm/WarmPage";
import { useAuth } from "@/features/auth/auth-context";
import { useKnowledgeEditorAccess } from "@/features/knowledge/editor/use-editor-access";
import { supabase } from "@/lib/supabase";
import "./profile-admin.css";

type Capabilities = {
  can_manage_staff: boolean;
  can_view_admin_logs: boolean;
  can_manage_recipes: boolean;
  can_manage_attestation_bank: boolean;
  checklist_positions: string[];
};

export function SettingsPage() {
  const { state } = useAuth();
  const knowledge = useKnowledgeEditorAccess();
  const user = state.status === "authenticated" ? state.user : null;
  const scope = `${user?.id}:${user?.role}:${user?.is_owner}:${user?.position_code}`;
  const [result, setResult] = useState<{ scope: string; data?: Capabilities; error?: boolean }>({ scope: "" });
  useEffect(() => {
    if (!user) return;
    let current = true;
    void supabase.rpc("portal_access_context").then(({ data, error }) => {
      if (current) setResult({ scope, ...(error || !data ? { error: true } : { data: data as Capabilities }) });
    });
    return () => { current = false; };
  }, [scope, user?.id]);
  if (!user) return null;
  const access = result.scope === scope ? result.data : undefined;
  const editors = Boolean(access?.can_manage_recipes || access?.can_manage_attestation_bank || access?.checklist_positions?.length || knowledge.hasEditorAccess);
  return <section className="stack bf-settings-page bf-account-page">
    <WarmBack to="/" label="На главную" />
    <WarmTitle title="Настройки и редактирование" />
    <section className="bf-settings-group">
      <h2>Команды</h2>
      <div className="bf-profile-group">
        {access?.can_manage_staff ? <WarmRow to="/admin?section=team" title="Сотрудники" description="Должности и доступ" icon="people" /> : null}
        <WarmRow to="/settings/notifications" title="Уведомление" description="Установка и уведомления" icon="bell" />
        <WarmRow to="/admin?section=audit" title="Журнал" description={access?.can_view_admin_logs ? "История смен и изменений" : "История смен"} icon="clock" />
      </div>
    </section>
    {editors ? <section className="bf-settings-group">
      <h2>Редакторы</h2>
      <div className="bf-profile-group">
        {access?.can_manage_attestation_bank ? <WarmRow to="/settings/attestation" title="Аттестации" description="Билеты, вопросы и результаты" icon="shift" /> : null}
        {access?.can_manage_recipes ? <WarmRow to="/settings/recipes" title="Рецепты" description="Создание и редактирование" icon="recipes" /> : null}
        {knowledge.hasEditorAccess ? <WarmRow to="/settings/knowledge" title="Знания" description="Статьи и черновики" icon="book" /> : null}
        {access?.checklist_positions?.length ? <WarmRow to="/shift/editor" title="Чек-листы смены" description="Задачи для следующих смен" icon="shift" /> : null}
      </div>
    </section> : null}
    {result.scope === scope && result.error ? <WarmNotice error>Не удалось проверить доступ к инструментам. Обновите страницу.</WarmNotice> : null}
    {knowledge.status === "error" ? <WarmNotice error>Не удалось проверить доступ к редактору знаний.</WarmNotice> : null}
  </section>;
}

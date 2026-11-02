import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { WarmNotice } from "@/components/warm/WarmPage";
import { disablePushNotifications, enablePushNotifications, getPushDeviceState, type PushDeviceState } from "@/features/notifications/notification-api";

export function NotificationSettingsCard({ accessToken }: { accessToken: string }) {
  const [state, setState] = useState<PushDeviceState | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => {
    let active = true;
    void getPushDeviceState().then((next) => { if (active) setState(next); }).catch(() => {
      if (active) setMessage({ error: true, text: "Не удалось проверить уведомления на этом устройстве." });
    });
    return () => { active = false; };
  }, []);
  async function retry() {
    if (pending) return;
    setPending(true); setMessage(null);
    try { setState(await getPushDeviceState()); }
    catch { setMessage({ error: true, text: "Не удалось проверить уведомления на этом устройстве." }); }
    finally { setPending(false); }
  }
  async function toggle() {
    if (pending || !state) return;
    setPending(true); setMessage(null);
    try {
      const next = state.subscribed ? await disablePushNotifications() : await enablePushNotifications(accessToken);
      setState(next);
      if (next.subscribed === state.subscribed) throw new Error("push_state_not_updated");
      setMessage({ error: false, text: next.subscribed ? "Уведомления включены на этом устройстве." : "Уведомления отключены на этом устройстве." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage({ error: true, text: detail.includes("ios_install_required") ? "На iPhone сначала добавьте BFStaff на экран «Домой» и откройте установленное приложение." : detail.includes("permission_denied") ? "Разрешите уведомления для BFStaff в настройках устройства." : "Не удалось изменить уведомления. Повторите попытку." });
      try { setState(await getPushDeviceState()); } catch { /* Retain the last verified device state. */ }
    } finally { setPending(false); }
  }
  return <Surface className="bf-notification-panel">
    <div className="bf-notification-heading"><WarmIcon name="bell" /><div><h2>Уведомления Ленты</h2><p>{state ? state.subscribed ? "Включены на этом устройстве" : "Важные сообщения команды на этом устройстве" : "Проверяем устройство…"}</p></div></div>
    {state && !state.supported ? <p className="bf-account-hint">Уведомления на этом устройстве не поддерживаются.</p> : null}
    {state?.iosNeedsInstall ? <p className="bf-account-hint">На iPhone сначала добавьте BFStaff на экран «Домой», затем включите уведомления.</p> : null}
    {state?.permission === "denied" ? <WarmNotice error>Уведомления запрещены в настройках устройства.</WarmNotice> : null}
    {!state && message ? <Button type="button" variant="secondary" disabled={pending} onClick={() => void retry()}>{pending ? "Проверяем…" : "Повторить проверку"}</Button> : null}
    {state?.supported && !state.iosNeedsInstall ? <Button type="button" role="switch" aria-label="Уведомления Ленты" aria-checked={state.subscribed} variant={state.subscribed ? "secondary" : "primary"} disabled={pending || (!state.subscribed && state.permission === "denied")} onClick={() => void toggle()}>{pending ? "Сохраняем…" : state.subscribed ? "Отключить уведомления" : "Включить уведомления"}</Button> : null}
    {message ? <WarmNotice error={message.error}>{message.text}</WarmNotice> : null}
  </Surface>;
}

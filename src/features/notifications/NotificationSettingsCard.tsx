import {
  Bell,
  BellOff,
  Loader2,
  Smartphone
} from "lucide-react";
import {
  useEffect,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushDeviceState,
  type PushDeviceState
} from "@/features/notifications/notification-api";

const EMPTY: PushDeviceState = {
  supported: true,
  iosNeedsInstall: false,
  permission: "default",
  subscribed: false
};

export function NotificationSettingsCard({
  accessToken
}: {
  accessToken: string;
}) {
  const [state, setState] = useState<PushDeviceState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getPushDeviceState()
      .then((next) => {
        if (active) setState(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (pending) return;

    setPending(true);
    setMessage(null);

    try {
      const next = await enablePushNotifications(accessToken);
      setState(next);
      setMessage("Уведомления включены на этом устройстве.");
    } catch (error) {
      const text = String(
        error && typeof error === "object" && "message" in error
          ? error.message
          : error
      );

      if (text.includes("ios_install_required")) {
        setMessage("На iPhone сначала добавьте BFStaff на экран «Домой» и откройте установленное приложение.");
      } else if (text.includes("permission_denied")) {
        setMessage("Уведомления запрещены. Разрешите их для BFStaff в настройках устройства.");
      } else {
        setMessage("Не удалось включить уведомления на этом устройстве.");
      }

      setState(await getPushDeviceState());
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    if (pending) return;

    setPending(true);
    setMessage(null);

    try {
      const next = await disablePushNotifications();
      setState(next);
      setMessage("Уведомления отключены на этом устройстве.");
    } catch {
      setMessage("Не удалось отключить уведомления.");
    } finally {
      setPending(false);
    }
  }

  const title = state.subscribed
    ? "Уведомления включены"
    : "Уведомления выключены";

  return (
    <Surface className="mt-3 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--bf-line)] bg-[var(--bf-surface-2)]">
          {state.subscribed ? (
            <Bell
              className="size-5 text-[var(--bf-green)]"
              aria-hidden
            />
          ) : (
            <BellOff
              className="size-5 text-[var(--bf-copper-hi)]"
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">УВЕДОМЛЕНИЯ</p>
          <h2 className="mt-1 text-xl font-black">
            {loading ? "Проверяем устройство…" : title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--bf-muted)]">
            Новая передача смены может прийти системным push-уведомлением со звуком, даже когда BFStaff закрыт.
          </p>
        </div>
      </div>

      {!loading && !state.supported ? (
        <p className="mt-3 rounded-xl border border-[var(--bf-line)] bg-[var(--bf-surface-2)] px-3 py-2 text-xs leading-5 text-[var(--bf-muted)]">
          Этот браузер не поддерживает Web Push.
        </p>
      ) : null}

      {!loading && state.iosNeedsInstall ? (
        <div className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--bf-gold),transparent_60%)] bg-[color:color-mix(in_srgb,var(--bf-gold),transparent_92%)] px-3 py-3 text-xs leading-5 text-[var(--bf-muted)]">
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--bf-gold)]" aria-hidden />
            <span>
              На iPhone push работает для BFStaff, установленного на экран «Домой». Откройте Safari → Поделиться → «На экран Домой», затем включите уведомления уже внутри установленного приложения.
            </span>
          </div>
        </div>
      ) : null}

      {!loading && state.permission === "denied" ? (
        <p className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--bf-red),transparent_58%)] bg-[color:color-mix(in_srgb,var(--bf-red),transparent_92%)] px-3 py-2 text-xs leading-5 text-[#e99990]">
          Разрешение на уведомления запрещено системой. Его нужно вернуть в настройках устройства или браузера.
        </p>
      ) : null}

      {!loading && state.supported && !state.iosNeedsInstall ? (
        state.subscribed ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => void disable()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
            Отключить уведомления
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="mt-4 w-full"
            disabled={pending || state.permission === "denied"}
            onClick={() => void enable()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            Включить уведомления
          </Button>
        )
      ) : null}

      <p className="mt-3 min-h-5 text-xs leading-5 text-[var(--bf-dim)]" role="status" aria-live="polite">
        {message || (state.subscribed ? "Push активен только на этом устройстве. Автор собственной передачи уведомление не получает." : "")}
      </p>
    </Surface>
  );
}

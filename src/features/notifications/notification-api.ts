import { config, edgeFunctions } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export type PushDeviceState = {
  supported: boolean;
  iosNeedsInstall: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

type SafariNavigator = Navigator & {
  standalone?: boolean;
};

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as SafariNavigator).standalone === true
  );
}

function supportFlags() {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  return {
    supported,
    iosNeedsInstall:
      supported && isIosDevice() && !isStandalone()
  };
}

function urlBase64ToArrayBuffer(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes.buffer;
}

async function fetchVapidPublicKey(accessToken: string) {
  const response = await fetch(edgeFunctions.handoverPush, {
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = (await response.json().catch(() => ({}))) as {
    public_key?: string;
    error?: string;
  };

  if (!response.ok || !data.public_key) {
    throw new Error(data.error || "push_config_failed");
  }

  return data.public_key;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("invalid_push_subscription");
  }

  const { error } = await supabase.rpc(
    "register_push_subscription",
    {
      p_endpoint: json.endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent
    }
  );

  if (error) throw error;
}

export async function getPushDeviceState(): Promise<PushDeviceState> {
  const flags = supportFlags();

  if (!flags.supported) {
    return {
      supported: false,
      iosNeedsInstall: false,
      permission: "unsupported",
      subscribed: false
    };
  }

  const permission = Notification.permission;

  if (flags.iosNeedsInstall || permission !== "granted") {
    return {
      ...flags,
      permission,
      subscribed: false
    };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  return {
    ...flags,
    permission,
    subscribed: Boolean(subscription)
  };
}

export async function enablePushNotifications(accessToken: string) {
  const flags = supportFlags();

  if (!flags.supported) {
    throw new Error("push_unsupported");
  }

  if (flags.iosNeedsInstall) {
    throw new Error("ios_install_required");
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== "granted") {
    throw new Error("push_permission_denied");
  }

  const publicKey = await fetchVapidPublicKey(accessToken);
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey)
    });
  }

  await saveSubscription(subscription);
  return getPushDeviceState();
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) {
    return getPushDeviceState();
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (subscription) {
    const { error } = await supabase.rpc(
      "unregister_push_subscription",
      { p_endpoint: subscription.endpoint }
    );

    if (error) throw error;
    await subscription.unsubscribe();
  }

  return getPushDeviceState();
}


type BadgeNavigator = Navigator & {
  clearAppBadge?: () => Promise<void>;
};

export async function clearPushBadge() {
  const badgeNavigator = navigator as BadgeNavigator;

  try {
    if (typeof badgeNavigator.clearAppBadge === "function") {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // Badge support is optional.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      registration?.active?.postMessage({ type: "BF_CLEAR_APP_BADGE" });
    }
  } catch {
    // Foreground clear above is enough when the worker is still updating.
  }
}

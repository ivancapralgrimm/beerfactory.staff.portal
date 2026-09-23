# BeerFactory Staff Portal · Handover Web Push

## Goal

When one employee creates a Handover note, subscribed active employees receive a system push notification even when BFStaff is not open.

The author does not receive their own notification.

## Client flow

Profile contains a visible `Включить уведомления` control.
Permission is requested only after that user action.

Per-device subscription is stored in `push_subscriptions` through auth-bound RPCs:
- `register_push_subscription`
- `unregister_push_subscription`

A subscription belongs to the current authenticated user. Re-registering the same browser endpoint transfers that endpoint to the current signed-in user, which matters on shared devices.

## iPhone / iPad

Web Push is intended for the installed Home Screen web app.
The UI explains this and does not request permission from a normal iPhone browser tab.

## Handover create + delivery

React sends new Handover creation to the authenticated `handover-push` Edge Function.
The function:
1. validates the Supabase user and active profile;
2. creates the note through the existing auth-bound `create_handover` RPC;
3. loads active-device subscriptions for all active staff except the author;
4. sends Web Push;
5. removes dead 404/410 subscriptions;
6. returns note success even if an individual push delivery fails.

Note creation therefore remains authoritative and is not rolled back by a recipient device being offline or unsubscribed.

## VAPID

The Edge Function lazily generates one VAPID keypair on the first authenticated notification setup request.
The keypair is stored in `push_vapid_config`.

Security:
- `anon` has no access;
- `authenticated` has no access;
- only `service_role` can read/write the keypair table;
- the browser receives only the public key.

The private VAPID key is never committed to Git.

## Service worker

VitePWA remains in `generateSW` mode.
Workbox imports `public/push-sw.js` into the generated worker.

The push handler:
- shows a persistent system notification;
- uses device-default sound because `silent` is false;
- requests vibration where supported;
- sets an app badge where supported;
- opens `/#/handover` when tapped.

A custom audio file is not guaranteed by Web Push and is intentionally not used.

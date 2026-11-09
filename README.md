<!-- HYPRGATE NAPPLET MIRROR NOTICE:START -->
> This repository is a read-only mirror of the `relay-browser` napplet from `hyprgate/gui`.
> Open issues and pull requests in https://github.com/hyprgate/gui.
> Do not push commits to this standalone napplet repository; direct changes are overwritten by Hyprgate's mirror workflow.
<!-- HYPRGATE NAPPLET MIRROR NOTICE:END -->

# Relay Browser

Explore NIP-66 relay monitor data (kind 30166) and add relays to your lists. The app
is tracked in this repo at `napplets/relay-browser`; the standalone
`hyprgate/napplet-relay-browser` repository is a generated, read-only mirror.

Each row shows what the relay calls itself (from the NIP-11 JSON in the event
content), with speed and access in words. A row expands to the full detail,
including the operator's profile when the relay names one.

- Lists are read and merged before publishing: kind 10002 for the relay list, 10006
  for blocked relays and 30002 for relay sets.
- Opening a feed goes through the shared feed intent, pinned to that relay.
- Actions always end in a visible result. Read-only sessions can browse, and see the
  reason when a publish is refused.

The sandbox is `allow-scripts` only, so this app can't use `prompt()` or
`<form onsubmit>`. Neither ever fires there.

```bash
pnpm --filter ./napplets/relay-browser test
pnpm --filter ./napplets/relay-browser type-check
pnpm --filter ./napplets/relay-browser build
```

The relay monitor data is whatever the connected relays have cached, so the list
reflects those monitors rather than every relay in existence.

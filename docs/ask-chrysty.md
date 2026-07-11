# Ask Chrysty — Ledger

Ledger follows the sibling-app golden path (Learning pilot). Do not invent a second Live stack.

**Full guide:** Astra `docs/embed/ask-chrysty-sibling-apps.md`  
**Device gate (before prod):** Ask Chrysty device-gate checklist (real devices, not simulators only)

## Ledger wiring

| Piece | Value |
|-------|--------|
| Worker | `ledger` |
| Shell source | `ledger_workspace` |
| Nested source | `ledger_asset` (open asset canvas) |
| Shell capture | `#workspace-content` in `AppShell` |
| Nested capture | `#asset-content` in `AssetCanvas` |
| Provider | `src/app/layout.tsx` — one `ChrystyLiveEmbedProvider` |
| FAB | one `AskChrystyButton` in `AppShell` |
| Package | `packages/live-embed` (`@chrysty/live-embed`) |

## Env

```
NEXT_PUBLIC_ASTRA_EMBED_URL=https://chrysty.chrysty.dev
```

Live mic / WebSocket / Gemini run only inside `chrysty.chrysty.dev/embed/live`. Desktop Chrome embed audio grit is an Astra-only open issue; host still ships this path.

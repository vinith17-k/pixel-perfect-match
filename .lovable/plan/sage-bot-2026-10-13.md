# Sage Bot

## Build
- Replace the blank home screen with Sage Bot’s sign-in entry and a protected, tactile dispenser workspace.
- Add private profiles and per-account medicine, slot, schedule, dose history, device settings, telemetry, and command records in Lovable Cloud; seed each account’s eight empty slots and hardware defaults at signup.
- Deliver working Today, Slots, Schedule, History, Hardware, and Settings views, including medication CRUD, dose actions, CSV export, realtime updates with polling fallback, and an in-browser simulator.
- Respect the selected protected-data access model; do not create anonymous access to medication or device records.

## Technical details
- Use managed Cloud Auth with email/password and Google sign-in, profile creation on signup, and the generated auth gate/client modules.
- Add owner-scoped row security, explicit grants, and realtime publication for app tables in a migration; keep simulator and browser operations under the signed-in user’s policies.
- Keep scheduling and simulator work browser-active only; hardware REST integration is represented by command/telemetry records and requires a separately provisioned device credential before an ESP32 can authenticate.
- Validate the authenticated app in preview and review build/runtime diagnostics.
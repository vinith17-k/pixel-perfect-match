# ESP32 Firmware Contract

The firmware is in `firmware/esp32_sage_bot/esp32_sage_bot.ino`. It connects to Supabase over TLS and authenticates as the dedicated device user. It is not a service-role client.

## Provisioning and authentication

Copy `secrets.example.h` to the ignored `secrets.h`, then configure the 2.4GHz Wi-Fi credentials, Supabase project URL, publishable key, and device user's email/password. Create this user in Supabase Authentication and set its UUID as `app_access.device_user_id` as described in the README.

The firmware requests `/auth/v1/token?grant_type=password`, refreshes its access token with the refresh token before expiry, and falls back to password authentication if refresh fails. PostgREST requests include:

```http
apikey: <SUPABASE_PUBLISHABLE_KEY>
Authorization: Bearer <DEVICE_ACCESS_TOKEN>
Content-Type: application/json
```

TLS certificate verification is enabled using the GlobalSign ECC Root CA - R4 certificate in `secrets.example.h`. Do not use `setInsecure()`.

## Runtime behavior

| Interval / event | Behavior |
|---|---|
| Every 3 seconds | Calls `POST /rest/v1/rpc/claim_next_command`. The RPC atomically leases one command and returns an array with zero or one command. |
| After a command | Calls `POST /rest/v1/rpc/complete_device_command` with `p_id`, `p_status`, and `p_result`; the database verifies command ownership. |
| Every 10 seconds | Patches `device_status?id=eq.1` with current state, estimated slot, connection details, and supported `parts_ok`. |
| Every 30 seconds | Reads enabled schedules and medicine names to update the display's next-dose preview. These are not cached for offline alarm execution. |
| Physical button during active alarm | Calls `POST /rest/v1/rpc/mark_dose_taken` with `p_event_id` and `p_taken_via: "button"`. The RPC performs the authorized dose transition and inventory update atomically. |

An offline ESP32 retries Wi-Fi and does not process authenticated commands, report telemetry, or fire dose schedules. The dashboard/browser simulator is separate and requires a working authenticated web session.

## Command handling

| Type | Firmware behavior |
|---|---|
| `rotate_to_slot` | Rotates the stepper using the boot-relative estimated position. No sensor verifies alignment. |
| `home` | Returns `failed`: automatic homing requires an absent position sensor. This command is retained only for stale queued commands. |
| `test_stepper` | Performs a forward and reverse single-slot test. |
| `test_oled` | Displays a short OLED test. |
| `test_button` | Reports the button's instantaneous electrical state. |
| `test_led`, `test_buzzer` | Exercises the LED or buzzer. |
| `show_message` | Displays the provided lines for the requested duration. |
| `load_done` | Displays a compartment-loaded confirmation. |
| `stop_alarm`, `mark_taken` | Stops local alarm outputs and shows the dose-taken screen. Dose persistence is handled by the `mark_dose_taken` RPC. |
| `test_alarm` | Runs a local test alarm. |

Commands for Hall sensors, IR sensors, or a servo are unsupported and are intentionally absent.

## Telemetry

The device writes the single `device_status` row (`id = 1`), including `last_seen`, estimated `current_slot`, Wi-Fi details, firmware version, uptime, OLED screen state, and `parts_ok` for OLED, stepper, button, LED, and buzzer. The database's `parts_ok` field is JSON and can still contain legacy data; the firmware no longer reports Hall, IR, or servo values.

## Position and safety limitations

The rotor starts with its software position set to Slot 1 at boot. Without a Hall sensor or another position feedback source, missed steps or manual movement can desynchronize its estimated position. Manually align the disc after each restart and do not treat software slot position as verified dispensing. This prototype also does not provide an IR-verified pill-drop event or a servo-controlled shutter.

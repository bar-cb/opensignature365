# Microsoft Graph permissions

OpenSignature365 uses **application** permissions (no signed-in user). All require admin consent.

| Permission | Required? | Used for |
|---|---|---|
| `User.Read.All` | **Yes** | Read user profile attributes (`displayName`, `jobTitle`, `mail`, `businessPhones`, `mobilePhone`, `department`, `officeLocation`, `city`, `country`, `companyName`) for live previews of signatures against real users. |
| `Directory.Read.All` | **Yes** | List users in `/api/microsoft/users` and the Web UI user picker. |
| `Mail.Send` | Recommended | Send preview emails through `POST /users/{sender}/sendMail`. The sending mailbox is configured via `PREVIEW_SENDER_UPN`. Omit if you don't need the "Send preview" button. |
| `Group.Read.All` | Optional | Required only when an `apply_to.mode = "group"` signature targets a distribution / mail-enabled group. |
| `Organization.Read.All` | Optional | Used by `os365 test-graph` to print tenant info. |

## Least-privilege guidance

- If you don't need previews against real users, you can **omit `User.Read.All`** and use only the bundled sample users (`data/users/sample-users.json`).
- If you don't use the "Send preview" feature, **omit `Mail.Send`** entirely.
- `Mail.Send` is application-wide; consider scoping with [Application Access Policies](https://learn.microsoft.com/graph/auth-limit-mailbox-access) to restrict the preview sender to a single mailbox.

## Revoking access

Delete the client secret (or rotate it) in **Entra → App registrations → OpenSignature365 - Graph → Certificates & secrets**, and remove the app entirely if no longer in use. Unset `MICROSOFT_*` env vars on the host.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Sage Bot architecture
- Keep user medication, schedule, history, and device data in Cloud tables scoped to the signed-in owner; row security is the data boundary because these records are sensitive.
- Keep the dispenser workspace in a protected named route and use a public root for authentication, so unauthenticated users never render private health records.
- Keep hardware simulation and schedule evaluation in the browser while Sage Bot is open; device-side access must use a separately provisioned credential rather than public access.

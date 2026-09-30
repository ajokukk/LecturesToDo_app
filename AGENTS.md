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

# Backend decisions
- ClassBoard tasks table is a shared public board: no auth, anon SELECT/INSERT/UPDATE/DELETE with permissive RLS. Why: teachers and students share one board without logins; if user accounts are ever requested, migrate to authenticated policies and add `owner_id`.

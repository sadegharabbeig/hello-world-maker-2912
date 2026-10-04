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

## Rules
- Access: username/password login (usernames hex-encoded into synthetic emails, signup disabled); roles in `user_roles` (admin/editor/viewer) enforced by RLS via `has_any_role`/`can_edit`; user management only through admin-checked server functions in `src/lib/users.functions.ts`. Why: accounting data must not be readable or editable without permission.

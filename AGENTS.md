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

- Store both career modes and driver-specific season state inside the existing career JSON; this preserves existing saves without new schema requirements.
- Keep driver-career rules in a browser-safe career module and capture each race's team affiliations before lineup changes so historical constructor points remain stable.
- Freeze the chosen points table when a season starts; all standings, H2H and point-based sponsor objectives use that season's table, with modern F1 as the legacy fallback.
- Store reusable team identities and season assignments on the team's existing JSON record; retain its stable ID and resolve names/colours by season to preserve history.

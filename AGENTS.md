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

## Architecture rules
- AI calls (unit generation, correction, TTS, STT) live in `src/lib/ai.server.ts` and are exposed only via authenticated server functions in `src/lib/ai.functions.ts` — keeps the gateway key server-side.
- Lesson content is AI-generated once per unit and stored as JSON in `units.content`; vocabulary cards become `learned_items` rows — review and history read those rows, not regenerated content.
- Pure learning rules (diagnostic scoring, mastery, answer checks) live in `src/lib/learning.ts` with tests in `src/test/learning.test.ts`.
- Signed-in pages live under `src/routes/_authenticated/`, whose layout renders the bubble dock.

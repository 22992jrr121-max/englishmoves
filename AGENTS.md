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
- Chat with Emma streams from the `/api/chat` server route (`src/lib/chat.server.ts`, AI SDK Responses); it verifies the bearer token itself and persists each `UIMessage` in `chat_messages` — a server route because the AI SDK UI stream needs a raw HTTP response.
- Live speaking calls use the persistent WebSocket relay `src/lib/live-relay.server.ts`, dispatched from `src/server.ts` (published) and `live-vite-plugin.ts` (dev); the browser sends scenario + access token in `app.start` and the relay verifies the user before opening a paid session.
- Level-up exams are graded/recorded only by the `submitExam` server function (admin insert into `level_exams`, profile level update), so students cannot write exam results directly.
- General English is the student's own static course in `src/content/course/` (per-level JSON loaded on demand via `src/lib/course.ts`); progress lives in a `units` row per course unit (`topic` = unit code, `content` = CourseState) so review/history keep working — no AI generation for this block.
- The level exam uses `content/course/exam-tasks.json` only on the server (`generateExam` strips answers, `submitExam` grades) so solutions never reach the browser.

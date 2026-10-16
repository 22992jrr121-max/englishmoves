// Server-only: WhatsApp-style chat with "Emma". Streams via AI SDK Responses and persists UIMessages.
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { bearer, verifyAccessToken } from "./server-auth.server";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id.server";
import type { Json } from "@/integrations/supabase/types";

const BASE = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-6-astra";

function json(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers: { "content-type": "application/json" } });
}

export async function handleChat(request: Request) {
  const auth = await verifyAccessToken(bearer(request));
  if (!auth) return json(401, "Inicia sesión de nuevo.");
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return json(500, "Falta la configuración de IA.");

  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    messages = Array.isArray(body.messages) ? body.messages.slice(-60) : [];
  } catch {
    return json(400, "Petición no válida.");
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "Falta tu mensaje.");

  const { supabase, userId } = auth;
  const { error: saveErr } = await supabase
    .from("chat_messages")
    .upsert({ user_id: userId, message_id: last.id, role: "user", message: last as unknown as Json }, { onConflict: "user_id,message_id" });
  if (saveErr) return json(500, "No se pudo guardar tu mensaje.");

  const { data: profile } = await supabase.from("profiles").select("display_name, level, job_description").eq("id", userId).maybeSingle();
  const level = profile?.level ?? "A2";
  const instructions = `You are Emma, a warm, curious English-speaking friend chatting with ${profile?.display_name ?? "the student"} on a WhatsApp-like app.
The student is a Spanish speaker learning English at CEFR level ${level}. Their job: "${profile?.job_description ?? "unknown"}".
- Write like a real chat: short messages (1-3 sentences), casual, friendly, an occasional emoji.
- Use English suited to level ${level}; simpler for A1-A2, richer for C1-C2.
- Keep the conversation going with one question at a time, often about their day and their work tasks, colleagues and projects.
- Never lecture or list corrections (another system corrects them). If they write in Spanish, reply in simple English and gently encourage English.`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${BASE}/v1`,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        const { error } = await supabase.from("chat_messages").upsert(
          { user_id: userId, message_id: responseMessage.id, role: "assistant", message: responseMessage as unknown as Json },
          { onConflict: "user_id,message_id" },
        );
        if (error) console.error("chat persist failed", error.message);
      },
    }),
    runIdFetch,
  );
}

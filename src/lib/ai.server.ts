// Server-only helpers for Lovable AI Gateway (Responses, speech, transcription).
const BASE = "https://ai.gateway.lovable.dev";
export const TEXT_MODEL = "openai/gpt-6-astra";
export const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
export const STT_MODEL = "openai/gpt-transcribe";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "Falta la configuración de IA.");
  return key;
}

function friendly(status: number, body: string) {
  if (status === 402) return "Se han agotado los créditos de IA del espacio de trabajo.";
  if (status === 429) return "Demasiadas peticiones a la IA. Espera unos segundos y vuelve a intentarlo.";
  if (status === 403) return "La IA no está disponible ahora mismo para este espacio de trabajo.";
  try {
    const j = JSON.parse(body);
    return j?.error?.message || j?.message || `Error de IA (${status})`;
  } catch {
    return `Error de IA (${status})`;
  }
}

/** Streams a Responses call with a strict JSON schema and returns the parsed object. */
export async function generateJson<T>(opts: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const res = await fetch(`${BASE}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      instructions: opts.instructions,
      input: opts.input,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) throw new AiError(res.status, friendly(res.status, await res.text()));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let done = false;
  while (!done) {
    const r = await reader.read();
    if (r.done) break;
    buf += decoder.decode(r.value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let ev: { type?: string; delta?: string; response?: { error?: { message?: string } }; message?: string };
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      else if (ev.type === "response.completed") done = true;
      else if (ev.type === "response.failed" || ev.type === "error")
        throw new AiError(500, ev.response?.error?.message || ev.message || "La IA no pudo completar la respuesta.");
      else if (ev.type === "response.incomplete") done = true;
    }
  }
  if (!text) throw new AiError(500, "La IA no devolvió contenido. Inténtalo de nuevo.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError(500, "La respuesta de la IA no tenía el formato esperado. Inténtalo de nuevo.");
  }
}

export async function synthesizeSpeech(text: string, signal?: AbortSignal) {
  return fetch(`${BASE}/v1/audio/speech`, {
    method: "POST",
    signal: signal ?? null,
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: `Say clearly in a natural American English accent: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
      stream_format: "audio",
    }),
  });
}

export async function transcribeAudio(file: File, hint?: string) {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", file, file.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  form.append("languages", "en");
  if (hint) form.append("prompt", hint.slice(0, 500));
  const res = await fetch(`${BASE}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok || !res.body) throw new AiError(res.status, friendly(res.status, await res.text()));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let final = "";
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    buf += decoder.decode(r.value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "transcript.text.delta" && ev.delta) text += ev.delta;
        if (ev.type === "transcript.text.done" && ev.text) final = ev.text;
        if (ev.type === "error") throw new AiError(500, ev.error?.message || "Error al transcribir");
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  return (final || text).trim();
}

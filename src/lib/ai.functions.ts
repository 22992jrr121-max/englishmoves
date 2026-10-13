import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UnitContent } from "./learning";

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const UNIT_SCHEMA = obj({
  title: str,
  objective_es: str,
  intro_es: str,
  cards: { type: "array", items: obj({ term: str, meaning_es: str, example_en: str, example_es: str }) },
  grammar: obj({ title: str, explanation_es: str, examples: strArr }),
  dialogue: { type: "array", items: obj({ speaker: str, es: str, en: str }) },
  reading: obj({ title: str, text: str }),
  exercises: {
    type: "array",
    items: obj({
      type: {
        type: "string",
        enum: ["multiple_choice", "fill_blank", "order_words", "translate", "open_question", "listening", "read_aloud"],
      },
      section: str,
      instruction_es: str,
      prompt: str,
      options: strArr,
      answer: str,
      explanation_es: str,
    }),
  },
});

const EXERCISE_RULES = `Exercise field rules:
- multiple_choice: prompt = question in English; options = 3-4 choices; answer = the exact correct option text.
- fill_blank: prompt = English sentence with "___" for the gap; options = []; answer = the missing word(s) only.
- order_words: prompt = the words of an English sentence shuffled, separated by " / "; options = []; answer = the full correct sentence.
- translate: prompt = a sentence in Spanish; options = []; answer = a natural English translation.
- open_question: prompt = an English question; options = []; answer = a model answer in English.
- listening: prompt = an English sentence that will be played as audio (student types what they hear); options = []; answer = same sentence.
- read_aloud: prompt = an English sentence or short passage to read aloud; options = []; answer = same text.
- section: short label in Spanish (e.g. "Vocabulario", "Phrasal verbs", "Gramática", "Listening", "Reading", "Speaking", "Writing", "Diálogo", "Práctica").
- instruction_es and explanation_es are always in Spanish. All English must match the CEFR level.`;

function blockBrief(block: string, level: string, topic: string, job: string) {
  if (block === "daily")
    return `Block: Everyday English. Situation: "${topic}". Level ${level}.
- cards: 8 of the most useful words/expressions for this real situation, with examples in context.
- dialogue: a realistic 6-8 line dialogue for the situation (speakers like "Tú" and another role). "es" is the Spanish line the student must translate; "en" a natural English version.
- grammar: one short useful structure for the situation (title, short Spanish explanation, 3 examples).
- reading: a short realistic text (sign, message, menu, email…) related to the situation.
- exercises: 10 total mixing multiple_choice, fill_blank, order_words, listening, translate and read_aloud.`;
  if (block === "general")
    return `Block: General English (Cambridge-style coursebook unit). Unit theme: "${topic}". Level ${level}.
- cards: 8 key vocabulary items of the unit, including 2-3 phrasal verbs.
- grammar: the unit's main grammar point with a clear Spanish explanation and 4 examples.
- reading: a ${level}-appropriate reading text (120-220 words) on the theme.
- dialogue: [] (empty).
- exercises: 12 total covering sections Vocabulario, Phrasal verbs, Gramática, Reading (questions about the text), Listening, Speaking (read_aloud), Writing (open_question). Use all exercise types.`;
  return `Block: English for the student's job. Job description: "${job}". Topic: "${topic}". Level ${level}.
- cards: 10 technical terms/expressions this person really uses at work, with examples set in their daily tasks.
- grammar: one structure useful at work (e.g. polite requests, reporting), short Spanish explanation, 3 examples.
- dialogue: [] (empty). reading: a short work document (email, report, procedure) using the vocabulary.
- exercises: 12 total: 3 practice exercises (multiple_choice/fill_blank), 4 translate (Spanish work sentences → English), 4 open_question (English questions about their own job that must be answered using the vocabulary), 1 read_aloud.`;
}

export const generateUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ block: z.enum(["daily", "general", "work"]), topic: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateJson } = await import("./ai.server");
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("level, job_description").eq("id", userId).single();
    const level = profile?.level ?? "A2";
    const job = profile?.job_description ?? "general office worker";
    try {
      const content = await generateJson<UnitContent>({
        instructions: `You are an expert ESL teacher and Cambridge materials writer creating lessons for Spanish speakers. Return only the requested JSON.\n${EXERCISE_RULES}`,
        input: blockBrief(data.block, level, data.topic, job),
        schemaName: "unit",
        schema: UNIT_SCHEMA,
      });
      const { data: unit, error } = await supabase
        .from("units")
        .insert({ user_id: userId, block: data.block, level, topic: data.topic, title: content.title, content })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const items = content.cards.map((c) => ({
        user_id: userId,
        unit_id: unit.id,
        block: data.block,
        term: c.term,
        meaning: c.meaning_es,
        example: c.example_en,
      }));
      if (items.length) await supabase.from("learned_items").insert(items);
      return { id: unit.id as string, error: null as string | null };
    } catch (e) {
      return { id: null, error: e instanceof Error ? e.message : "No se pudo crear la unidad." };
    }
  });

export const generateWorkTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateJson } = await import("./ai.server");
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("level, job_description").eq("id", userId).single();
    if (!profile?.job_description) return { topics: [], error: "Describe tu trabajo en tu perfil primero." };
    try {
      const out = await generateJson<{ topics: { title: string; description: string; emoji: string }[] }>({
        instructions:
          "You design workplace English syllabi for Spanish speakers. Titles and descriptions in Spanish, short. One emoji each.",
        input: `Job: "${profile.job_description}". Level ${profile.level ?? "A2"}. Propose 8 practical topics ordered from most to least frequent in this person's daily work.`,
        schemaName: "topics",
        schema: obj({ topics: { type: "array", items: obj({ title: str, description: str, emoji: str }) } }),
      });
      await supabase.from("profiles").update({ work_topics: out.topics }).eq("id", userId);
      return { topics: out.topics, error: null as string | null };
    } catch (e) {
      return { topics: [], error: e instanceof Error ? e.message : "No se pudo generar el temario." };
    }
  });

export const correctAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type: z.string().max(40),
        prompt: z.string().max(2000),
        expected: z.string().max(2000),
        answer: z.string().max(2000),
        context: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateJson } = await import("./ai.server");
    const { data: profile } = await context.supabase.from("profiles").select("level, job_description").eq("id", context.userId).single();
    try {
      return await generateJson<{ correct: boolean; score: number; corrected: string; feedback_es: string }>({
        instructions:
          "You are a kind, precise English teacher correcting a Spanish-speaking student's answer. Accept any natural, grammatical answer that conveys the meaning — do not require the reference wording. score 0-100. corrected: the student's answer fixed minimally in natural English (or the same text if already right). feedback_es: 1-3 short sentences in Spanish explaining mistakes or praising.",
        input: `Level: ${profile?.level ?? "A2"}. Job: ${profile?.job_description ?? "-"}. Context: ${data.context ?? "-"}
Exercise type: ${data.type}
Prompt: ${data.prompt}
Reference answer: ${data.expected}
Student answer: ${data.answer}`,
        schemaName: "correction",
        schema: obj({ correct: { type: "boolean" }, score: { type: "integer" }, corrected: str, feedback_es: str }),
      });
    } catch (e) {
      return { correct: false, score: 0, corrected: "", feedback_es: "", error: e instanceof Error ? e.message : "Error" };
    }
  });

export const speak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(1).max(1200) }).parse(d))
  .handler(async ({ data }) => {
    const { synthesizeSpeech } = await import("./ai.server");
    const res = await synthesizeSpeech(data.text);
    if (!res.ok) return { audio: null, error: res.status === 402 ? "Sin créditos de IA." : "No se pudo generar el audio." };
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin), mime: res.headers.get("content-type") || "audio/wav", error: null as string | null };
  });

export const transcribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ audio: z.string().min(10).max(14_000_000), mime: z.string().max(80), hint: z.string().max(600).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { transcribeAudio } = await import("./ai.server");
    try {
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mime = data.mime.startsWith("video/") ? data.mime.replace("video/", "audio/") : data.mime;
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
      const text = await transcribeAudio(new File([bytes], `speech.${ext}`, { type: mime.split(";")[0] ?? mime }), data.hint);
      return { text, error: null as string | null };
    } catch (e) {
      return { text: "", error: e instanceof Error ? e.message : "No se pudo transcribir." };
    }
  });

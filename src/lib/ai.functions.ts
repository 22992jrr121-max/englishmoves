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

/** Gentle correction for one chat message; stored on the chat row. */
export const correctChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().min(1).max(200), text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateJson } = await import("./ai.server");
    const { data: profile } = await context.supabase.from("profiles").select("level").eq("id", context.userId).single();
    try {
      const out = await generateJson<{ ok: boolean; corrected: string; note_es: string }>({
        instructions:
          "You check a Spanish-speaking English learner's chat message. ok=true if it is natural and correct for casual chat (ignore capitalization and missing final punctuation). Otherwise corrected = the minimally fixed natural English version, note_es = one short Spanish sentence explaining the main fix. If ok, corrected = the same text and note_es = ''.",
        input: `Level ${profile?.level ?? "A2"}. Message: ${data.text}`,
        schemaName: "chat_correction",
        schema: obj({ ok: { type: "boolean" }, corrected: str, note_es: str }),
      });
      await context.supabase.from("chat_messages").update({ correction: out }).eq("user_id", context.userId).eq("message_id", data.messageId);
      return { ...out, error: null as string | null };
    } catch (e) {
      return { ok: true, corrected: "", note_es: "", error: e instanceof Error ? e.message : "Error" };
    }
  });

/** Post-call feedback for a live speaking session. */
export const summarizeCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ scenario: z.string().max(80), transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateJson } = await import("./ai.server");
    const { data: profile } = await context.supabase.from("profiles").select("level").eq("id", context.userId).single();
    const convo = data.transcript.map((t) => `${t.role === "user" ? "Student" : "Tutor"}: ${t.text}`).join("\n").slice(-12000);
    try {
      return await generateJson<{ fluency: number; strengths_es: string[]; improvements: { said: string; better: string; note_es: string }[]; new_words: string[] }>({
        instructions:
          "You are an English speaking coach. Review a spoken role-play transcript (student speech is auto-transcribed, ignore transcription noise). fluency 0-100. strengths_es: 2-3 short Spanish bullet points. improvements: up to 5 items quoting what the student said and a better natural version, with a short Spanish note. new_words: up to 6 useful English words/expressions from the conversation the student should keep.",
        input: `Level ${profile?.level ?? "A2"}. Scenario: ${data.scenario}\n${convo}`,
        schemaName: "call_summary",
        schema: obj({
          fluency: { type: "integer" },
          strengths_es: strArr,
          improvements: { type: "array", items: obj({ said: str, better: str, note_es: str }) },
          new_words: strArr,
        }),
      });
    } catch (e) {
      return { fluency: 0, strengths_es: [], improvements: [], new_words: [], error: e instanceof Error ? e.message : "Error" };
    }
  });

type RawItem = { n: number; answer?: string | null; explanation?: string; response_type?: string; [k: string]: unknown };
type RawTask = { id: string; level: string; items: RawItem[]; accepted_answers?: Record<string, string[]>; teacher_key?: unknown; [k: string]: unknown };

async function examTasksFor(level: string) {
  const mod = await import("@/content/course/exam-tasks.json");
  return (mod.default as unknown as RawTask[]).filter((t) => t.level === level);
}
const gradable = (it: RawItem) => it.answer != null && !it.response_type;

async function examGate(supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>, userId: string) {
  const { examUnlocked } = await import("./learning");
  const { data: profile } = await supabase.from("profiles").select("level").eq("id", userId).single();
  const level = (profile?.level ?? "A1") as import("./learning").Level;
  const { data: units } = await supabase.from("units").select("block, level, status, topic").eq("user_id", userId);
  return { level, unlocked: examUnlocked(units ?? [], level) };
}

/** Level exam built from the course's exam-practice tasks (answers never leave the server). */
export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { level, unlocked } = await examGate(context.supabase, context.userId);
    if (!unlocked) return { level, tasks: [] as import("./course").ExamTask[], error: "Aún no has desbloqueado el examen de este nivel." };
    const tasks = (await examTasksFor(level)).map((t) => {
      const { accepted_answers: _a, teacher_key: _k, ...rest } = t;
      const clean = { ...rest, items: t.items.map(({ answer: _x, explanation: _e, ...it }) => ({ ...it, gradable: gradable({ ...it, answer: _x } as RawItem) })) };
      if (clean.segments) delete (clean as Record<string, unknown>).script;
      return clean as unknown as import("./course").ExamTask;
    });
    return { level, tasks, error: null as string | null };
  });

/** Grades the exam on the server, records it and moves the student up a level when passed. */
export const submitExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ answers: z.record(z.string(), z.record(z.string(), z.string().max(500))) }).parse(d))
  .handler(async ({ data, context }) => {
    const { examScore, examPassed, nextLevel, checkCourseAnswer } = await import("./learning");
    const { level, unlocked } = await examGate(context.supabase, context.userId);
    if (!unlocked) return { passed: false, score: 0, newLevel: null, review: {}, error: "Examen no disponible." };
    const review: import("./course").ExamReview = {};
    let correct = 0;
    let total = 0;
    for (const t of await examTasksFor(level)) {
      review[t.id] = {};
      for (const it of t.items) {
        if (!gradable(it)) continue;
        total++;
        const given = data.answers[t.id]?.[String(it.n)] ?? "";
        const ok = checkCourseAnswer(given, it.answer, t.accepted_answers?.[String(it.n)] ?? []);
        if (ok) correct++;
        review[t.id]![String(it.n)] = { correct: ok, answer: String(it.answer), explanation: it.explanation || undefined };
      }
    }
    const score = examScore(correct, total);
    const passed = examPassed(score);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("level_exams").insert({ user_id: context.userId, level, score, passed });
    if (error) return { passed: false, score, newLevel: null, review, error: "No se pudo guardar el resultado." };
    const up = passed ? nextLevel(level) : null;
    if (up) await supabaseAdmin.from("profiles").update({ level: up }).eq("id", context.userId);
    return { passed, score, newLevel: up, review, error: null as string | null };
  });

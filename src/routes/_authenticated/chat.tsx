import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCheck, Lightbulb, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Loading } from "@/components/Page";
import { ListenButton } from "@/components/audio";
import { SaveNoteButton } from "@/components/NotesFab";
import { correctChatMessage } from "@/lib/ai.functions";
import emma from "@/assets/emma.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat con Emma — GoEnglish!" }, { name: "description", content: "Chatea en inglés como en WhatsApp sobre tu día y tu trabajo." }] }),
  component: ChatPage,
});

type Correction = { ok: boolean; corrected: string; note_es: string };
type Row = { message: UIMessage; correction: Correction | null; created_at: string };

const historyQuery = {
  queryKey: ["chat-history"],
  queryFn: async () => {
    const { data, error } = await supabase.from("chat_messages").select("message, correction, created_at").order("created_at").limit(400);
    if (error) throw error;
    return data as unknown as Row[];
  },
  staleTime: Infinity,
};

function ChatPage() {
  const history = useQuery(historyQuery);
  if (history.isLoading) return <Loading label="Abriendo el chat…" />;
  return <ChatWindow rows={history.data ?? []} />;
}

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function ChatWindow({ rows }: { rows: Row[] }) {
  const correct = useServerFn(correctChatMessage);
  const [corrections, setCorrections] = useState<Record<string, Correction>>(() =>
    Object.fromEntries(rows.filter((r) => r.correction).map((r) => [r.message.id, r.correction!])),
  );
  const times = useRef<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.message.id, r.created_at])));
  const { messages, sendMessage, status, stop } = useChat({
    id: "emma",
    messages: rows.map((r) => r.message),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
    }),
    onError: (e) => {
      const msg = e.message || "";
      toast.error(msg.includes("402") ? "Se han agotado los créditos de IA." : msg.includes("429") ? "Demasiados mensajes seguidos, espera un momento." : "Emma no ha podido responder. Inténtalo de nuevo.");
    },
  });
  const busy = status === "submitted" || status === "streaming";
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!busy) boxRef.current?.querySelector("textarea")?.focus();
  }, [busy]);

  async function onSubmit({ text }: { text: string }) {
    const t = text.trim();
    if (!t || busy) return;
    await sendMessage({ text: t });
  }

  // Correct each new user message once it is persisted.
  const asked = useRef(new Set(rows.map((r) => r.message.id)));
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "user" || asked.current.has(m.id)) continue;
      if (status === "submitted") continue;
      asked.current.add(m.id);
      times.current[m.id] ??= new Date().toISOString();
      void correct({ data: { messageId: m.id, text: textOf(m) } }).then((r) => {
        if (!r.error) setCorrections((c) => ({ ...c, [m.id]: r }));
      });
    }
  }, [messages, status, correct]);

  const hour = (id: string) => new Date(times.current[id] ?? Date.now()).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col px-2 pt-2 sm:px-4 sm:pt-4">
      <header className="flex items-center gap-3 rounded-t-3xl bg-navy px-4 py-3 text-navy-foreground">
        <Link to="/home" aria-label="Volver" className="rounded-full p-1 hover:bg-navy-foreground/10"><ArrowLeft className="h-5 w-5" /></Link>
        <img src={emma} alt="Emma" width={44} height={44} className="h-11 w-11 rounded-full bg-card object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">Emma</p>
          <p className="text-xs opacity-75">{busy ? "escribiendo…" : "en línea · tu amiga en inglés"}</p>
        </div>
        <Link to="/speaking" aria-label="Llamar a Emma" className="rounded-full bg-mint p-2.5 text-mint-foreground"><Phone className="h-5 w-5" /></Link>
      </header>

      <Conversation className="flex-1 bg-chat-wall">
        <ConversationContent className="gap-3 px-3 py-4">
          {!messages.length && (
            <div className="mx-auto max-w-sm rounded-2xl bg-sun-soft p-4 text-center text-sm text-navy">
              <p className="font-bold">¡Escríbele a Emma en inglés! 💬</p>
              <p className="mt-1 text-muted-foreground">Cuéntale tu día o algo de tu trabajo. Te corregirá con discreción debajo de cada mensaje.</p>
            </div>
          )}
          {messages.map((m) => {
            const text = textOf(m);
            const c = corrections[m.id];
            const mine = m.role === "user";
            return (
              <Message key={m.id} from={m.role} className="max-w-[85%]">
                <MessageContent
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 shadow-soft",
                    mine ? "group-[.is-user]:rounded-br-sm group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : "rounded-bl-sm bg-card text-card-foreground",
                  )}
                >
                  {mine ? <p className="whitespace-pre-wrap">{text}</p> : <MessageResponse>{text}</MessageResponse>}
                  <span className={cn("flex items-center justify-end gap-1 text-[10px]", mine ? "opacity-80" : "text-muted-foreground")}>
                    {hour(m.id)} {mine && <CheckCheck className="h-3 w-3" />}
                  </span>
                </MessageContent>
                <div className={cn("flex flex-wrap items-center gap-1", mine && "justify-end")}>
                  {!mine && text && <ListenButton text={text} size="sm" />}
                  {text && <SaveNoteButton text={text} source="chat" label="Chat con Emma" />}
                </div>
                {mine && c && !c.ok && (
                  <details className="ml-auto max-w-full rounded-2xl bg-sun-soft px-3 py-2 text-xs text-navy">
                    <summary className="flex cursor-pointer items-center gap-1 font-bold"><Lightbulb className="h-3.5 w-3.5 text-sun-foreground" /> Mejor así…</summary>
                    <p className="mt-1 font-semibold">{c.corrected}</p>
                    {c.note_es && <p className="mt-0.5 text-muted-foreground">{c.note_es}</p>}
                  </details>
                )}
              </Message>
            );
          })}
          {status === "submitted" && (
            <Message from="assistant"><MessageContent className="rounded-2xl rounded-bl-sm bg-card px-3.5 py-2.5"><Shimmer>Emma está escribiendo…</Shimmer></MessageContent></Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div ref={boxRef} className="rounded-b-3xl border-t bg-card p-2">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea placeholder="Escribe en inglés…" autoFocus />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

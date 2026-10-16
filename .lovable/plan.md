# GoEnglish! — Chat, notas, speaking en directo y subida de nivel

## 1. Inicio reordenado
- Primero las tres tarjetas de bloques (Cotidiano, General, Trabajo).
- Debajo, el Repaso inteligente.
- La columna lateral (Continúa + estadísticas) se mantiene, y se añaden accesos a Chat, Speaking y Notas.

## 2. Chat estilo WhatsApp (dentro de la app)
- Una única conversación continua con una persona virtual ("Emma"), guardada en la cuenta del alumno.
- Aspecto tipo WhatsApp: burbujas, hora, "escribiendo…", fondo suave.
- Emma pregunta por su día y por su trabajo (usa la descripción del puesto y el nivel del alumno), adapta el inglés a su nivel.
- Bajo cada mensaje del alumno, una corrección discreta desplegable ("Mejor así: …").
- Botón de escuchar en los mensajes de Emma.
- Botón "Guardar en notas" en cualquier mensaje.

## 3. Speaking en directo (llamada de voz)
- Pantalla de llamada: elegir situación (cafetería, entrevista, reunión de trabajo, médico, contar tu día) y pulsar Llamar.
- Conversación de voz en tiempo real con la IA, que saluda primero y adapta el ritmo al nivel.
- Subtítulos en pantalla y botón Colgar.
- Al terminar: resumen con aciertos, expresiones a mejorar y palabras nuevas (guardables en notas).

## 4. Libreta de notas
- Botón flotante lateral en todas las lecciones, ejercicios, chat y repaso: abre un panel para apuntar algo rápido.
- Cada nota guarda fecha y de dónde viene (unidad, chat, llamada).
- Página "Notas" con buscador, y vista de las últimas notas en Inicio.
- Opción "Convertir en tarjeta de repaso": pasa al repaso inteligente.
- Nueva bolita "Notas" en la barra inferior.

## 5. Subida de nivel con examen
- Cada nivel (A1–C2) tiene un recorrido de unidades troncales en General.
- Al completar las unidades del nivel con buena nota se desbloquea el Examen de nivel (preguntas generadas por IA de lo estudiado).
- Aprobado (70 % o más): sube de nivel y se desbloquea el contenido siguiente en los 3 bloques. Suspenso: se refuerza el repaso y puede repetirlo.
- En Progreso: camino visual del nivel con estaciones y el examen al final.

## Detalles técnicos
- Nuevas tablas con RLS por usuario: `chat_messages` (UIMessage persistido), `notes` (texto, origen, unit_id opcional, fecha), `level_exams` (nivel, puntuación, aprobado).
- Chat: AI SDK + AI Elements, streaming vía server route autenticado, modelo `openai/gpt-6-astra` en Responses; correcciones como parte estructurada.
- Speaking: GPT Live (`openai/gpt-live-1`) con relay en servidor y hook `useLiveVoice`; resumen final con llamada de texto.
- Reglas de examen (umbral 70 %, unidades requeridas, siguiente nivel) en `src/lib/learning.ts` con tests.
- Notas convertidas en tarjeta crean una fila en `learned_items`.
- Reordenar secciones en `home.tsx`; nueva ruta `/notes`, `/chat`, `/speaking`, `/exam/$level`.

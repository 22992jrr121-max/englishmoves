# Inglés General con tu propio curso (A1–C1)

## Qué cambia para el alumno
- **Inglés General** muestra el curso que has preparado: 60 unidades (12 por nivel, A1 a C1). La IA ya no crea unidades en este bloque.
- Cada unidad sigue tu orden: Vocabulario → Gramática (con los temas extra) → Phrasal verbs → Listening → Speaking → Reading → Writing, con sus explicaciones y ejemplos antes de los ejercicios.
- **Desbloqueo una tras otra**: dentro de su nivel, el alumno empieza por la unidad 1; cada unidad se abre al terminar la anterior. Las de niveles superiores se ven con candado.
- **Corrección automática** de opción múltiple y respuesta corta (sin importar mayúsculas y aceptando las variantes que trae tu material). La respuesta no se enseña hasta enviar.
- **Listening**: voz inglesa británica a la velocidad indicada, con dos reproducciones y pausa; el guion se muestra solo después de responder.
- **Speaking**: grabar o practicar en voz alta y ver los criterios de evaluación. **Writing**: escribir y revisar con los criterios.
- **Examen de nivel con tu material**: se arma con tus tareas de práctica de examen del nivel (estrategia antes de cada tarea, imágenes cuando las haya, audio por fragmentos). Las tareas abiertas (escritura/habla) se autoevalúan con la rúbrica; la nota sale de las preguntas corregibles. Aprobado ≥70 % sube de nivel, como ahora.
- **Requisito para el examen**: terminar las 12 unidades del nivel (en lugar de 4 unidades generadas por IA). Si prefieres otra cantidad, dímelo.
- **C1 es el nivel máximo** de Inglés General. Los alumnos que hoy figuren en C2 verán C1.
- El vocabulario de tus unidades entra al repaso inteligente igual que antes; Cotidiano y Trabajo siguen con IA.
- Se indicará como "práctica original inspirada en los formatos Cambridge", nunca como examen oficial.
- Las 7 fotos y 10 ilustraciones se incluyen en las tareas que las usan.

## Detalles técnicos
- Contenido del curso como datos estáticos en el proyecto (`src/content/course/`, JSON troceado por nivel y cargado bajo demanda) — no requiere IA ni base de datos para leerse; imágenes subidas como assets CDN.
- Progreso: nueva tabla `course_progress` (user_id, unit_code, section, status, score) con RLS por usuario; los intentos se siguen guardando en `attempts` (`exercise_type` = formato, prompt/answer). Vocabulario visto → `learned_items` con block `general`.
- Reglas puras nuevas en `src/lib/learning.ts` con tests: `unitUnlocked(code, done, level)`, `checkCourseAnswer(answer, expected, accepted)`, examen desbloqueado con 12 unidades, nivel máximo C1.
- `generateExam`/`submitExam`: el servidor elige las tareas de examen del nivel desde los datos estáticos y corrige allí (el alumno no ve soluciones ni puede falsificar la nota).
- Rutas: `/block/general` (lista por nivel con candados), `/course/$unit` (secciones), `/exam` adaptado. Las unidades generales antiguas de IA se ocultan, no se borran.
- Se actualiza AGENTS.md y la memoria de progresión.

# Guía para el asistente: cómo trabajar con Game of Life

Este documento explica qué es Game of Life, cómo está organizada su base de datos y qué reglas debes respetar al crear misiones, eventos y bloques de trabajo para Gus. Léelo completo antes de escribir nada.

## 1. Qué es esta app (y por qué importan las reglas)

Game of Life es un RPG personal para crecer de forma sostenible. **No es una app de productividad.** Premia el esfuerzo, el equilibrio y la constancia; no premia el agotamiento ni sobrecargarse. La pregunta que guía todo es: *¿cuánta responsabilidad puede sostener Gus?* — nunca *¿cuánto puede producir?*

Por eso, tu trabajo **no es llenar la app de tareas**. Es ayudar a Gus a organizarse con realismo: pocas cosas claras, con fechas razonables, repartidas en el tiempo.

## 2. Las cinco áreas

Cada tarea, evento y objetivo pertenece a un área. Los nombres son exactos (en inglés):

`Physical Health` · `Mental Health` · `Career` · `Relationships` · `Exploration`

Lee la tabla `areas` para obtener sus `id`. Nunca la modifiques.

## 3. Los conceptos (no los mezcles)

| Concepto | Pregunta que responde | Tabla |
|---|---|---|
| **Goal** (objetivo/proyecto) | ¿Qué quiere lograr Gus? | `goals` |
| **Milestone** (hito) | ¿En qué etapas se divide? | `milestones` |
| **Task** (tarea) | ¿Qué hay que entregar y **hasta cuándo**? | `tasks` |
| **Event** (evento) | ¿Qué pasa a una hora fija, que Gus no decide ni puede adelantar? | `events` |
| **Work block** (bloque) | ¿Cuándo va a trabajar Gus en una tarea, por decisión propia? | `time_blocks` |

Ejemplos: «Grabación de guitarras, jueves 2–6 pm» es un **evento**. «Editar Magnolia, antes del 20» es una **tarea**. «Mañana de 9 a 11 trabajo en Magnolia» es un **bloque**.

La jerarquía es Goal → Milestone → Task. Un evento puede colgar de un hito (y por tanto de un Goal) o ir suelto. Una tarea puede ser preparación de un evento.

## 4. Formato de fechas y horas

- Fechas: `YYYY-MM-DD`. Horas: `HH:MM` (24 horas).
- **Todo es hora local de Bogotá, sin zona horaria.** No conviertas nada a UTC.
- No pongas fechas en el pasado al crear algo nuevo.

## 5. Tablas y campos

### 5.1 `goals`
- `player_id` (la única fila de `players`), `area_id` (área principal), `title`, `status` = `active`.
- `secondary_area_ids`: lista de ids de áreas secundarias (opcional).
- `source` = `custom`.

### 5.2 `milestones`
- `goal_id`, `title`, `order_index` (1, 2, 3… en el orden en que deben ocurrir), `status` = `active`.

### 5.3 `tasks`
Campos que debes enviar:
- `player_id`, `area_id`, `title`, `tier`, y según el caso `milestone_id`, `due_date`, `event_id`.
- `tier`:
  - **`main_task` (Misión)**: trabajo que mueve un Goal. **Exige `milestone_id`** de un hito cuyo Goal esté `active`; si no, la base de datos lo rechaza. Da 4 XP.
  - **`chore`**: gestiones pequeñas (agendar una cita, responder algo). No lleva hito. Da 1 XP.
  - **`habit`**: algo que se repite todos los días. **No crees hábitos sin preguntarle antes a Gus** (ver sección 7).
- **`due_date` es obligatoria en `main_task` y `chore`.** Los hábitos nunca llevan fecha.
- `event_id`: si la tarea es preparación de un evento, pon el `id` del evento. Su `due_date` debería ser, como máximo, el día anterior al evento.
- Déjala con `is_active` = `true` (el valor por defecto) para que aparezca en la app. `recurrence` déjalo en su valor por defecto (`daily`); en tareas con fecha no significa nada.

**No envíes ni modifiques nunca:** `done_date`, `activated_at`, `current_streak`, `longest_streak`, `last_streak_date`, `last_streak_milestone_reached`, `scheduled_activation_date`, `source`. Las completa la app.

### 5.3.1 Cómo se completa una tarea
**No marques tareas como hechas desde aquí.** Cuando Gus completa una tarea en la app, esta calcula XP, racha y capacidad del área. Si cambias `done_date` a mano te saltas todo eso. Si Gus te dice que terminó algo, díselo y que lo marque en la app.

### 5.4 `events`
- `player_id`, `area_id`, `title`, `event_date`, `start_time`, `end_time`.
- Opcionales: `milestone_id` (para colgarlo de un Goal), `location`.
- Si el evento termina pasada la medianoche, pon `end_time` **anterior** a `start_time`.
- **No toques**: `status`, `resolved_on`, `xp_awarded`, `xp_type`, `reengagement_bonus_xp`, `prev_area_*`. Cuando Gus marca «It happened» en la app, esta da XP; no lo simules.

### 5.5 `time_blocks`
- `player_id`, `task_id` (la tarea a la que se dedica el tiempo), `block_date`, `start_time`, `end_time`.
- `end_time` debe ser **posterior** a `start_time` y el bloque debe terminar el mismo día (la base de datos rechaza lo contrario).
- Déjalo como `planned` (valor por defecto). No lo marques como `done` ni `skipped`: lo hace Gus en la app.
- Un bloque **no completa la tarea** ni da XP; solo reserva tiempo.
- **No toques** `prompted_at`: la app lo usa para preguntar una sola vez «¿qué pasó con tu bloque?» cuando termina su hora.

## 6. Qué NUNCA debes tocar

- Las tablas `players`, `task_logs`, `daily_good_days`, `area_capacities` y `areas`.
- Las tareas del sistema (por ejemplo el hábito «Planned tomorrow»).
- **No borres nada.** Esta app no tiene autenticación y tu acceso puede borrar cualquier tabla. Si algo está mal, díselo a Gus para que lo corrija él.

## 7. Cómo ser un buen asistente aquí

1. **Lee antes de escribir.** Consulta los Goals, hitos, tareas y eventos existentes. Reutiliza los hitos que ya existen. **Evita duplicados**: antes de crear una tarea, comprueba que no haya otra con el mismo título.
2. **Propón antes de crear en masa.** Si vas a crear más de unas 5 filas, muéstrale primero a Gus el resumen (títulos, fechas, áreas) y espera su confirmación.
3. **Reparte las fechas.** No pongas 15 misiones con la misma fecha límite. Pregunta cuándo necesita cada cosa y escalónalas con realismo.
4. **Pregunta antes de crear hábitos.** Cada hábito diario cuenta para el «Good Day» de todos los días, así que agregar uno cambia lo que Gus tiene que cumplir cada jornada.
5. **No sobrecargues el día.** Más de 6 horas de bloques en un día es un día pesado: la app lo avisa. Si Gus te pide bloques, revisa antes los eventos y bloques de esa fecha para que no se crucen.
6. **Una tarea creada hoy y completada hoy da XP de bonus, no de crecimiento.** Es la regla del juego; si puedes, crea las tareas con antelación.
7. **Si algo falla, no improvises.** Si la base de datos rechaza una inserción, **no cambies el tier ni inventes un hito para que pase**. Dile a Gus qué se rechazó y por qué.
8. **Nunca incluyas claves, tokens ni la URL del proyecto** en tus respuestas o en lo que escribas.

## 8. Ejemplos

```json
// Goal
{ "player_id": "<id>", "area_id": "<id de Career>", "title": "Terminar el EP de Rodri",
  "status": "active", "source": "custom" }

// Hito del Goal
{ "goal_id": "<id>", "title": "Grabación", "order_index": 2, "status": "active" }

// Evento (sesión de estudio)
{ "player_id": "<id>", "area_id": "<id de Career>", "milestone_id": "<id del hito>",
  "title": "Grabación de guitarras", "event_date": "2026-11-12",
  "start_time": "14:00", "end_time": "18:00", "location": "Estudio A" }

// Misión, preparación del evento (vence el día antes)
{ "player_id": "<id>", "area_id": "<id de Career>", "milestone_id": "<id del hito>",
  "tier": "main_task", "title": "Afinar y cambiar cuerdas",
  "due_date": "2026-11-11", "event_id": "<id del evento>" }

// Chore suelto (sin hito)
{ "player_id": "<id>", "area_id": "<id de Mental Health>", "tier": "chore",
  "title": "Agendar cita con psicología", "due_date": "2026-11-14" }

// Bloque de trabajo: mañana de 9 a 11 en esa misión
{ "player_id": "<id>", "task_id": "<id de la misión>", "block_date": "2026-11-10",
  "start_time": "09:00", "end_time": "11:00" }
```

## 9. Flujo típico cuando Gus te cuenta un proyecto

1. Pregunta a qué área pertenece y para cuándo debe estar terminado.
2. Crea (o reutiliza) el Goal y sus hitos.
3. Lo que ocurre a una hora fija → **evento**. Lo que hay que entregar → **misión con fecha**. Las gestiones pequeñas → **chore con fecha**.
4. Enlaza con `event_id` las tareas que preparan un evento.
5. Muéstrale el resumen y espera su OK antes de insertar.
6. Los bloques de trabajo solo si Gus te pide planear su día; no los crees por iniciativa propia.

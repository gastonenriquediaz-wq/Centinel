# Registro de Mejoras, Adaptaciones y Evolución Funcional — Proyecto Centinel (Tesis UCASAL)

**Autor:** Gastón Enrique Díaz  
**Proyecto:** Centinel — Canal de Comunicación, Prevención y Gestión de Convivencia Escolar  

Este documento conserva la trazabilidad de todas las **funcionalidades agregadas, mejoras de experiencia de usuario (UX), reglas de integridad institucional y simplificaciones operativas** implementadas en la aplicación móvil que amplían o refinan el planteamiento original escrito en la tesis.

---

## 1. Adaptaciones y Mejoras en el Flujo de Casos y Actuaciones

### 1.1. Simplificación de Estados del Caso y Transición Automática
* **Cambio respecto a la tesis:** Se eliminó el botón manual de "Cambiar estado" dentro del expediente para evitar inconsistencias administrativas.
* **Regla implementada:**
  1. Todo caso nuevo nace en estado **`Abierto`** (`open`).
  2. Al momento en que una autoridad escolar registra la **primera Actuación Institucional**, el caso pasa automáticamente al estado **`En seguimiento`** (`under_investigation`).
  3. Cuando se labra el cierre con los acuerdos y conclusiones, el caso pasa a **`Finalizado`** (`resolved`).

### 1.2. Evolución de "Acta Digital" a "Actuación Institucional"
* **Justificación:** Se adoptó la denominación **"Registrar Actuación Institucional"** (y *"Actuaciones y seguimiento"* dentro del expediente) para abarcar con precisión pedagógica y legal todas las intervenciones de la escuela: entrevistas con alumnos, citaciones a familias, intervenciones de gabinete, derivaciones y medidas de convivencia.

### 1.3. Gestión Estructurada de Intervinientes y Cargos Temporales
* **Mejora implementada:** En la pantalla de *Registrar Actuación Institucional* (`app/(authority)/cases/[id]/acts/new.tsx`):
  * Se ofrecen sugerencias rápidas con los estudiantes ya vinculados al caso.
  * Se reemplazó el texto de *"Gabinete / EOE"* por **"Gabinete"**.
  * Se incorporó un botón **`+`** a la derecha de *"Incorporar interviniente:"* que despliega una ventana emergente para crear un **cargo o rol personalizado temporal** (por ejemplo: *"Psicólogo"*, *"Asesor Pedagógico"*, *"Mediador"*).
  * **Carácter temporal:** Dicho rol queda disponible únicamente durante la carga de esa actuación puntual y no queda guardado de forma permanente para futuras actuaciones.

### 1.4. Vista Detallada de Actuación Labrada
* **Mejora implementada (`app/(authority)/cases/[id]/acts/[actId].tsx`):** Al hacer clic sobre cualquier actuación registrada dentro del *Expediente de Caso*, se abre una pantalla dedicada con el documento completo (tipo de actuación, fecha y hora exacta, listado estructurado de participantes, relato/desarrollo completo, acuerdos alcanzados, próximas acciones y firma digital de la autoridad que la labró).

### 1.5. Incorporación Manual de Estudiantes e Historial de Operaciones (`audit_log`)
* **Incorporación manual:** Si el reporte inicial no especificaba al estudiante señalado por la agresión o a otros alumnos afectados/testigos, la autoridad puede incorporarlos manualmente desde el expediente del caso.
* **Historial de Operaciones (`app/(authority)/cases/[id]/history.tsx`):** Pantalla de auditoría cronológica inmutable que registra quién creó el caso, los cambios de estado, la incorporación manual de alumnos, las actuaciones labradas y el cierre del expediente.

---

## 2. Mejoras en Registro, Seguridad y Validación de Estudiantes

### 2.1. Códigos QR y Códigos Alfanuméricos de 10 Caracteres (Base32)
* Además del escaneo de código QR por cámara, la autoridad puede generar un código alfanumérico de 10 caracteres criptográficamente seguro (sin caracteres ambiguos como `0/O` o `1/I`), con vigencia estricta de **5 minutos** y protección contra fuerza bruta (**bloqueo temporal de 60 segundos tras 5 intentos fallidos**).

### 2.2. Detección Estricta de Duplicados (DNI y Correo Electrónico)
* Si un estudiante intenta registrarse con un **DNI** o un **Correo electrónico** que ya pertenece a otro usuario de la aplicación, el sistema bloquea el alta y muestra una alerta clara indicando exactamente el motivo (*DNI ya en uso* o *Correo electrónico ya en uso*).

### 2.3. Avisos Claros de Estado de Cuenta al Iniciar Sesión (`app/(auth)/login.tsx`)
* **Cuenta Pendiente:** Si el estudiante completó el registro pero la autoridad aún no lo aprobó, al intentar iniciar sesión se le informa mediante alerta y banner que debe aguardar la confirmación de una autoridad escolar.
* **Cuenta Suspendida:** Si la autoridad suspendió preventivamente al alumno, el login le impide el acceso informándole que debe acercarse a Preceptoría o Dirección.

### 2.4. Selector Táctil y Gestual de Fecha de Nacimiento (`app/(auth)/register.tsx`)
* **Cambio UX:** Se eliminó el ingreso por teclado manual en Día y Año (que generaba confusión con los textos de ejemplo/placeholders).
* **Implementación:**
  * **Día:** Inicia en **`00`**. Permite deslizar el dedo hacia abajo para subir de forma ascendente (`1, 2, 3... 31`) y hacia arriba para descender, además de contar con botones de flecha superior e inferior. Ajusta automáticamente el límite máximo según el mes y años bisiestos.
  * **Mes:** Cuadrícula directa de los 12 meses (`Ene` a `Dic`).
  * **Año:** Inicia en **`2000`**. Soporta el mismo desplazamiento gestual con el dedo y botones de flecha, validando que la persona no supere los 100 años de edad ni seleccione años futuros.

---

## 3. Gestión de Cursos y Nómina de Estudiantes por Curso

### 3.1. Buscador y Filtro por Turno en Cursos Institucionales (`app/(authority)/courses/index.tsx`)
* Incorporación de barra de búsqueda en tiempo real (por año, división, turno o ciclo lectivo) y chips de filtrado rápido por turno (`Todos`, `Mañana`, `Tarde`, `Noche`, `Jornada Completa`).

### 3.2. Nueva Pantalla de Estudiantes Registrados por Curso (`app/(authority)/courses/[id]/students.tsx`)
* Al hacer clic sobre un curso (ej. *3° "A"*), se abre una pantalla dedicada que lista todos los alumnos matriculados en esa división, con contadores por estado (`Total`, `Activos`, `Suspendidos`, `Pendientes`) y buscador por nombre o DNI.
* **Acciones de control escolar:**
  1. **Suspender cuenta:** Permite inhabilitar temporalmente el ingreso de un alumno que haga mal uso de la plataforma, solicitando el motivo institucional y dejándolo asentado en `audit_log`.
  2. **Reactivar cuenta:** Restablece el acceso del estudiante de forma inmediata cuando la situación fue abordada.
  3. **Eliminar usuario (con validación estricta de no pérdida de información):** Antes de permitir eliminar a un estudiante (ej. alguien que se registró por error o no pertenece al curso), el sistema verifica automáticamente en base de datos que **NO haya emitido reportes, NO tenga mensajes en canales de comunicación y NO figure involucrado en ningún expediente de caso**. Si registra actividad previa, prohíbe el borrado físico para resguardar la evidencia institucional y sugiere utilizar la suspensión.

---

## 4. Nuevos Módulos de Valor Agregado Institucional (Plan de 4 Puntos)

### Punto 1 — Panel de Estadísticas y Métricas de Convivencia Escolar (`app/(authority)/statistics/index.tsx`) — [IMPLEMENTADO]
* **Objetivo:** Transformar los datos operativos en información estratégica para la toma de decisiones pedagógicas y preventivas por parte de la Dirección.
* **Funcionalidades incluidas:**
  * Filtro dinámico de métricas por **Turno** (`Todos`, `Mañana`, `Tarde`, `Noche`, `Jornada Completa`).
  * **Tarjetas KPI:** Total de reportes, Tasa de atención institucional (`%`), Expedientes de caso activos y Tasa de resolución de casos (`%`).
  * **Síntesis Diagnóstica Automática:** Resumen ejecutivo generado automáticamente que destaca la tipología predominante, el espacio físico/virtual más crítico y el curso con mayor demanda de intervención.
  * **Gráfico de Incidencia por Tipo de Situación:** Barras de progreso con cantidades y porcentajes (*Agresión física*, *Burlas/insultos*, *Ciberacoso*, *Exclusión social*, *Amenazas*, *Daño/robo*).
  * **Ranking de Lugares de Mayor Ocurrencia:** (*Patio/recreo*, *Aula*, *Redes sociales*, *Baños*, *Entrada/salida*, *Cerca del colegio*).
  * **Indicador de Frecuencia y Persistencia Temporal:** Destaca el porcentaje de **alta recurrencia** (hechos que ocurren frecuentemente o casi todos los días) frente a hechos aislados.
  * **Ranking de Incidencia por Curso y División:** Lista ordenada de cursos según volumen de reportes con acceso directo a la nómina del curso.

### Punto 2 — Vista de Acta Imprimible / Exportable (Protocolo físico con firmas) — [IMPLEMENTADO]
* **Objetivo:** Articular el registro digital de las actuaciones escolares con el requisito legal/administrativo de contar con constancias físicas firmadas de puño y letra por padres, tutores, estudiantes y directivos (Ley Nacional N° 26.892).
* **Funcionalidades incluidas:**
  * **Selector de modo en Detalle de Actuación (`app/(authority)/cases/[id]/acts/[actId].tsx`):** Permite alternar con un toque entre **"Vista Digital"** y **"Protocolo con Firmas"**.
  * **Hoja de Protocolo Oficial:** Renderiza el documento con formato de acta administrativa escolar (membrete de la institución, leyenda de Ley N° 26.892, datos de expediente y folio, cláusula formal de apertura, cuerpo de la actuación, cláusula de cierre y conformidad).
  * **Recuadros Individuales de Firma Ológrafa:** Genera automáticamente un recuadro de firma punteado para cada interviniente registrado en la actuación (con líneas para *Firma*, *Aclaración*, *Rol/Vínculo* y *DNI*), más el recuadro de *Sello de la Institución y Firma de Dirección*.
  * **Exportación / Impresión de Acta Individual y de Expediente Completo (`app/(authority)/cases/[id]/index.tsx`):** Botón para compartir/exportar o imprimir tanto un acta puntual como el **Expediente Institucional Completo** (con reporte de origen, estudiantes involucrados, todas las actuaciones labradas y resolución final).

### Punto 3 — Retroalimentación Institucional para el Estudiante — [PENDIENTE DE IMPLEMENTACIÓN]
* Indicador claro y tranquilizador en el detalle del reporte del alumno para que sepa que su comunicación está siendo atendida por el equipo directivo y que se activaron los protocolos de convivencia, resguardando la confidencialidad de las actuaciones internas.

### Punto 4 — Filtro por Curso en la Bandeja de Reportes Recibidos — [PENDIENTE DE IMPLEMENTACIÓN]
* Incorporación de selector de curso en la bandeja de reportes de la autoridad para filtrar rápidamente las comunicaciones de una división específica (ej. *3° "A"*).

-- ==============================================================================
-- CENTINEL - MIGRACIÓN 06: ACTUALIZACIÓN DE TEXTOS Y REDACCIÓN SIMPLIFICADA
-- ==============================================================================

-- 1. Actualizar tipo de situación en reportes existentes
UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Ciberacoso / Difamación digital', 'Acoso o agresiones por internet')
WHERE situation_type LIKE '%Ciberacoso / Difamación digital%';

UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Hostigamiento verbal / insultos', 'Burlas, insultos o humillaciones')
WHERE situation_type LIKE '%Hostigamiento verbal / insultos%';

UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Amenazas o coacción', 'Amenazas o intimidación')
WHERE situation_type LIKE '%Amenazas o coacción%';

UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Daño a pertenencias materiales', 'Daño o robo de pertenencias')
WHERE situation_type LIKE '%Daño a pertenencias materiales%';

UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Otro tipo de situación', 'Otra situación')
WHERE situation_type LIKE '%Otro tipo de situación%';

UPDATE public.reports
SET situation_type = REPLACE(situation_type, 'Agresión física', 'Agresión física (golpes, empujones)')
WHERE situation_type LIKE '%Agresión física%'
  AND situation_type NOT LIKE '%Agresión física (golpes, empujones)%';

-- 2. Actualizar ubicaciones en reportes existentes
UPDATE public.reports
SET location = REPLACE(location, 'Patio / Recreo', 'Patio o recreo')
WHERE location LIKE '%Patio / Recreo%';

UPDATE public.reports
SET location = REPLACE(location, 'Entrada / Salidas del colegio', 'Entrada o salida del colegio')
WHERE location LIKE '%Entrada / Salidas del colegio%';

UPDATE public.reports
SET location = REPLACE(location, 'Entrada / Salida del colegio', 'Entrada o salida del colegio')
WHERE location LIKE '%Entrada / Salida del colegio%';

UPDATE public.reports
SET location = REPLACE(location, 'En las inmediaciones del colegio', 'Cerca del colegio')
WHERE location LIKE '%En las inmediaciones del colegio%';

UPDATE public.reports
SET location = REPLACE(location, 'Redes sociales / Mensajería digital', 'Internet, redes sociales o mensajes')
WHERE location LIKE '%Redes sociales / Mensajería digital%';

UPDATE public.reports
SET location = REPLACE(location, 'Redes sociales / Mensajeria digital', 'Internet, redes sociales o mensajes')
WHERE location LIKE '%Redes sociales / Mensajeria digital%';

-- 3. Actualizar frecuencia en reportes existentes
UPDATE public.reports
SET frequency = 'Ocurrió varias veces'
WHERE frequency = 'Ocurre de forma ocasional';

UPDATE public.reports
SET frequency = 'Ocurre frecuentemente'
WHERE frequency = 'Ocurre frecuentemente (semanal)';

UPDATE public.reports
SET frequency = 'Ocurre todos o casi todos los días'
WHERE frequency = 'Ocurre de forma continua / diaria';

-- 4. Actualizar títulos de casos existentes
UPDATE public.cases
SET title = REPLACE(title, 'Ciberacoso / Difamación digital', 'Acoso o agresiones por internet')
WHERE title LIKE '%Ciberacoso / Difamación digital%';

UPDATE public.cases
SET title = REPLACE(title, 'Hostigamiento verbal / insultos', 'Burlas, insultos o humillaciones')
WHERE title LIKE '%Hostigamiento verbal / insultos%';

UPDATE public.cases
SET title = REPLACE(title, 'Amenazas o coacción', 'Amenazas o intimidación')
WHERE title LIKE '%Amenazas o coacción%';

UPDATE public.cases
SET title = REPLACE(title, 'Daño a pertenencias materiales', 'Daño o robo de pertenencias')
WHERE title LIKE '%Daño a pertenencias materiales%';

UPDATE public.cases
SET title = REPLACE(title, 'Otro tipo de situación', 'Otra situación')
WHERE title LIKE '%Otro tipo de situación%';

UPDATE public.cases
SET title = REPLACE(title, 'Agresión física', 'Agresión física (golpes, empujones)')
WHERE title LIKE '%Agresión física%'
  AND title NOT LIKE '%Agresión física (golpes, empujones)%';

-- 5. Notificar recarga de schema cache
NOTIFY pgrst, 'reload schema';

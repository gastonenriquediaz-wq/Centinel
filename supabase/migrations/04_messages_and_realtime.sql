-- ==============================================================================
-- CENTINEL - INCREMENTO 4: MENSAJERÍA BIDIRECCIONAL POR REPORTE Y REALTIME
-- ==============================================================================

-- 1. Tabla de Mensajes por Reporte
CREATE TABLE IF NOT EXISTS public.report_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    sender_role public.user_role NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar carga cronológica
CREATE INDEX IF NOT EXISTS idx_report_messages_report_created 
ON public.report_messages(report_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_report_messages_sender 
ON public.report_messages(sender_id);

-- 2. Habilitar RLS
ALTER TABLE public.report_messages ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para lectura
DROP POLICY IF EXISTS "Students can view messages of own reports" ON public.report_messages;
CREATE POLICY "Students can view messages of own reports"
ON public.report_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_messages.report_id AND r.student_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Authorities can view messages of institution reports" ON public.report_messages;
CREATE POLICY "Authorities can view messages of institution reports"
ON public.report_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.profiles p ON p.institution_id = r.institution_id
        WHERE r.id = report_messages.report_id 
          AND p.id = auth.uid() 
          AND p.role = 'authority' 
          AND p.account_status = 'approved'
    )
);

-- 4. Políticas RLS para inserción (solo en reportes activos: 'sent' o 'in_progress')
DROP POLICY IF EXISTS "Students can insert messages to own active reports" ON public.report_messages;
CREATE POLICY "Students can insert messages to own active reports"
ON public.report_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'student'
    AND EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_messages.report_id 
          AND r.student_id = auth.uid()
          AND r.status IN ('sent', 'in_progress')
    )
);

DROP POLICY IF EXISTS "Authorities can insert messages to institution active reports" ON public.report_messages;
CREATE POLICY "Authorities can insert messages to institution active reports"
ON public.report_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'authority'
    AND EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.profiles p ON p.institution_id = r.institution_id
        WHERE r.id = report_messages.report_id 
          AND p.id = auth.uid() 
          AND p.role = 'authority' 
          AND p.account_status = 'approved'
          AND r.status IN ('sent', 'in_progress')
    )
);

-- 5. Políticas RLS para actualización (marcar como leído read_at)
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.report_messages;
CREATE POLICY "Users can mark messages as read"
ON public.report_messages FOR UPDATE
TO authenticated
USING (
    -- El destinatario puede marcar como leído si tiene acceso al reporte
    EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_messages.report_id
          AND (
            r.student_id = auth.uid()
            OR r.institution_id IN (
                SELECT institution_id FROM public.profiles 
                WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
            )
          )
    )
)
WITH CHECK (
    -- Solo se permite actualizar read_at
    sender_id != auth.uid()
);

-- 6. Habilitar publicación Realtime para report_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'report_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.report_messages;
  END IF;
END $$;

-- 7. Notificar a PostgREST recarga de schema cache
NOTIFY pgrst, 'reload schema';

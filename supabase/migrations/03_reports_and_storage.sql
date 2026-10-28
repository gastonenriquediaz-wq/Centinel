-- ==============================================================================
-- CENTINEL - INCREMENTO 3: REPORTES, ARCHIVOS ADJUNTOS Y AUDITORÍA (CORREGIDO)
-- ==============================================================================

-- 1. Tipos Enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE public.report_status AS ENUM ('sent', 'in_progress', 'closed_no_case', 'finalized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_type') THEN
    CREATE TYPE public.attachment_type AS ENUM ('image', 'video');
  END IF;
END $$;

-- 2. Tabla de Reportes
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    situation_type TEXT NOT NULL,
    location TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    frequency TEXT NOT NULL,
    involved_persons TEXT NOT NULL,
    description TEXT NOT NULL,
    status public.report_status NOT NULL DEFAULT 'sent',
    close_reason TEXT,
    case_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_institution_id ON public.reports(institution_id);
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON public.reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 3. Tabla de Archivos Adjuntos Multimedia
CREATE TABLE IF NOT EXISTS public.report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_type public.attachment_type NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    original_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_attachments_report_id ON public.report_attachments(report_id);

-- 4. Tabla de Auditoría General (Audit Log)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_institution_id ON public.audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

-- 5. Habilitar RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para Reportes (usando account_status = 'approved' en profiles)
DROP POLICY IF EXISTS "Students can view own reports" ON public.reports;
CREATE POLICY "Students can view own reports"
ON public.reports FOR SELECT
TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can insert own reports" ON public.reports;
CREATE POLICY "Students can insert own reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (
    student_id = auth.uid()
    AND institution_id IN (
        SELECT institution_id FROM public.profiles WHERE id = auth.uid() AND role = 'student'
    )
);

DROP POLICY IF EXISTS "Authorities can view institution reports" ON public.reports;
CREATE POLICY "Authorities can view institution reports"
ON public.reports FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Authorities can update report status" ON public.reports;
CREATE POLICY "Authorities can update report status"
ON public.reports FOR UPDATE
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
)
WITH CHECK (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

-- 7. Políticas RLS para Adjuntos
DROP POLICY IF EXISTS "Students can view attachments of own reports" ON public.report_attachments;
CREATE POLICY "Students can view attachments of own reports"
ON public.report_attachments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_attachments.report_id AND r.student_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Students can insert attachments to own reports" ON public.report_attachments;
CREATE POLICY "Students can insert attachments to own reports"
ON public.report_attachments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = report_attachments.report_id AND r.student_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Authorities can view attachments of institution reports" ON public.report_attachments;
CREATE POLICY "Authorities can view attachments of institution reports"
ON public.report_attachments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.profiles p ON p.institution_id = r.institution_id
        WHERE r.id = report_attachments.report_id 
          AND p.id = auth.uid() 
          AND p.role = 'authority' 
          AND p.account_status = 'approved'
    )
);

-- 8. Políticas RLS para Auditoría
DROP POLICY IF EXISTS "Authorities can view institution audit log" ON public.audit_log;
CREATE POLICY "Authorities can view institution audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid());

-- 9. Función RPC para primera lectura
CREATE OR REPLACE FUNCTION public.log_report_first_opened(p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_institution_id UUID;
    v_user_role public.user_role;
    v_already_opened BOOLEAN;
BEGIN
    SELECT role, institution_id INTO v_user_role, v_institution_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_role != 'authority' THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.audit_log
        WHERE entity_type = 'report' AND entity_id = p_report_id AND action = 'first_opened'
    ) INTO v_already_opened;

    IF NOT v_already_opened THEN
        INSERT INTO public.audit_log (
            institution_id,
            entity_type,
            entity_id,
            action,
            performed_by,
            details
        ) VALUES (
            v_institution_id,
            'report',
            p_report_id,
            'first_opened',
            auth.uid(),
            jsonb_build_object('timestamp', now())
        );
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Notificar recarga de schema cache a PostgREST
NOTIFY pgrst, 'reload schema';

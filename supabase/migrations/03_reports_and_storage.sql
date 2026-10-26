-- ==============================================================================
-- CENTINEL - INCREMENTO 3: REPORTES, ARCHIVOS ADJUNTOS Y AUDITORÍA
-- ==============================================================================

-- 1. Enums para estados de reporte y tipos de archivo
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
    case_id UUID, -- Se relacionará formalmente con la tabla cases en el Incremento 5
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar búsquedas y listados
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
    entity_type TEXT NOT NULL, -- e.g., 'report', 'case'
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,      -- e.g., 'created', 'status_changed', 'first_opened'
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_institution_id ON public.audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

-- 5. Configuración de Storage Bucket (report-attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-attachments',
    'report-attachments',
    false,
    41943040, -- 40MB max por archivo individual (video)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 41943040,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

-- 6. Habilitar RLS en las nuevas tablas
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para Reportes
-- Estudiantes: Sólo pueden ver sus propios reportes
DROP POLICY IF EXISTS "Students can view own reports" ON public.reports;
CREATE POLICY "Students can view own reports"
ON public.reports FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
);

-- Estudiantes: Pueden crear reportes con su propio ID y su institución
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

-- Autoridades: Pueden ver todos los reportes de su institución
DROP POLICY IF EXISTS "Authorities can view institution reports" ON public.reports;
CREATE POLICY "Authorities can view institution reports"
ON public.reports FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND status = 'active'
    )
);

-- Autoridades: Pueden actualizar el estado y razón de cierre de reportes de su institución
DROP POLICY IF EXISTS "Authorities can update report status" ON public.reports;
CREATE POLICY "Authorities can update report status"
ON public.reports FOR UPDATE
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND status = 'active'
    )
)
WITH CHECK (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND status = 'active'
    )
);

-- 8. Políticas RLS para Adjuntos (report_attachments)
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
          AND p.status = 'active'
    )
);

-- 9. Políticas RLS para Auditoría (audit_log)
DROP POLICY IF EXISTS "Authorities can view institution audit log" ON public.audit_log;
CREATE POLICY "Authorities can view institution audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND status = 'active'
    )
);

DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (
    performed_by = auth.uid()
);

-- 10. Políticas de Storage en storage.objects
DROP POLICY IF EXISTS "Allow authenticated upload to report-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated upload to report-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'report-attachments'
);

DROP POLICY IF EXISTS "Allow read access to report-attachments" ON storage.objects;
CREATE POLICY "Allow read access to report-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'report-attachments'
);

-- 11. Función RPC para registrar primera lectura por autoridad
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

    -- Verificar si ya fue registrado el evento first_opened por alguna autoridad
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

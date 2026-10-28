-- ==============================================================================
-- CENTINEL - INCREMENTO 5: CASOS, ACTAS DIGITALES Y PROTOCOLO DE ACTUACIÓN
-- ==============================================================================

-- 1. Enums para estados de caso y tipos de acta
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status') THEN
    CREATE TYPE public.case_status AS ENUM ('open', 'under_investigation', 'resolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'act_type') THEN
    CREATE TYPE public.act_type AS ENUM (
      'interview_student',
      'interview_parents',
      'mediation',
      'psychological_referral',
      'disciplinary_measure',
      'closure_agreement'
    );
  END IF;
END $$;

-- 2. Tabla de Casos Formales
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    report_id UUID UNIQUE NOT NULL REFERENCES public.reports(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    protocol_level TEXT NOT NULL, -- e.g., 'Leve', 'Moderado', 'Grave'
    status public.case_status NOT NULL DEFAULT 'open',
    resolution_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_institution_id ON public.cases(institution_id);
CREATE INDEX IF NOT EXISTS idx_cases_report_id ON public.cases(report_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);

-- 3. Tabla de Actas Digitales de Actuación
CREATE TABLE IF NOT EXISTS public.case_acts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    act_type public.act_type NOT NULL,
    title TEXT NOT NULL,
    participants TEXT NOT NULL,
    content TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_acts_case_id ON public.case_acts(case_id);
CREATE INDEX IF NOT EXISTS idx_case_acts_occurred_at ON public.case_acts(occurred_at DESC);

-- 4. Asegurar la relación de clave foránea en reports.case_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_reports_case'
  ) THEN
    ALTER TABLE public.reports 
    ADD CONSTRAINT fk_reports_case 
    FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Habilitar RLS en las nuevas tablas
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_acts ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para Casos (Autoridades)
DROP POLICY IF EXISTS "Authorities can view institution cases" ON public.cases;
CREATE POLICY "Authorities can view institution cases"
ON public.cases FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Authorities can insert institution cases" ON public.cases;
CREATE POLICY "Authorities can insert institution cases"
ON public.cases FOR INSERT
TO authenticated
WITH CHECK (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Authorities can update institution cases" ON public.cases;
CREATE POLICY "Authorities can update institution cases"
ON public.cases FOR UPDATE
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

-- Estudiantes: Pueden ver los datos generales del caso vinculado a su reporte
DROP POLICY IF EXISTS "Students can view own case metadata" ON public.cases;
CREATE POLICY "Students can view own case metadata"
ON public.cases FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.id = cases.report_id AND r.student_id = auth.uid()
    )
);

-- 7. Políticas RLS para Actas Digitales (Exclusivas de Autoridad)
DROP POLICY IF EXISTS "Authorities can view institution case acts" ON public.case_acts;
CREATE POLICY "Authorities can view institution case acts"
ON public.case_acts FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

DROP POLICY IF EXISTS "Authorities can insert institution case acts" ON public.case_acts;
CREATE POLICY "Authorities can insert institution case acts"
ON public.case_acts FOR INSERT
TO authenticated
WITH CHECK (
    institution_id IN (
        SELECT institution_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'authority' AND account_status = 'approved'
    )
);

-- 8. Notificar a PostgREST recarga de schema cache
NOTIFY pgrst, 'reload schema';

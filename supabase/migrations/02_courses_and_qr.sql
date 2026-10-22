-- Centinel - Migración 02: Cursos, Códigos QR y Registro de Estudiantes
-- Proyecto de Grado - Universidad Católica de Salta

-- 1. TABLA COURSES (Cursos asociados a una institución)
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL CHECK (year BETWEEN 1 AND 7),             -- 1° a 6°/7° año
  division text NOT NULL,                                     -- Ej: "A", "B", "1ra", "2da"
  shift text NOT NULL CHECK (shift IN ('Mañana', 'Tarde', 'Noche', 'Jornada Completa')),
  school_year int NOT NULL CHECK (school_year >= 2024),       -- Ciclo lectivo (ej: 2026)
  estimated_students int DEFAULT 30 CHECK (estimated_students > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(institution_id, year, division, shift, school_year)
);

CREATE INDEX IF NOT EXISTS idx_courses_institution_id ON public.courses(institution_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 2. VINCULAR COURSE_ID EN PROFILES
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;
    CREATE INDEX idx_profiles_course_id ON public.profiles(course_id);
  END IF;
END $$;

-- 3. TABLA QR_CODES (Códigos grupales temporales de 5 minutos)
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code_token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_token ON public.qr_codes(code_token);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON public.qr_codes(expires_at);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS EN COURSES
-- Autoridades aprobadas pueden ver, crear y actualizar cursos de su institución
CREATE POLICY "Autoridades gestionan cursos de su institucion"
  ON public.courses
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  );

-- Estudiantes autenticados pueden ver su propio curso
CREATE POLICY "Estudiantes pueden ver su curso"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT course_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. POLÍTICAS RLS EN QR_CODES
-- Solo autoridades de la institución pueden crear y consultar QRs generados
CREATE POLICY "Autoridades gestionan QR de su institucion"
  ON public.qr_codes
  FOR ALL
  TO authenticated
  USING (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  );

-- 6. FUNCIONES RPC PARA VALIDACIÓN Y REGISTRO ATÓMICO (SECURITY DEFINER)

-- Función 6.1: Validar si un token QR es válido y vigente (< 5 minutos)
CREATE OR REPLACE FUNCTION public.validate_qr_token(p_token uuid)
RETURNS jsonb AS $$
DECLARE
  v_qr RECORD;
  v_result jsonb;
BEGIN
  SELECT 
    q.id,
    q.code_token,
    q.expires_at,
    q.course_id,
    q.institution_id,
    c.year,
    c.division,
    c.shift,
    c.school_year,
    i.name as institution_name
  INTO v_qr
  FROM public.qr_codes q
  JOIN public.courses c ON c.id = q.course_id
  JOIN public.institutions i ON i.id = q.institution_id
  WHERE q.code_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código QR inválido o no reconocido.');
  END IF;

  IF now() > v_qr.expires_at THEN
    RETURN jsonb_build_object('valid', false, 'error', 'El código QR ha expirado. Solicitá a la autoridad uno nuevo.');
  END IF;

  v_result := jsonb_build_object(
    'valid', true,
    'course_id', v_qr.course_id,
    'institution_id', v_qr.institution_id,
    'institution_name', v_qr.institution_name,
    'course_name', concat(v_qr.year, '° "', v_qr.division, '" - Turno ', v_qr.shift),
    'school_year', v_qr.school_year,
    'expires_at', v_qr.expires_at
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función 6.2: Completar registro del estudiante vinculando el usuario autenticado
CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_token uuid,
  p_first_name text,
  p_last_name text,
  p_dni text,
  p_birth_date date
)
RETURNS jsonb AS $$
DECLARE
  v_val jsonb;
  v_user_id uuid;
  v_dni_trimmed text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión de usuario no válida.');
  END IF;

  v_dni_trimmed := trim(p_dni);

  -- 1. Validar token QR
  v_val := public.validate_qr_token(p_token);
  IF NOT (v_val->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_val->>'error');
  END IF;

  -- 2. Validar que el DNI no pertenezca a otra cuenta activa o pendiente en la institución (Resolución I-03)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE institution_id = (v_val->>'institution_id')::uuid
      AND dni = v_dni_trimmed
      AND account_status IN ('pending', 'approved', 'suspended')
      AND id <> v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El documento ingresado ya se encuentra registrado o en trámite en esta institución.');
  END IF;

  -- 3. Crear o actualizar el perfil como estudiante en estado 'pending'
  INSERT INTO public.profiles (
    id,
    institution_id,
    course_id,
    role,
    first_name,
    last_name,
    dni,
    birth_date,
    account_status
  ) VALUES (
    v_user_id,
    (v_val->>'institution_id')::uuid,
    (v_val->>'course_id')::uuid,
    'student',
    trim(p_first_name),
    trim(p_last_name),
    v_dni_trimmed,
    p_birth_date,
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    course_id = EXCLUDED.course_id,
    role = 'student',
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    dni = EXCLUDED.dni,
    birth_date = EXCLUDED.birth_date,
    account_status = 'pending',
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- CENTINEL - MIGRACIÓN 07: SEGURIDAD, REGISTRO UNIFICADO Y POLÍTICAS RLS
-- ==============================================================================

-- 1. Soporte para código alfanumérico corto en qr_codes
ALTER TABLE public.qr_codes ADD COLUMN IF NOT EXISTS short_code text;
CREATE INDEX IF NOT EXISTS idx_qr_codes_short_code ON public.qr_codes (upper(short_code));

-- 2. Función RPC unificada para validar códigos de registro (QR o manual)
CREATE OR REPLACE FUNCTION public.validate_registration_code(p_code text)
RETURNS jsonb AS $$
DECLARE
  v_clean text;
  v_uuid uuid := NULL;
  v_qr RECORD;
  v_result jsonb;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Debés ingresar un código válido.');
  END IF;

  v_clean := upper(regexp_replace(trim(p_code), '[\s-]', '', 'g'));

  -- Verificar si coincide con formato UUID estándar
  IF trim(p_code) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_uuid := trim(p_code)::uuid;
  END IF;

  SELECT 
    q.id,
    q.code_token,
    q.short_code,
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
  WHERE (v_uuid IS NOT NULL AND q.code_token = v_uuid)
     OR (q.short_code IS NOT NULL AND upper(q.short_code) = v_clean)
     OR (v_clean ~* '^[0-9A-Z]{10}$' AND q.code_token::text ILIKE '%' || v_clean || '%')
  ORDER BY q.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código no encontrado o no reconocido.');
  END IF;

  IF now() > v_qr.expires_at THEN
    RETURN jsonb_build_object('valid', false, 'error', 'El código ha expirado. Solicitá a la autoridad uno nuevo.');
  END IF;

  v_result := jsonb_build_object(
    'valid', true,
    'code_token', v_qr.code_token,
    'token_for_registration', v_qr.code_token,
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

-- 3. Mantener y actualizar validate_qr_token eliminando la sobrecarga para PostgREST
DROP FUNCTION IF EXISTS public.validate_qr_token(uuid);
CREATE OR REPLACE FUNCTION public.validate_qr_token(p_token text)
RETURNS jsonb AS $$
BEGIN
  RETURN public.validate_registration_code(p_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar complete_student_registration para aceptar p_token como text (eliminando la versión uuid para evitar ambigüedad en PostgREST)
DROP FUNCTION IF EXISTS public.complete_student_registration(uuid, uuid, text, text, text, date);
CREATE OR REPLACE FUNCTION public.complete_student_registration(
  p_user_id uuid,
  p_token text,
  p_first_name text,
  p_last_name text,
  p_dni text,
  p_birth_date date
)
RETURNS jsonb AS $$
DECLARE
  v_val jsonb;
  v_dni_trimmed text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de usuario no válido.');
  END IF;

  v_dni_trimmed := trim(p_dni);

  -- 1. Validar token QR o código alfanumérico
  v_val := public.validate_registration_code(p_token);
  IF NOT (v_val->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_val->>'error');
  END IF;

  -- 2. Validar que el DNI no pertenezca a otra cuenta activa o pendiente en la institución
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE institution_id = (v_val->>'institution_id')::uuid
      AND dni = v_dni_trimmed
      AND account_status IN ('pending', 'approved', 'suspended')
      AND id <> p_user_id
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
    p_user_id,
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

-- 5. Trigger para prevenir escalación de privilegios en public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
DECLARE
  v_is_authority boolean;
BEGIN
  -- Verificar si el usuario que ejecuta la acción es autoridad aprobada
  SELECT (role = 'authority' AND account_status = 'approved') INTO v_is_authority
  FROM public.profiles
  WHERE id = auth.uid();

  -- Si no es una autoridad aprobada (o es el propio estudiante actualizando su perfil):
  IF NOT COALESCE(v_is_authority, false) THEN
    -- Bloquear cambio de rol a autoridad o admin
    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role <> 'student' THEN
      RAISE EXCEPTION 'No está autorizado a modificar el rol de usuario.';
    END IF;

    -- Bloquear auto-aprobación de cuenta
    IF NEW.account_status IS DISTINCT FROM OLD.account_status 
       AND NEW.account_status = 'approved' 
       AND OLD.account_status <> 'approved' THEN
      RAISE EXCEPTION 'No está autorizado a aprobar o reactivar la cuenta.';
    END IF;

    -- Bloquear auto-reactivación si estaba suspendida o rechazada
    IF OLD.account_status IN ('suspended', 'rejected') 
       AND NEW.account_status IS DISTINCT FROM OLD.account_status 
       AND NEW.account_status <> 'pending' THEN
      RAISE EXCEPTION 'Una cuenta suspendida o rechazada no puede cambiar de estado.';
    END IF;

    -- Bloquear cambio de institución
    IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
      RAISE EXCEPTION 'No está autorizado a cambiar de institución.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 6. Política RLS para permitir eliminación de estudiantes por parte de autoridades aprobadas
DROP POLICY IF EXISTS "Autoridades pueden eliminar perfiles de su institucion" ON public.profiles;
CREATE POLICY "Autoridades pueden eliminar perfiles de su institucion"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id() AND
    role = 'student'
  );

-- 7. Actualizar política RLS en public.cases para estudiantes con reportes vinculados
DROP POLICY IF EXISTS "Students can view own case metadata" ON public.cases;
CREATE POLICY "Students can view own case metadata"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE (r.id = cases.report_id OR r.case_id = cases.id)
        AND r.student_id = auth.uid()
    )
  );

-- 8. Endurecimiento RLS: exigir account_status = 'approved' para insertar reportes y mensajes
DROP POLICY IF EXISTS "Students can create reports" ON public.reports;
CREATE POLICY "Students can create reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_user_role() = 'student' AND
    public.get_auth_user_status() = 'approved' AND
    student_id = auth.uid() AND
    institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "Students can insert messages on own reports" ON public.report_messages;
CREATE POLICY "Students can insert messages on own reports"
  ON public.report_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_role = 'student' AND
    public.get_auth_user_status() = 'approved' AND
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_messages.report_id
        AND r.student_id = auth.uid()
    )
  );

-- Notificar recarga de schema cache a PostgREST
NOTIFY pgrst, 'reload schema';

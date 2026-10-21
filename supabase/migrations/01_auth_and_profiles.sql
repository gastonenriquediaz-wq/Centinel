-- Centinel - Migración 01: Instituciones, Perfiles y Políticas de Seguridad (RLS)
-- Proyecto de Grado - Universidad Católica de Salta

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'authority');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABLA INSTITUTIONS
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  identification_code text UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS en institutions
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- 3. TABLA PROFILES (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE RESTRICT NOT NULL,
  role user_role NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  dni text,                          -- Requerido para estudiantes
  birth_date date,                   -- Requerido para estudiantes
  position text,                     -- 'Director' o 'Vicedirector' para autoridades
  account_status account_status DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT dni_format CHECK (dni IS NULL OR length(dni) BETWEEN 7 AND 9)
);

-- Índice para búsquedas rápidas por institución y estado
CREATE INDEX IF NOT EXISTS idx_profiles_institution_id ON public.profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_dni ON public.profiles(dni) WHERE dni IS NOT NULL;

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER para RLS eficiente y sin recursión)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_institution_id()
RETURNS uuid AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_status()
RETURNS account_status AS $$
  SELECT account_status FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. POLÍTICAS RLS EN INSTITUTIONS
-- Cualquier usuario autenticado puede leer la información de su propia institución
CREATE POLICY "Usuarios pueden ver su propia institucion"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (id = public.get_auth_user_institution_id());

-- 6. POLÍTICAS RLS EN PROFILES
-- Regla 1: Un usuario siempre puede ver su propio perfil
CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Regla 2: Un usuario puede actualizar ciertos campos de su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Regla 3: Las autoridades aprobadas pueden ver todos los perfiles de SU institución
CREATE POLICY "Autoridades pueden ver perfiles de su institucion"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  );

-- Regla 4: Las autoridades aprobadas pueden actualizar el estado de perfiles de su institución (aprobar, suspender, etc.)
CREATE POLICY "Autoridades pueden actualizar perfiles de su institucion"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_user_role() = 'authority' AND
    public.get_auth_user_status() = 'approved' AND
    institution_id = public.get_auth_user_institution_id()
  );

-- Regla 5: Permitir inserción del perfil propio al registrarse
CREATE POLICY "Usuarios autenticados pueden insertar su propio perfil"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Centinel - Datos ficticios para pruebas académicas (Seed Data)
-- Proyecto de Grado - Universidad Católica de Salta

-- 1. Insertar institución educativa ficticia de prueba
INSERT INTO public.institutions (id, name, address, identification_code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Colegio Secundario Modelo San Martín',
  'Av. Entre Ríos 1250, Salta, Argentina',
  'INST-SALTA-001'
)
ON CONFLICT (id) DO NOTHING;

-- Remove direct execution grants from the auth trigger function.
-- The trigger on auth.users executes by function OID and does not require
-- frontend/API roles to call this function directly.
REVOKE EXECUTE ON FUNCTION public.criar_perfil_automatico() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_automatico() FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_automatico() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_automatico() FROM service_role;

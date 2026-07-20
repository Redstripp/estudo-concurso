-- Hardening aditivo dos privilegios das funcoes do CRUD remoto de pontuacao.
-- A migration original 20260720143000 ja pode estar aplicada; nao altere seu conteudo.

-- Helpers internos e funcoes administrativas/trigger: chamadas diretas por roles de API
-- nao sao parte do contrato publico. RPCs SECURITY DEFINER continuam chamando os helpers
-- como owner da funcao.
revoke execute on function public.reserve_scoring_profile_operation(uuid, text, uuid, text)
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.complete_scoring_profile_operation(uuid, text, uuid, text, jsonb)
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.insert_scoring_profile_blocks_from_json(uuid, uuid, jsonb)
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.lock_scoring_profile_version_from_simulado()
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.prevent_used_scoring_profile_delete()
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.prevent_used_scoring_profile_version_changes()
  from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.prevent_used_scoring_profile_block_changes()
  from PUBLIC, anon, authenticated, service_role;

-- RPCs publicas da feature: somente usuarios autenticados podem chamar pelo cliente.
-- service_role nao recebe grant porque o frontend e os fluxos validados nao dependem dele.
revoke execute on function public.create_scoring_profile_with_version(uuid, text, text, text, boolean, jsonb, jsonb, jsonb)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.create_scoring_profile_with_version(uuid, text, text, text, boolean, jsonb, jsonb, jsonb)
  to authenticated;

revoke execute on function public.save_scoring_profile_current_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.save_scoring_profile_current_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb)
  to authenticated;

revoke execute on function public.duplicate_scoring_profile(uuid, uuid, integer, text, text, text, boolean)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.duplicate_scoring_profile(uuid, uuid, integer, text, text, text, boolean)
  to authenticated;

revoke execute on function public.create_scoring_profile_new_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.create_scoring_profile_new_version(uuid, uuid, text, text, boolean, jsonb, jsonb, jsonb)
  to authenticated;

revoke execute on function public.replace_scoring_profile_blocks(uuid, uuid, integer, jsonb)
  from PUBLIC, anon, authenticated, service_role;
grant execute on function public.replace_scoring_profile_blocks(uuid, uuid, integer, jsonb)
  to authenticated;

comment on function public.reserve_scoring_profile_operation(uuid, text, uuid, text)
  is 'Helper interno do CRUD de pontuacao; execucao direta revogada para roles de API.';
comment on function public.complete_scoring_profile_operation(uuid, text, uuid, text, jsonb)
  is 'Helper interno do CRUD de pontuacao; execucao direta revogada para roles de API.';
comment on function public.insert_scoring_profile_blocks_from_json(uuid, uuid, jsonb)
  is 'Helper interno do CRUD de pontuacao; execucao direta revogada para roles de API.';

-- Fix production WhatsApp router regressions:
-- 1. Numeric menu selection must not fail with ambiguous user_id.
-- 2. Greetings while a client/project choice is pending must resume that exact list.
-- 3. The router must not reference undeclared variables.

create or replace function public.elementus_whatsapp_resume_text(
  p_session_id uuid,
  p_first_name text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.intake_sessions%rowtype;
  v_client_name text;
  v_project_name text;
  v_intro text;
  v_next text;
  v_rows text;
  v_pending_client_ids jsonb;
  v_pending_project_ids jsonb;
begin
  select * into v_session
  from public.intake_sessions
  where id = p_session_id;

  if v_session.id is null then
    return public.elementus_address_message(
      p_first_name,
      'nao encontrei esse atendimento. Digite 0 para abrir o menu.'
    );
  end if;

  v_pending_client_ids := coalesce(v_session.context_data -> 'pending_client_candidate_ids', '[]'::jsonb);

  if v_session.client_id is null
     and jsonb_typeof(v_pending_client_ids) = 'array'
     and jsonb_array_length(v_pending_client_ids) > 0 then
    with ids as (
      select value::uuid as id, ordinality as ord
      from jsonb_array_elements_text(v_pending_client_ids) with ordinality
    ), rows as (
      select
        row_number() over (order by ids.ord) as rn,
        ids.ord,
        coalesce(c.nome_fantasia, c.razao_social, 'Cliente sem nome') as client_name,
        coalesce(c.cnpj, 'sem CNPJ') as cnpj
      from ids
      join public.omie_clients_mirror c on c.id = ids.id
    )
    select string_agg(rn::text || '. ' || client_name || ' - CNPJ ' || cnpj, chr(10) order by ord)
    into v_rows
    from rows;

    return public.elementus_address_message(
      p_first_name,
      'ainda estou aguardando a escolha do cadastro do cliente. Escolha pelo numero ou envie o CNPJ completo:' ||
      chr(10) || coalesce(v_rows, '')
    );
  end if;

  v_pending_project_ids := coalesce(v_session.context_data -> 'pending_project_candidate_ids', '[]'::jsonb);

  if v_session.project_id is null
     and jsonb_typeof(v_pending_project_ids) = 'array'
     and jsonb_array_length(v_pending_project_ids) > 0 then
    select coalesce(c.nome_fantasia, c.razao_social, 'cliente selecionado')
    into v_client_name
    from public.omie_clients_mirror c
    where c.id = v_session.client_id;

    with ids as (
      select value::uuid as id, ordinality as ord
      from jsonb_array_elements_text(v_pending_project_ids) with ordinality
    ), rows as (
      select
        row_number() over (order by ids.ord) as rn,
        ids.ord,
        coalesce(p.nome, 'Projeto sem nome') ||
          coalesce(' (' || nullif(p.numero_contrato, '') || ')', '') as project_name
      from ids
      join public.omie_projects_mirror p on p.id = ids.id
    )
    select string_agg(rn::text || '. ' || project_name, chr(10) order by ord)
    into v_rows
    from rows;

    return public.elementus_address_message(
      p_first_name,
      'ainda estou aguardando a escolha do projeto para ' ||
      coalesce(v_client_name, 'o cliente selecionado') ||
      '. Escolha pelo numero da lista, envie o nome do projeto ou o numero do contrato:' ||
      chr(10) || coalesce(v_rows, '')
    );
  end if;

  select
    coalesce(c.nome_fantasia, c.razao_social, 'cliente nao vinculado'),
    coalesce(p.nome, 'projeto nao vinculado')
  into v_client_name, v_project_name
  from public.intake_sessions s
  left join public.omie_projects_mirror p on p.id = s.project_id
  left join public.omie_clients_mirror c on c.id = coalesce(s.client_id, p.client_id)
  where s.id = p_session_id;

  v_intro := 'retomei o atendimento de ' || coalesce(v_client_name, 'cliente nao vinculado') ||
    ' - ' || coalesce(v_project_name, 'projeto nao vinculado') || '. ';

  v_next := case
    when v_session.current_step = 'awaiting_report_action' then
      'Voce quer construir um novo relatorio ou editar um relatorio atual? Responda com "novo" ou "editar".'
    when v_session.current_step in ('awaiting_client', 'awaiting_client_cnpj') then
      'Qual e o cliente deste relatorio?'
    when v_session.current_step in ('awaiting_project', 'awaiting_project_clarification') then
      'Qual e o projeto ou contrato deste relatorio?'
    when v_session.current_step = 'awaiting_period' then
      'Qual foi o periodo da campanha ou atividade? Exemplo: 11/02/2026 a 10/03/2026, fevereiro de 2026 ou 10a campanha.'
    when v_session.current_step = 'awaiting_field_dates' then
      'Quais foram as datas de campo?'
    when v_session.current_step = 'awaiting_location' then
      'Envie a localizacao pelo WhatsApp ou descreva o local do atendimento.'
    when v_session.current_step = 'awaiting_technical_summary' then
      'Me conte o resumo tecnico do que foi executado em campo.'
    when v_session.current_step = 'awaiting_activities' then
      'Quais atividades foram executadas neste periodo?'
    when v_session.current_step = 'awaiting_results' then
      'Quais resultados, status ou quantidades precisam entrar no relatorio?'
    when v_session.current_step = 'awaiting_occurrences' then
      'Houve alguma ocorrencia, impedimento ou ponto de atencao?'
    when v_session.current_step = 'awaiting_photos' then
      'Pode enviar as fotos ou evidencias. Quando terminar, digite CONCLUIR.'
    when v_session.current_step = 'awaiting_additional_info' then
      'Ha mais alguma informacao que precisa constar no relatorio? Se nao houver, responda "nao" ou digite CONCLUIR.'
    when v_session.status = 'ready_for_draft' then
      'Esse atendimento ja esta pronto para montagem da minuta na plataforma.'
    else
      'Pode enviar a proxima informacao do atendimento.'
  end;

  return public.elementus_address_message(p_first_name, v_intro || v_next);
end;
$$;

do $$
declare
  v_def text;
  v_original_def text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'elementus_process_whatsapp_intake_before_photo_queue_20260428'
  limit 1;

  if v_def is null then
    raise notice 'Function elementus_process_whatsapp_intake_before_photo_queue_20260428 not found; skipping router patch.';
    return;
  end if;

  v_original_def := v_def;

  if position('v_pending_choice_session' in v_def) = 0 then
    v_def := replace(
      v_def,
      '  v_options_at_text text;
  v_options_are_recent boolean := false;',
      '  v_options_at_text text;
  v_pending_choice_session public.intake_sessions%rowtype;
  v_options_are_recent boolean := false;'
    );

    v_def := replace(
      v_def,
      '  if v_router_session.id is not null then
    v_options_at_text := coalesce(v_router_session.context_data, ''{}''::jsonb) ->> ''whatsapp_session_options_at'';',
      '  select * into v_pending_choice_session
  from public.intake_sessions s
  where s.user_id = v_user_id
    and s.status in (''open'', ''awaiting_selection'', ''awaiting_data'', ''paused'', ''ready_for_draft'')
    and (
      (s.client_id is null and jsonb_typeof(coalesce(s.context_data, ''{}''::jsonb) -> ''pending_client_candidate_ids'') = ''array'' and jsonb_array_length(coalesce(s.context_data, ''{}''::jsonb) -> ''pending_client_candidate_ids'') > 0)
      or
      (s.project_id is null and jsonb_typeof(coalesce(s.context_data, ''{}''::jsonb) -> ''pending_project_candidate_ids'') = ''array'' and jsonb_array_length(coalesce(s.context_data, ''{}''::jsonb) -> ''pending_project_candidate_ids'') > 0)
    )
  order by s.updated_at desc
  limit 1;

  if v_router_session.id is not null then
    v_options_at_text := coalesce(v_router_session.context_data, ''{}''::jsonb) ->> ''whatsapp_session_options_at'';'
    );

    v_def := replace(
      v_def,
      '  if (
    (public.elementus_whatsapp_menu_requested(v_text_content) or public.elementus_whatsapp_greeting_requested(v_text_content) or v_requested_action = ''edit_report'')
    and v_option_count > 0',
      '  if v_pending_choice_session.id is not null
     and public.elementus_whatsapp_greeting_requested(v_text_content)
     and coalesce(v_key, '''') not in (''0'', ''menu'', ''novo'', ''nova'', ''new'', ''novo relatorio'', ''novo relatório'')
     and (v_router_session.id is null or v_options_are_recent = false) then
    v_message_id := public.elementus_insert_intake_inbound_message(v_pending_choice_session.id, v_user_id, p_payload);
    v_outbound := public.elementus_whatsapp_resume_text(v_pending_choice_session.id, v_user_first_name);

    return query
    select * from public.elementus_build_whatsapp_intake_response(
      true, true,
      case
        when v_pending_choice_session.client_id is null then ''client_choice_resumed''
        when v_pending_choice_session.project_id is null then ''project_choice_resumed''
        else ''session_resumed''
      end,
      v_pending_choice_session.id, v_message_id,
      true, false, v_sender_phone, v_outbound, v_user_id, v_user_full_name,
      case
        when v_pending_choice_session.client_id is null then ''client_cnpj_request''
        when v_pending_choice_session.project_id is null then ''project_request''
        else ''session_resumed''
      end
    );
    return;
  end if;

  if (
    (public.elementus_whatsapp_menu_requested(v_text_content) or public.elementus_whatsapp_greeting_requested(v_text_content) or v_requested_action = ''edit_report'')
    and v_option_count > 0'
    );
  end if;

  v_def := replace(
    v_def,
    'and not (v_key = any(v_menu_keys))
     and (v_router_session.id is null or v_options_are_recent = false)',
    'and coalesce(v_key, '''') not in (''0'', ''menu'', ''novo'', ''nova'', ''new'', ''novo relatorio'', ''novo relatório'')
     and (v_router_session.id is null or v_options_are_recent = false)'
  );

  v_def := replace(
    v_def,
    '      update public.intake_sessions
      set context_data = coalesce(context_data, ''{}''::jsonb)
          - ''whatsapp_session_options''
          - ''whatsapp_session_options_at'',
          updated_at = now()
      where user_id = v_user_id
        and coalesce(context_data, ''{}''::jsonb) ? ''whatsapp_session_options'';',
    '      update public.intake_sessions s
      set context_data = coalesce(s.context_data, ''{}''::jsonb)
          - ''whatsapp_session_options''
          - ''whatsapp_session_options_at'',
          updated_at = now()
      where s.user_id = v_user_id
        and coalesce(s.context_data, ''{}''::jsonb) ? ''whatsapp_session_options'';'
  );

  if v_def <> v_original_def then
    execute v_def;
  end if;
end;
$$;

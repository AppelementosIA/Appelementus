create or replace function public.elementus_normalize_whatsapp_phone(input_phone text)
returns text
language sql
immutable
as $$
  with digits as (
    select regexp_replace(coalesce(input_phone, ''), '\D', '', 'g') as value
  ),
  normalized as (
    select
      case
        when value = '' then null
        when value like '55%' then '+' || value
        when length(value) in (10, 11) then '+55' || value
        else '+' || value
      end as value
    from digits
  )
  select
    case
      when value ~ '^\+[1-9][0-9]{7,14}$' then value
      else null
    end
  from normalized;
$$;

update public.platform_users
set
  phone = coalesce(public.elementus_normalize_whatsapp_phone(phone), phone),
  phone_whatsapp = public.elementus_normalize_whatsapp_phone(coalesce(phone_whatsapp, phone)),
  updated_at = now()
where
  phone_whatsapp is not null
  and phone_whatsapp !~ '^\+[1-9][0-9]{7,14}$';

comment on function public.elementus_normalize_whatsapp_phone(text) is
  'Normaliza telefones de usuarios para o formato E.164 esperado em phone_whatsapp.';

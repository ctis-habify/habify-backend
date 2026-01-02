create or replace function public.job_reminder_scan()
returns void
language plpgsql
security definer
as $$
declare
  now_utc timestamptz := now();
  window_end timestamptz := now() + interval '10 minutes';
begin
  -- Mantık: "Şimdi + 10 dakika içinde reminder_time gelen ve bugün completion yok" -> due_reminders insert.
  
  -- routines.reminder_time = '21:00:00' gibi time
  -- Bugünün UTC tarihini baz alıp scheduled_for üretelim:
  
  insert into public.due_reminders(user_id, routine_id, scheduled_for)
  select r.user_id::uuid, r.id,
         (date_trunc('day', now_utc at time zone 'UTC') + r.reminder_time)::timestamptz as target_time
  from public.routines r
  where r.active = true
    and r.frequency_type = 'daily' -- frequency -> frequency_type
    and r.reminder_time is not null
    -- Check if reminder time is in the window (considering UTC date + time)
    and (date_trunc('day', now_utc at time zone 'UTC') + r.reminder_time)::timestamptz between now_utc and window_end
    -- Check if NOT completed today
    and not exists (
      select 1 from public.routine_logs rl
      where rl.user_id = r.user_id
        and rl.routine_id = r.id
        and rl.log_date = (now_utc at time zone 'UTC')::date
        -- Optional: check is_verified if reminders depend on verification? Usually reminder is just "do it", so log_date check is enough.
    )
  on conflict (user_id, routine_id, scheduled_for) do nothing;
end;
$$;

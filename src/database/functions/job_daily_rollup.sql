create or replace function public.job_daily_rollup(p_day date default (current_date - 1))
returns void
language plpgsql
security definer
as $$
begin
  -- 1) Dün completion var mı? -> routines (routine_state) güncelle
  -- Burada "p_day" dün demek (UTC gününe göre varsayılıyor veya inputa göre)
  
  -- Mapping:
  -- public.routine_completions -> public.routine_logs
  -- public.routine_state       -> public.routines
  -- completed_at               -> log_date (already date type in entity)
  
  with completed as (
    select rl.user_id, rl.routine_id, rl.log_date as cday
    from public.routine_logs rl
    where rl.log_date = p_day
    and rl.is_verified = true -- Sadece verify edilmişler sayılsın isteniyorsa
    group by rl.user_id, rl.routine_id, rl.log_date
  )
  update public.routines r
  set
    streak = case
      when exists (
        select 1 from completed c
        where c.routine_id = r.id 
          -- user_id kontrolü gereksiz olabilir routine_id uniq ise ama safety için:
          and c.user_id = r.user_id 
      )
      then r.streak + 1
      else 0
    end,
    missed_count = case
      when exists (
        select 1 from completed c
        where c.routine_id = r.id
          and c.user_id = r.user_id
      )
      then r.missed_count
      else r.missed_count + 1
    end,
    last_completed_date = case
      when exists (
        select 1 from completed c
        where c.routine_id = r.id
          and c.user_id = r.user_id
      )
      then p_day
      else r.last_completed_date
    end,
    is_ai_verified = false
    -- updated_at removed as it does not exist in standard entity shown, or add if needed
  where r.frequency_type = 'daily' -- frequency -> frequency_type
    -- active check? Entity doesn't show 'active' column but maybe we assume all in table are active or add check if field exists.
    -- Assuming all routines in table are "active" unless soft deleted (which shows as delete_date usually).
    -- If there's no active column, skipping that check.
    ;

end;
$$;

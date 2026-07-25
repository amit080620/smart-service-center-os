-- Run this AFTER the wallet_system.sql migration above — makes your
-- existing account the platform Super Admin. Replace the email below
-- with whatever email you used to sign up (pathak.amit384@gmail.com
-- per the original setup, but confirm it's correct before running).

insert into public.platform_admins (user_id, email, full_name)
select id, email, 'Amit Kumar'
from auth.users
where email = 'pathak.amit384@gmail.com'
on conflict (user_id) do nothing;

-- Confirm it worked — should show one row with your email.
select * from public.platform_admins;

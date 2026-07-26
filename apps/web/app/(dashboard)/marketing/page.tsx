import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import MarketingClient from './MarketingClient';

// Customer engagement hub — the "relationship" side of the app rather
// than the "transaction" side. Three kinds of outreach that each build
// the bond differently: personal occasions (birthdays/anniversaries),
// helpful reminders (service due), and proactive offers (festival
// greetings, win-back messages to lapsed customers, thank-you to loyal
// ones). All delivery goes through the same one-tap WhatsApp link
// pattern used elsewhere (see lib/whatsapp.ts) — no bulk-send API is
// set up, so this is "compose once, tap through the matched list."
export default async function MarketingPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;

  const [{ data: customers }, { data: vehicles }, { data: jobs }] = await Promise.all([
    admin
      .from('customers')
      .select('id, first_name, last_name, phone, date_of_birth, anniversary_date, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null),
    admin
      .from('vehicles')
      .select('id, customer_id, plate_number, make, model, next_service_date')
      .eq('org_id', orgId)
      .is('deleted_at', null),
    admin
      .from('job_cards')
      .select('customer_id, created_at, final_cost, status')
      .eq('org_id', orgId)
      .is('deleted_at', null)
  ]);

  const todayMD = new Date().toISOString().slice(5, 10); // "MM-DD"

  const birthdaysToday = (customers ?? []).filter((c) => c.date_of_birth && c.date_of_birth.slice(5, 10) === todayMD);
  const anniversariesToday = (customers ?? []).filter((c) => c.anniversary_date && c.anniversary_date.slice(5, 10) === todayMD);

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const serviceDue = (vehicles ?? [])
    .filter((v) => v.next_service_date && v.next_service_date <= in30Days.toISOString().slice(0, 10))
    .map((v) => ({ ...v, customer: customers?.find((c) => c.id === v.customer_id) }))
    .filter((v) => v.customer);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const lastVisitMap = new Map<string, string>();
  for (const j of jobs ?? []) {
    const existing = lastVisitMap.get(j.customer_id);
    if (!existing || j.created_at > existing) lastVisitMap.set(j.customer_id, j.created_at);
  }
  const lapsedCustomers = (customers ?? []).filter((c) => {
    const lastVisit = lastVisitMap.get(c.id);
    if (!lastVisit) return c.created_at < ninetyDaysAgo.toISOString();
    return lastVisit < ninetyDaysAgo.toISOString();
  });

  const spendMap = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (['completed', 'delivered'].includes(j.status)) {
      spendMap.set(j.customer_id, (spendMap.get(j.customer_id) ?? 0) + j.final_cost);
    }
  }
  const topSpenders = [...spendMap.entries()]
    .map(([customerId, spend]) => ({ customer: customers?.find((c) => c.id === customerId), spend }))
    .filter((x) => x.customer)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 20);

  return (
    <MarketingClient
      birthdaysToday={birthdaysToday.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone }))}
      anniversariesToday={anniversariesToday.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone }))}
      serviceDue={serviceDue.map((v) => ({
        vehicleId: v.id,
        plateNumber: v.plate_number,
        makeModel: `${v.make} ${v.model}`,
        nextServiceDate: v.next_service_date!,
        customerId: v.customer!.id,
        customerName: `${v.customer!.first_name} ${v.customer!.last_name}`.trim(),
        customerPhone: v.customer!.phone
      }))}
      allCustomers={(customers ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone }))}
      lapsedCustomers={lapsedCustomers.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone }))}
      topSpenders={topSpenders.map((x) => ({ id: x.customer!.id, name: `${x.customer!.first_name} ${x.customer!.last_name}`.trim(), phone: x.customer!.phone, spend: x.spend }))}
    />
  );
}

'use client';

import { useState } from 'react';
import { Cake, Heart, Wrench, Megaphone, MessageCircle, Sparkles } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';

interface SimpleCustomer {
  id: string;
  name: string;
  phone: string;
}
interface ServiceDueVehicle {
  vehicleId: string;
  plateNumber: string;
  makeModel: string;
  nextServiceDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
}

const FESTIVAL_TEMPLATES: Record<string, string> = {
  Diwali: 'Wishing you and your family a very Happy Diwali! May this festival of lights bring joy, prosperity, and safe travels all year. — {shopName}',
  Holi: 'Happy Holi! Wishing you a colorful and joyful celebration with your loved ones. — {shopName}',
  'New Year': 'Wishing you a very Happy New Year! Thank you for trusting us with your vehicle all year — here\u2019s to a safe and smooth year ahead. — {shopName}',
  Eid: 'Eid Mubarak! Wishing you and your family peace, happiness, and prosperity. — {shopName}',
  Christmas: 'Merry Christmas and a Happy New Year! Wishing you safe travels this festive season. — {shopName}',
  'Republic Day': 'Happy Republic Day! Wishing you and your family a proud and joyful day. — {shopName}'
};

const SEGMENTS = [
  { key: 'all', label: 'All Customers' },
  { key: 'lapsed', label: "Haven't Visited in 90+ Days" },
  { key: 'top', label: 'Top Spenders (Loyalty)' }
] as const;

export default function MarketingClient({
  birthdaysToday,
  anniversariesToday,
  serviceDue,
  allCustomers,
  lapsedCustomers,
  topSpenders
}: {
  birthdaysToday: SimpleCustomer[];
  anniversariesToday: SimpleCustomer[];
  serviceDue: ServiceDueVehicle[];
  allCustomers: SimpleCustomer[];
  lapsedCustomers: SimpleCustomer[];
  topSpenders: Array<SimpleCustomer & { spend: number }>;
}) {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['key']>('lapsed');
  const [message, setMessage] = useState('');

  const segmentCustomers =
    segment === 'all' ? allCustomers : segment === 'lapsed' ? lapsedCustomers : topSpenders;

  function personalize(template: string, name: string) {
    return template.replace('{name}', name.split(' ')[0] ?? name);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-amber-500" />
            Customer Engagement
          </h1>
          <p className="text-sm text-slate-500 mt-1">Wishes, service reminders, and offers — one tap sends via WhatsApp.</p>
        </div>

        {/* Today's Occasions */}
        {(birthdaysToday.length > 0 || anniversariesToday.length > 0) && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <Cake className="w-4 h-4 text-amber-500" /> Today's Occasions
              </h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {birthdaysToday.map((c) => (
                <OccasionRow key={`b-${c.id}`} customer={c} icon={<Cake className="w-4 h-4 text-pink-400" />} label="Birthday" message={`Happy Birthday, ${c.name.split(' ')[0]}! Wishing you a wonderful year ahead. Thank you for being a valued customer of ours.`} />
              ))}
              {anniversariesToday.map((c) => (
                <OccasionRow key={`a-${c.id}`} customer={c} icon={<Heart className="w-4 h-4 text-red-400" />} label="Anniversary" message={`Happy Anniversary, ${c.name.split(' ')[0]}! Wishing you many more years of happiness together.`} />
              ))}
            </div>
          </div>
        )}

        {/* Service Due */}
        {serviceDue.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <Wrench className="w-4 h-4 text-amber-500" /> Service Due Soon ({serviceDue.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {serviceDue.map((v) => {
                const overdue = v.nextServiceDate < new Date().toISOString().slice(0, 10);
                const msg = `Hi ${v.customerName.split(' ')[0]}, this is a reminder that your ${v.makeModel} (${v.plateNumber}) is ${
                  overdue ? 'overdue for its scheduled service' : 'due for its scheduled service soon'
                }. Please visit us at your convenience to keep your vehicle running smoothly.`;
                const link = buildWhatsAppLink(v.customerPhone, msg);
                return (
                  <div key={v.vehicleId} className="p-3 px-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200 truncate">
                        {v.customerName} <span className="text-slate-500">· {v.makeModel} ({v.plateNumber})</span>
                      </div>
                      <div className={`text-xs mt-0.5 ${overdue ? 'text-red-400' : 'text-amber-400'}`}>
                        {overdue ? 'Overdue since' : 'Due'} {new Date(v.nextServiceDate).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 cursor-pointer p-1 shrink-0" title="Send WhatsApp Reminder">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign composer */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-amber-500" /> Offers & Festival Wishes
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Quick Festival Templates</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(FESTIVAL_TEMPLATES).map(([festival, template]) => (
                  <button
                    key={festival}
                    onClick={() => setMessage(template.replace('{shopName}', 'our team'))}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg cursor-pointer"
                  >
                    {festival}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Your Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Write an offer or greeting — pick a template above, or write your own. Use {name} to personalize it."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Send To</label>
              <div className="flex gap-2 flex-wrap">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSegment(s.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer ${
                      segment === s.key ? 'bg-amber-500 text-slate-950 font-medium' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.label} ({s.key === 'all' ? allCustomers.length : s.key === 'lapsed' ? lapsedCustomers.length : topSpenders.length})
                  </button>
                ))}
              </div>
            </div>

            {message.trim() && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 text-xs text-slate-500 border-b border-slate-800">
                  {segmentCustomers.length} customer{segmentCustomers.length === 1 ? '' : 's'} — tap each to send
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                  {segmentCustomers.slice(0, 100).map((c) => {
                    const link = buildWhatsAppLink(c.phone, personalize(message, c.name));
                    return (
                      <div key={c.id} className="p-3 px-4 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-300 truncate">
                          {c.name} {'spend' in c && <span className="text-xs text-amber-500 ml-1">₹{(c as any).spend.toLocaleString('en-IN')}</span>}
                        </span>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 cursor-pointer p-1 shrink-0" title="Send WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">No phone</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OccasionRow({
  customer,
  icon,
  label,
  message
}: {
  customer: SimpleCustomer;
  icon: React.ReactNode;
  label: string;
  message: string;
}) {
  const link = buildWhatsAppLink(customer.phone, message);
  return (
    <div className="p-3 px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm text-slate-200 truncate">{customer.name}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 cursor-pointer p-1 shrink-0" title="Send Wish">
          <MessageCircle className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

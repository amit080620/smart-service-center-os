// wa.me needs digits only (country code + number, no +/spaces/dashes) —
// strips everything else and assumes India (91) if no country code was
// entered with the number, since that's the only country this platform
// currently operates in.
export function buildWhatsAppLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}

export function rechargeReminderMessage(orgName: string, balance: number): string {
  if (balance <= 0) {
    return `Hi ${orgName}, this is a reminder from Smart Service Center OS — your wallet balance is \u20b9${balance} and new job cards are currently blocked. Please recharge to continue using the app. Reply here or call to arrange payment.`;
  }
  return `Hi ${orgName}, this is a reminder from Smart Service Center OS — your wallet balance is running low (\u20b9${balance}). Please recharge soon to avoid any interruption. Reply here or call to arrange payment.`;
}

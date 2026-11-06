import { env } from "./env";
/** Customer support contact details, formatted for display and for tel:/mailto: links. */
export function support() {
  const email = env().SUPPORT_EMAIL;
  const digits = env().SUPPORT_PHONE.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const phoneDisplay = national.length === 10 ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : env().SUPPORT_PHONE;
  const phoneHref = `tel:+${national.length === 10 ? "1" + national : digits}`;
  return { email, emailHref: `mailto:${email}`, phoneDisplay, phoneHref };
}

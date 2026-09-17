export async function notifySupportTeam(input: {
  ticketId: string;
  companyName: string;
  requesterEmail: string;
  category: string;
  subject: string;
  message: string;
  priority: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const supportEmail = process.env.PILOTZIA_SUPPORT_EMAIL;
  const fromEmail = process.env.PILOTZIA_SUPPORT_FROM_EMAIL;
  if (!apiKey || !supportEmail || !fromEmail) return { sent: false as const, reason: "not_configured" as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [supportEmail],
      reply_to: input.requesterEmail,
      subject: `[Pilotzia Support] ${input.priority.toUpperCase()} · ${input.subject}`,
      text: [
        `Ticket: ${input.ticketId}`,
        `Entreprise: ${input.companyName}`,
        `Demandeur: ${input.requesterEmail}`,
        `Catégorie: ${input.category}`,
        `Priorité: ${input.priority}`,
        "",
        input.message,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Support notification failed", res.status, text.slice(0, 300));
    return { sent: false as const, reason: "provider_error" as const };
  }
  return { sent: true as const };
}

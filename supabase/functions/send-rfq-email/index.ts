import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailPayload {
  supplierEmail: string;
  supplierName: string;
  rfqTitle: string;
  rfqDescription?: string;
  deadline?: string;
  urgency: "normal" | "urgent" | "critical";
  quoteLink: string;
  senderName: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const payload: EmailPayload = await req.json();
    const {
      supplierEmail,
      supplierName,
      rfqTitle,
      rfqDescription,
      deadline,
      urgency,
      quoteLink,
      senderName,
    } = payload;

    if (!supplierEmail || !supplierName || !rfqTitle || !quoteLink || !senderName) {
      throw new Error("Missing required email fields");
    }

    const urgencyBanner =
      urgency === "critical"
        ? `<div style="background:#FEE2E2;border-left:4px solid #DC2626;padding:12px 16px;margin-bottom:24px;border-radius:4px;">
            <strong style="color:#991B1B;">⚠ Critical Request</strong> — Please respond as soon as possible.
           </div>`
        : urgency === "urgent"
          ? `<div style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;margin-bottom:24px;border-radius:4px;">
              <strong style="color:#92400E;">Urgent Request</strong> — Your prompt response is appreciated.
             </div>`
          : "";

    const deadlineRow = deadline
      ? `<tr>
          <td style="padding:8px 0;color:#6B7280;font-size:14px;">Deadline</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;color:#111827;">
            ${new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </td>
         </tr>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #E5E7EB;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#1E293B;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#F97316;width:36px;height:36px;border-radius:6px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:18px;font-weight:700;line-height:36px;">Q</span>
                </td>
                <td style="padding-left:12px;">
                  <div style="color:#FFFFFF;font-size:16px;font-weight:700;letter-spacing:-0.3px;">QuoteForge</div>
                  <div style="color:#94A3B8;font-size:12px;">by Stenner Ltd</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${urgencyBanner}
            <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hi ${supplierName},</p>
            <p style="color:#374151;font-size:15px;margin:0 0 24px;line-height:1.6;">
              Stenner Ltd would like to invite you to submit a quote for the following request.
            </p>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
              <div style="font-size:17px;font-weight:600;color:#111827;margin-bottom:12px;">${rfqTitle}</div>
              ${rfqDescription ? `<p style="font-size:14px;color:#6B7280;margin:0 0 16px;line-height:1.6;">${rfqDescription}</p>` : ""}
              <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #E2E8F0;padding-top:12px;margin-top:8px;">
                ${deadlineRow}
                <tr>
                  <td style="padding:8px 0;color:#6B7280;font-size:14px;">Urgency</td>
                  <td style="padding:8px 0;font-size:14px;font-weight:600;color:#111827;text-transform:capitalize;">${urgency}</td>
                </tr>
              </table>
            </div>
            <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
              Use your unique link below to view the full specification, download any drawings, and submit your pricing. No account needed.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${quoteLink}" style="display:inline-block;background:#F97316;color:#FFFFFF;font-size:15px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:0.2px;">
                View RFQ &amp; Submit Quote →
              </a>
            </div>
            <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.6;">
              Or copy this link: <a href="${quoteLink}" style="color:#F97316;word-break:break-all;">${quoteLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0;">
            <p style="color:#6B7280;font-size:14px;margin:0;line-height:1.6;">
              Kind regards,<br>
              <strong style="color:#374151;">${senderName}</strong><br>
              Stenner Ltd
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              This is a quote request from Stenner Ltd. If you believe this was sent in error, please ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const plainText = `Hi ${supplierName},

Stenner Ltd would like to invite you to submit a quote for: ${rfqTitle}
${deadline ? `\nDeadline: ${new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}

Submit your quote here (no account needed):
${quoteLink}

Kind regards,
${senderName}
Stenner Ltd`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Stenner Ltd <${FROM_EMAIL}>`,
        to: [supplierEmail],
        subject: `Quote request: ${rfqTitle}${urgency !== "normal" ? ` [${urgency.toUpperCase()}]` : ""}`,
        html,
        text: plainText,
      }),
    });

    const rawResponse = await res.text();
    const data = rawResponse ? JSON.parse(rawResponse) : {};

    if (!res.ok) {
      throw new Error(data.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getWeeklyStats } from "@/lib/tracking";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodic-brown.vercel.app";

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (or a manual trigger with the secret)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const reportEmail = process.env.REPORT_EMAIL;
  if (!resendKey || !reportEmail) {
    return NextResponse.json({ error: "RESEND_API_KEY or REPORT_EMAIL not set" }, { status: 500 });
  }

  const { total, shows } = await getWeeklyStats();

  const weekEnd = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const showRows = shows.length > 0
    ? shows.map((s, i) => `
        <tr>
          <td style="padding:8px 12px;color:#a1a1aa;">${i + 1}</td>
          <td style="padding:8px 12px;">
            <a href="${SITE_URL}/show/${s.slug}" style="color:#fff;text-decoration:none;">${s.title}</a>
          </td>
          <td style="padding:8px 12px;text-align:right;color:#a1a1aa;">${s.views.toLocaleString()}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" style="padding:12px;color:#a1a1aa;text-align:center;">No show views recorded yet.</td></tr>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px;">

    <h1 style="font-size:24px;font-weight:700;margin:0 0 4px;">Episodic</h1>
    <p style="color:#71717a;margin:0 0 32px;font-size:14px;">Weekly report · ${weekStart} – ${weekEnd}</p>

    <div style="background:#18181b;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="color:#71717a;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em;">Total page views</p>
      <p style="font-size:48px;font-weight:700;margin:0;color:#fff;">${total.toLocaleString()}</p>
    </div>

    <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#71717a;margin:0 0 12px;">Top shows</h2>
    <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:12px;overflow:hidden;">
      <tbody>${showRows}</tbody>
    </table>

    <p style="margin:32px 0 0;text-align:center;">
      <a href="${SITE_URL}" style="color:#71717a;font-size:13px;text-decoration:none;">Visit Episodic →</a>
    </p>
  </div>
</body>
</html>`;

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: "Episodic <onboarding@resend.dev>",
    to: reportEmail,
    subject: `Episodic · ${total.toLocaleString()} views this week`,
    html,
  });

  return NextResponse.json({ ok: true, total, shows: shows.length });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!resendKey || !fromEmail) return json({
    error: "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
  }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      serviceKey = (keys.default || Object.values(keys)[0]) as string;
    } catch { /* handled below */ }
  }
  if (!supabaseUrl || !serviceKey) return json({ error: "Database service credentials are unavailable." }, 500);

  let body: { code?: string; name?: string; phone?: string; method?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const phone = String(body.phone || "").replace(/\D/g, "");
  const method = String(body.method || "").trim().toLowerCase();
  if (!code || name.length < 2 || name.length > 100 || !/^[6-9]\d{9}$/.test(phone) ||
      !["code", "qr", "face"].includes(method)) return json({ error: "Invalid access details." }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let event: any = null;
  const { data: byCode, error: codeError } = await admin.from("events")
    .select("id,name,client_id,status").eq("status", "active")
    .eq("access_code", code.toUpperCase()).maybeSingle();
  if (codeError) return json({ error: "Could not look up the event." }, 500);
  event = byCode;
  if (!event) {
    const { data: byQr, error: qrError } = await admin.from("events")
      .select("id,name,client_id,status").eq("status", "active")
      .eq("qr_token", code).maybeSingle();
    if (qrError) return json({ error: "Could not look up the event." }, 500);
    event = byQr;
  }
  if (!event) return json({ error: "Event not found." }, 404);

  const { data: log, error: logError } = await admin.from("gallery_access_logs")
    .select("id,created_at").eq("event_id", event.id).eq("visitor_name", name)
    .eq("phone", phone).eq("access_method", method)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (logError) return json({ error: "Could not verify the access record." }, 500);
  if (!log) return json({ error: "No recent matching gallery access record." }, 403);
  if (!event.client_id) return json({ ok: true, skipped: "No client is linked to this event." });

  const { data: client, error: clientError } = await admin.from("clients")
    .select("name,email").eq("id", event.client_id).maybeSingle();
  if (clientError) return json({ error: "Could not load the client contact." }, 500);
  if (!client?.email) return json({ ok: true, skipped: "The client has no email address saved." });

  const eventName = String(event.name || "Event gallery");
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail, to: [client.email], subject: `Gallery accessed: ${eventName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033">
        <h2>Gallery access notification</h2><p>Your Markipie gallery <strong>${escapeHtml(eventName)}</strong> was accessed.</p>
        <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Visitor name</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Mobile number</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Access method</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(method.toUpperCase())}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd"><strong>Time (UTC)</strong></td><td style="padding:8px;border:1px solid #ddd">${new Date().toISOString()}</td></tr>
        </table><p style="color:#667085;font-size:12px">Automated notification from Markipie.</p></div>`,
      text: `Gallery access notification\nGallery: ${eventName}\nVisitor: ${name}\nMobile: ${phone}\nAccess method: ${method.toUpperCase()}\nTime (UTC): ${new Date().toISOString()}`,
    }),
  });
  const result = await sent.json().catch(() => ({}));
  if (!sent.ok) return json({ error: "Email provider rejected the message.", details: result }, 502);
  return json({ ok: true, sent: true, emailId: result.id });
});

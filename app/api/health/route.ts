export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, where: "contactful-app", ts: new Date().toISOString() });
}

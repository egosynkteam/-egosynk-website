// Local stand-in for netlify/functions/drop-waitlist.js, so the form can be tried in
// `next dev` without writing to the real list. Disabled in production builds.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(b.email || ""))) {
    return Response.json({ error: "Enter a valid email" }, { status: 400 });
  }
  await new Promise((r) => setTimeout(r, 600));
  return Response.json({ ok: true, position: 128 });
}

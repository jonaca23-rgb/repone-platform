// Reads mail from the local Mailpit (supabase config [inbucket], UI :54524).
const API = "http://127.0.0.1:54524/api/v1";

export async function latestEmailTo(address: string) {
  const res = await fetch(`${API}/search?query=${encodeURIComponent(`to:${address}`)}&limit=1`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const { messages } = (await res.json()) as { messages: Array<{ ID: string; Subject: string }> };
  if (!messages.length) return null;
  const msg = (await (await fetch(`${API}/message/${messages[0].ID}`)).json()) as {
    Subject: string;
    Text: string;
  };
  const links = [...msg.Text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
  return { subject: msg.Subject, text: msg.Text, links };
}

export async function clearMailbox() {
  await fetch(`${API}/messages`, { method: "DELETE" });
}

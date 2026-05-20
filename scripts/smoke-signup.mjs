import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase public env values");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14);
const email = `expeer-smoke-${stamp}@gmail.com`;
const password = `ExpeerSmoke!${stamp}`;
const nickname = `스모크테스트-${stamp}`;

const signUp = await supabase.auth.signUp({
  email,
  password,
  options: { data: { nickname }, emailRedirectTo: "http://localhost:8080/app" },
});

if (signUp.error) throw signUp.error;
if (!signUp.data.user) {
  console.log(JSON.stringify({ signup: "blocked", email, rawData: signUp.data }, null, 2));
  throw new Error(
    "signUp did not return a user. Check Supabase Auth email provider, email confirmation, or abuse protection settings.",
  );
}

const userId = signUp.data.user.id;

if (!signUp.data.session) {
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
}

await new Promise((resolve) => setTimeout(resolve, 1000));

const profile = await supabase
  .from("profiles")
  .select("id,email,nickname")
  .eq("id", userId)
  .maybeSingle();
const roles = await supabase.from("user_roles").select("role").eq("user_id", userId);

console.log(
  JSON.stringify(
    {
      signup: "ok",
      email,
      userId,
      sessionReturned: !!signUp.data.session,
      profile: { ok: !profile.error, data: profile.data, error: profile.error?.message },
      roles: { ok: !roles.error, data: roles.data, error: roles.error?.message },
    },
    null,
    2,
  ),
);

await supabase.auth.signOut();

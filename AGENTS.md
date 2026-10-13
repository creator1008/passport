<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent

Node.js and npm are already on the image. `scripts/cloud-agent-install.sh` installs dependencies and the Supabase CLI. `scripts/cloud-agent-start.sh` starts a local Supabase stack and the Next.js dev server at http://127.0.0.1:3000.

Local Supabase uses the native CLI runtime (no Docker). Configuration is `supabase/config.toml` with `[experimental] stack = true`. The start script writes `.env.local` from `supabase status` only when that file is missing. Do not commit `.env.local`.

`OPENAI_API_KEY` is optional. Passport MRZ and OCR run without it. Career-certificate GPT extraction needs the key in the environment.

CI runs `npm ci` and `npm run build`.

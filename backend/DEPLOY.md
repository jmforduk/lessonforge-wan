# Deploying the AI Showrunner backend to Alibaba Cloud Function Compute

This backend holds the DashScope key server-side and proxies Qwen (chat) + Wan (video).
It's a Node HTTP server that listens on `$FC_SERVER_PORT` — deployed as an FC 3.0
**custom-runtime web function** via [Serverless Devs](https://www.serverless-devs.com/).

## One-time setup

1. **Install Serverless Devs**
   ```bash
   npm i -g @serverless-devs/s
   ```

2. **Get Alibaba Cloud AccessKeys**
   Alibaba Cloud console → your avatar → **AccessKey Management** → *Create AccessKey*.
   (A RAM sub-user with `AliyunFCFullAccess` is the safer choice for production.)

3. **Register the credentials with `s`**
   ```bash
   s config add
   # Provider: Alibaba Cloud (alibaba)
   # AccessKey ID / AccessKey Secret: paste yours
   # Alias: default   (matches `access: default` in s.yaml)
   ```

## Deploy

```bash
cd backend
export DASHSCOPE_API_KEY=sk-...     # your Model Studio (DashScope) key — Singapore/Intl region
s deploy -y
```

Serverless Devs prints the function's **public HTTP URL** when it finishes.

## Wire up + verify (this is your judging "deployment proof")

1. Copy that URL into the app → **Settings → Alibaba Cloud backend URL**.
2. Test it:
   ```bash
   curl https://<your-fc-url>/healthz
   # → { "ok": true, "keyPresent": true, "region": "intl", ... }
   ```
3. In the app, hit **Test connection** — it checks the backend + Qwen + Wan reachability.

## Notes

- **Region:** `s.yaml` uses `ap-southeast-1` (Singapore) to match the DashScope
  *International* endpoints the backend calls. If your DashScope key is a Mainland
  China key, switch the backend base URLs in `index.mjs` to `dashscope.aliyuncs.com`
  and pick a China FC region (e.g. `cn-hangzhou`).
- **Secret safety:** `DASHSCOPE_API_KEY` is injected from your shell at deploy time
  via `${env('DASHSCOPE_API_KEY')}` and stored as an FC environment variable. It is
  never committed to git and never sent to the browser.
- **Cost/scale:** defaults are 0.5 vCPU / 1 GB / 300s timeout / concurrency 5 —
  plenty for a demo. Tune in `s.yaml`.
- **Redeploy:** just `s deploy -y` again. Remove everything with `s remove -y`.

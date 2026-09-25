# Security

Satori is built to run on your own computer for your own use. It has **no login**: anyone who can open its address can see and change every profile, download or restore the whole database, and use the AI features you set up (on your API key).

## Defaults that keep it private

- `npm run dev` and `npm start` listen on `127.0.0.1` only, so other devices on your network can't reach Satori.
- `docker compose` publishes the port on `127.0.0.1` only, for the same reason.
- The AI tutor endpoint rejects requests from other websites, so a page you visit can't spend your API credits through your local Satori.
- Your data (`data/`, `.env.local` and any other `.env*` file) is git-ignored and never leaves your machine, except for requests to the optional AI provider, the OpenSAT importer and the Desmos calculator script.

## Sharing on your home network (at your own risk)

If you want to use Satori from another device, such as a tablet on the same Wi-Fi, start it with an explicit host:

```bash
npx next dev -H 0.0.0.0
```

For Docker, change the port line in `docker-compose.yml` to `"3000:3000"`. Only do this on a network you trust. **Never expose Satori to the public internet.** If you really need remote access, put it behind something that adds authentication, such as a VPN like Tailscale or a reverse proxy with a login.

## Keep your keys out of git

Put API keys in `.env.local` only. Never put them in `.env.example`, in the code or in an issue. If a key is ever committed or pasted publicly, revoke it at the provider straight away. Deleting the commit is not enough.

## Reporting a vulnerability

Please don't open a public issue for security problems. Use GitHub's **private vulnerability reporting** instead: the "Report a vulnerability" button on the repository's Security tab. Include the steps to reproduce the problem and its impact.

# Events - DLE (Family Life Tracker)

## Deployment Info

**Status:** ✅ Live
**Folder:** `/events`
**Theme:** Daily life events tracker for families

## URLs
- **Frontend:** https://events.twozao.com
- **API:** https://events-api.twozao.com

## Tech Stack
- **Frontend:** Svelte 5 + Vite
- **Backend:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (images/attachments)
- **AI:** Cloudflare Workers AI (Whisper, Llama)

## Cloudflare Resources
| Resource | Name | ID |
|----------|------|-----|
| Pages Project | `dle-app` | - |
| Worker | `dle-backend` | - |
| D1 Database | `dle-db` | `1f381228-5065-4e26-801f-92916657cab3` |
| R2 Bucket | `dle-storage` | - |

## Deploy
```bash
./deploy-app.sh events
```

## Key Features
- **Family Event Calendar** for birthdays, anniversaries, milestones
- **Photo/Attachment Storage** via R2
- **Voice Recording** with Whisper transcription
- **Event Notifications** and reminders
- **Rich Event Details** (description, location, attendees)
- **Collaboration** for family members

## For Complete Details
See: [../Deployed.md](../Deployed.md) and [../Ideas/docs/CLOUDFLARE_SETUP.md](../Ideas/docs/CLOUDFLARE_SETUP.md)

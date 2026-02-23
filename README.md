# DLE (Daily Life Events) - Family Life Tracker

A personal family life management app with diary notes, habit tracking, and voice recordings.

## Live URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://events.twozao.com |
| **API Backend** | https://events-api.twozao.com |
| **Pages Fallback** | https://dle-app.pages.dev |

---

## Features

### 1. Personal Diary
- Create notes for life events (medical visits, prescriptions, appointments)
- Tag people involved in each note
- Categorize notes (Health, Medical, Prescription, Family, etc.)
- Upload photos/documents
- Search and filter notes
- Set importance levels

### 2. Family Habit Tracker
- Track daily habits for each family member
- Visual progress rings showing completion
- 30-day statistics with streaks
- Default habits for health tracking:
  - Morning/Evening Medicine
  - Blood Pressure Check
  - Blood Sugar Check
  - Exercise, Water Intake, Sleep
  - Vitamins, Meditation
- Add custom habits with icons and colors
- Add notes to habit logs

### 3. Voice Recordings (Telegram Bot)
- Send voice messages via Telegram
- Auto-transcription using Whisper AI
- AI extraction of key information (summary, category, entities)
- Listen to recordings in-app

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Svelte 5, Vite, TypeScript |
| **Backend** | Hono.js on Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 (photos, audio) |
| **AI** | Cloudflare Workers AI (Whisper, Llama 3) |
| **Hosting** | Cloudflare Pages (frontend), Workers (API) |

---

## Cloudflare Resources

| Resource | Name | ID |
|----------|------|----|
| **D1 Database** | dle-db | `1f381228-5065-4e26-801f-92916657cab3` |
| **R2 Bucket** | dle-storage | - |
| **Worker** | dle-backend | - |
| **Pages Project** | dle-app | - |
| **Account ID** | - | `775cda1f8655ad744432a83e98b7d304` |

---

## Project Structure

```
events/
├── backend/
│   ├── src/
│   │   └── index.ts          # Hono API routes
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_diary_features.sql
│   │   └── 0003_habits_tracker.sql
│   ├── wrangler.json         # Cloudflare Worker config
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/Admin/
│   │   │   ├── Dashboard.svelte
│   │   │   ├── DiaryTab.svelte
│   │   │   ├── HabitsTab.svelte
│   │   │   └── EventsTab.svelte
│   │   └── lib/stores.ts     # Svelte stores & API functions
│   ├── vite.config.ts
│   └── package.json
├── deploy.sh                 # Deployment script
└── README.md
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login (admin/admin) |

### People
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/people` | List all people |
| GET | `/api/people/:id` | Get person with notes |
| POST | `/api/people` | Create person |
| PUT | `/api/people/:id` | Update person |
| DELETE | `/api/people/:id` | Delete person |

### Diary Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | List notes (with filters) |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| POST | `/api/notes/:id/photos` | Upload photo |

### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create tag |
| DELETE | `/api/tags/:id` | Delete tag |

### Habits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/people/:id/habits` | List habits for person |
| GET | `/api/people/:id/habits/today` | Today's habits with status |
| POST | `/api/people/:id/habits` | Create habit |
| POST | `/api/people/:id/habits/init-defaults` | Initialize default habits |
| PUT | `/api/habits/:id` | Update habit |
| DELETE | `/api/habits/:id` | Delete habit |
| POST | `/api/habits/:id/toggle` | Toggle habit completion |
| POST | `/api/habits/:id/log` | Add note to habit log |
| GET | `/api/people/:id/habit-stats` | Get 30-day statistics |
| GET | `/api/family-habits-summary` | Family overview |

### Search & Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=` | Search notes and people |
| GET | `/api/categories` | Get categories with counts |

### Voice Events (Telegram)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List voice events |
| GET | `/api/event-data` | Get extracted data |
| POST | `/api/telegram-webhook` | Telegram bot webhook |

---

## Deployment

### Quick Deploy (Recommended)

```bash
cd events
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment

#### 1. Deploy Backend
```bash
cd backend
npm install
npx wrangler deploy
```

#### 2. Deploy Frontend
```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name dle-app
```

### Database Migrations

Run migrations when schema changes:
```bash
cd backend

# Apply all migrations
npx wrangler d1 execute dle-db --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute dle-db --remote --file=migrations/0002_diary_features.sql
npx wrangler d1 execute dle-db --remote --file=migrations/0003_habits_tracker.sql
```

---

## Custom Domain Setup

### API Domain (events-api.twozao.com)

Already configured in `wrangler.json`:
```json
{
    "routes": [
        {
            "pattern": "events-api.twozao.com",
            "zone_name": "twozao.com",
            "custom_domain": true
        }
    ]
}
```

Deploy the worker to activate:
```bash
cd backend && npx wrangler deploy
```

### Frontend Domain (events.twozao.com)

1. Go to **Cloudflare Dashboard** > **Workers & Pages**
2. Select **dle-app** project
3. Click **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `events.twozao.com`
6. Click **Continue** - Cloudflare auto-creates DNS record
7. Wait for SSL certificate (~1-5 minutes)

---

## Local Development

### Backend
```bash
cd backend
npm install
npx wrangler dev
# API runs at http://localhost:8787
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
```

### Configure Proxy (Development)

`frontend/vite.config.ts` proxies `/api` to localhost:8787 during development.

---

## Environment Variables

### Backend (wrangler.json bindings)
- `DB` - D1 Database binding
- `BUCKET` - R2 Storage binding
- `AI` - Workers AI binding
- `TELEGRAM_BOT_TOKEN` - Set via wrangler secret

### Set Telegram Token
```bash
cd backend
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Enter your bot token when prompted
```

---

## Troubleshooting

### CORS Errors
The backend allows all origins (`origin: '*'`). If issues persist:
1. Check browser console for specific error
2. Verify API URL is correct in `stores.ts`

### Custom Domain Not Working
1. Verify domain is on Cloudflare DNS
2. Check Workers & Pages > Custom domains status
3. Wait for SSL provisioning (up to 5 minutes)
4. Try `npx wrangler tail` to see worker logs

### Database Errors
```bash
# Check database exists
npx wrangler d1 list

# View tables
npx wrangler d1 execute dle-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Roadmap

- [ ] Multi-user authentication
- [ ] Family sharing/invites
- [ ] Notifications/reminders
- [ ] Data export
- [ ] Mobile app (PWA)
- [ ] Calendar view for habits
- [ ] Voice input for diary notes

---

## License

Private project - Not for public distribution.

# OpsHero Admin Panel

Admin dashboard for OpsHero platform management.

## Features

- 🔐 Email + Password + TOTP 2FA authentication
- 👥 User management (suspend, activate, change tier)
- 📚 Pattern management (CRUD operations)
- 🤖 Auto-learning system monitoring
- 💰 Billing & revenue tracking
- 📊 Platform metrics dashboard
- 📧 Email management
- 🔍 Audit logs
- 📢 Announcements management

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deploy on Vercel

```bash
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_SECRET`

## Security

⚠️ **IMPORTANT**: This admin panel should be deployed on a separate domain/subdomain:
- Dashboard: `opshero.vercel.app`
- Admin: `opshero-admin.vercel.app`

Never link to the admin panel from the user dashboard.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui

## License

MIT

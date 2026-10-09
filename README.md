# AlphaFooty Engine

Production football opportunity scanner, bet journal, and analytics dashboard.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- SQLite via Prisma ORM
- Recharts + Lucide React
- Live fixture ingestion from ESPN public scoreboards (Sofascore / TheSportsDB fallbacks)

## Modules

1. **Opportunity Scanner** — Strategy D halftime 0-0 trigger, goal-volume engine, corner compression
2. **Bet Journal** — calendar + multi-leg slip logger with Tanzania 12% withholding tax math
3. **Analytics** — bankroll KPIs, equity curve, strategy breakdown, trade ledger

## Local setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

App runs at [http://localhost:3080](http://localhost:3080).

## Production

```bash
npm install
npx prisma migrate deploy
npm run build
PORT=3080 npm start
```

Use PM2:

```bash
pm2 start npm --name alphafooty-engine -- start
```

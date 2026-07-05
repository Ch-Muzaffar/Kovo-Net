# Kovo-Net Backend

Human-First Knowledge Network — Backend API built on the PRD/TRD specification.

## Architecture

| Layer          | Technology                    |
| -------------- | ----------------------------- |
| Runtime        | Node.js 18+ (Express)        |
| Database + Auth| Supabase (PostgreSQL + JWT)  |
| Media          | Cloudinary (presigned direct) |
| Moderation     | OpenAI Moderation API         |
| Validation     | Zod                           |
| Hosting        | Vercel Hobby / Docker         |

## Quick Start

\`\`\`bash
cp .env.example .env          # Fill in your keys
npm install                    # Install dependencies
npm run db:push               # Run schema.sql in Supabase SQL Editor
npm run dev                    # Start development server
\`\`\`

## API Endpoints

| Method | Path                        | Auth  | Description              |
| ------ | --------------------------- | ----- | ------------------------ |
| GET    | /api/v1/health              | No    | Health check             |
| POST   | /api/v1/auth/refresh        | No    | Refresh access token     |
| POST   | /api/v1/auth/onboard        | Yes   | Step 2 — Demographics    |
| POST   | /api/v1/auth/accept-tos     | Yes   | Step 3 — Accept ToS      |
| POST   | /api/v1/auth/logout         | Yes   | Blacklist JWT            |
| GET    | /api/v1/auth/me             | Yes   | Current user + status    |
| GET    | /api/v1/users/me            | Yes   | Own profile              |
| PATCH  | /api/v1/users/me/profile    | Yes   | Enrichment data          |
| PATCH  | /api/v1/users/me/demographics| Yes  | Basic demographics       |
| GET    | /api/v1/users/me/points     | Yes   | Points + level           |
| GET    | /api/v1/users/me/ledger     | Yes   | Ledger history           |
| GET    | /api/v1/users/:userId       | Yes   | Public profile           |
| GET    | /api/v1/feed                | Yes   | 70/30 feed algorithm     |
| POST   | /api/v1/posts               | Yes   | Create post              |
| GET    | /api/v1/posts/:postId       | Yes   | Single post              |
| PATCH  | /api/v1/posts/:postId       | Yes   | Update post              |
| DELETE | /api/v1/posts/:postId       | Yes   | Delete post              |
| GET    | /api/v1/posts/user/:userId  | Yes   | User's posts             |
| POST   | /api/v1/posts/:postId/comments | Yes | Add comment            |
| GET    | /api/v1/posts/:postId/comments | Yes | List comments          |
| DELETE | /api/v1/posts/:postId/comments/:commentId | Yes | Delete comment |
| POST   | /api/v1/ledger/award        | Yes   | Mark comment helpful     |
| POST   | /api/v1/messages            | Yes   | Send DM                  |
| GET    | /api/v1/messages/conversations | Yes | Conversation list     |
| GET    | /api/v1/messages/conversation/:otherUserId | Yes | DM thread |
| POST   | /api/v1/reports             | Yes   | Report content           |
| GET    | /api/v1/notifications       | Yes   | Notification list        |
| PATCH  | /api/v1/notifications/:id/read | Yes | Mark read             |
| PATCH  | /api/v1/notifications/read-all | Yes | Mark all read         |
| GET    | /api/v1/uploads/presign     | Yes   | Cloudinary presign URL   |
| GET    | /api/v1/admin/reports       | Admin | Pending reports          |
| PATCH  | /api/v1/admin/reports/:id   | Admin | Resolve report           |
| PATCH  | /api/v1/admin/users/:id/ban | Admin | Ban/unban user           |
| GET    | /api/v1/admin/users         | Admin | List all users           |

## Security Checklist Coverage

Every item from the Backend Problems Checklist is addressed. See inline code comments for details.

## Testing

\`\`\`bash
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration# Integration tests only
npm run test:security   # Security tests only
\`\`\`

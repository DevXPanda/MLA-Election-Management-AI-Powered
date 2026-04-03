# MLA Election Management System

Full-stack election management platform built for MLA constituency operations. Supports multi-tenant organizations with role-based access control, real-time updates, and analytics dashboards.

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS  |
| Backend  | Node.js, Express, PostgreSQL (Supabase)          |
| Realtime | Socket.IO                                        |
| Auth     | JWT + bcrypt                                     |
| Charts   | Chart.js + react-chartjs-2                       |

## Features

- **Role-Based Dashboards** — Admin, Manager, MLA, Ward Head, Worker each get a tailored view
- **Voter Management** — Track and manage voter records by constituency/ward
- **Constituency & Booth Mapping** — Organize wards, booths, and geographic data
- **Team Management** — Create teams with hierarchical assignments
- **Task Tracking** — Assign and monitor field tasks
- **Survey System** — Create and collect survey responses
- **Event Management** — Schedule and track campaign events
- **Messaging** — Internal communication between team members
- **Media Gallery** — Upload and manage campaign media (via Multer)
- **Analytics & Reports** — Visual dashboards with booth-strength analysis
- **Real-Time Notifications** — Live updates via Socket.IO
- **Multi-Tenancy** — Org-scoped data isolation
- **Dark/Light Theme** — User-switchable theme

## Project Structure

```
MLA Election Management/
├── backend/
│   ├── config/          # Database connection
│   ├── controllers/     # Route handlers (13 modules)
│   ├── middleware/       # Auth, RBAC, Tenant isolation
│   ├── models/          # PostgreSQL table definitions
│   ├── routes/          # Express route definitions
│   ├── utils/           # Helper functions
│   ├── server.js        # App entry point (port 5000)
│   └── seed.js          # Database seeder
├── frontend/
│   └── src/
│       ├── app/         # Next.js App Router pages
│       │   ├── login/
│       │   └── dashboard/
│       │       ├── constituency/
│       │       ├── events/
│       │       ├── media/
│       │       ├── messages/
│       │       ├── reports/
│       │       ├── surveys/
│       │       ├── tasks/
│       │       ├── teams/
│       │       ├── users/
│       │       └── voters/
│       ├── components/  # Shared + role-based dashboard components
│       ├── context/     # Auth & Theme providers
│       ├── lib/         # API client & Socket.IO client
│       └── types/       # TypeScript type definitions
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database (or Supabase project)

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```
DB_HOST=your_db_host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Seed the database and start the server:

```bash
npm run seed
npm run dev
```

Backend runs at **http://localhost:5000**

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

## API Endpoints

| Prefix               | Module         |
| --------------------- | -------------- |
| `/api/auth`           | Authentication |
| `/api/users`          | User Management|
| `/api/constituency`   | Constituencies |
| `/api/teams`          | Teams          |
| `/api/tasks`          | Tasks          |
| `/api/surveys`        | Surveys        |
| `/api/events`         | Events         |
| `/api/voters`         | Voters         |
| `/api/dashboard`      | Dashboard Stats|
| `/api/messages`       | Messaging      |
| `/api/media`          | Media Uploads  |
| `/api/analytics`      | Analytics      |
| `/api/notifications`  | Notifications  |
| `/api/health`         | Health Check   |

## User Roles

| Role       | Access Level                              |
| ---------- | ----------------------------------------- |
| Admin      | Full system access, org management        |
| Manager    | Team oversight, reports, user management  |
| MLA        | Constituency overview, analytics          |
| Ward Head  | Ward-level operations and team management |
| Worker     | Field tasks, voter data entry, surveys    |

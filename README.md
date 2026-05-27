# Student Support Chat

A full-stack support chat application where students can log in and start conversations, and support/sales team members can assign, reassign, and reply to those conversations in realtime.

This project is built as a complete solution for the **Intern Project: Student Support Chat** test of competence.

---

## 🚀 Deployed URLs

- **Frontend (Cloudflare Pages)**: [https://student-support-chat.pages.dev](https://student-support-chat.pages.dev)
- **Backend API (Cloudflare Workers)**: [https://student-support-chat-worker.workers.dev](https://student-support-chat-worker.workers.dev)

---

## 🛠️ Stack

- **Frontend**: Vite + React + TypeScript + React Router + TanStack Query
- **Backend**: Cloudflare Workers + Hono
- **Database / Auth / Realtime**: Supabase (Postgres + Supabase Auth + Supabase Realtime Channels)
- **Styling**: Tailwind CSS + Custom theme variables supporting light/dark theme normalization (Linear/Stripe-style light mode, polished dark mode).

---

## 🔑 Demo Users & Roles

Since the app integrates with Supabase Auth, you can register new users directly through the **Sign Up** mode on the login screen. The app supports role-selection upon signup to automatically assign roles:
- **Student**: Registers with `student` role. Can create threads and send/receive messages.
- **Sales User**: Registers with `sales` role. Can see unassigned tickets, assign tickets to themselves, and reply.
- **Manager**: Registers with `manager` role. Can view all tickets, reassign tickets to any sales user, and reply.

---

## 📂 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts          # Hono entry point
│   │   ├── middleware/
│   │   │   └── auth.ts       # Supabase JWT verify & profile resolver
│   │   ├── routes/
│   │   │   ├── conversations.ts # Thread CRUD & assign endpoints
│   │   │   ├── messages.ts      # Message send endpoints
│   │   │   └── users.ts         # User profiles info
│   │   └── lib/
│   │       └── supabaseAdmin.ts # Service role database client
│   ├── wrangler.toml         # Wrangler deployment setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── index.css         # Styling system & theme custom variables
│   │   ├── main.tsx
│   │   ├── lib/
│   │   │   ├── apiClient.ts  # Fetch client wrapper with Auth header
│   │   │   └── supabase.ts   # Supabase client setup
│   │   └── pages/
│   │       ├── LoginPage.tsx        # Login & Signup view
│   │       ├── StudentInboxPage.tsx # Student dashboard
│   │       ├── SalesInboxPage.tsx   # Sales/support representative panel
│   │       └── ManagerQueuePage.tsx # Manager queue and reassignment console
│   └── package.json
└── README.md
```

---

## ⚙️ Setup & Installation

### 1. Database Setup (Supabase)

Create the necessary tables, types, and indexes in your Supabase project using the SQL Editor:

```sql
-- Create custom enums
create type app_role as enum ('student', 'sales', 'manager');
create type conversation_status as enum ('open', 'pending', 'closed');
create type message_sender_type as enum ('student', 'team');

-- Profiles Table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Conversation Threads Table
create table conversation_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  subject text not null,
  status conversation_status not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages Table
create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references conversation_threads(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_type message_sender_type not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Assignment Logging Events
create table conversation_assignment_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references conversation_threads(id) on delete cascade,
  assigned_by uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Enable Realtime for tables (essential for messages and threads status)
alter publication supabase_realtime add table conversation_messages;
alter publication supabase_realtime add table conversation_threads;

-- Recommended Indexes
create index conversation_threads_student_id_idx on conversation_threads(student_id);
create index conversation_threads_assigned_to_idx on conversation_threads(assigned_to);
create index conversation_threads_status_idx on conversation_threads(status);
create index conversation_threads_last_message_at_idx on conversation_threads(last_message_at desc);
create index conversation_messages_thread_id_created_at_idx on conversation_messages(thread_id, created_at);
```

### 2. Backend Setup (`backend/`)

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.dev.vars` (for local development):
   ```ini
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
4. Start the local Worker server:
   ```bash
   npx wrangler dev --port 8787
   ```

### 3. Frontend Setup (`frontend/`)

1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Configure variables in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-publishable-key-here
   VITE_API_URL=http://localhost:8787
   ```
5. Start the frontend Vite dev server:
   ```bash
   npm run dev
   ```

---

## ☁️ Cloudflare Deployment

### Deploy Backend Worker

1. Authenticate with Wrangler:
   ```bash
   npx wrangler login
   ```
2. Add secret credentials for production environment:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
3. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```

### Deploy Frontend Pages

1. Build the production assets:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy the `dist/` directory directly to Cloudflare Pages via CLI or connect the repository to the Cloudflare Pages dashboard for automatic Git deployment.
   Make sure you specify the environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (points to the deployed backend worker URL)

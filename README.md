# 💬 SupportChat — Student Support Chat Application

A full-stack real-time support chat application built for the **Intern Test of Competence**. Students can open support conversations, and a sales/support team can assign, reply, and manage those conversations in real-time.

---

## 🌐 Live Demo

| | URL |
|---|---|
| 🖥️ **Frontend** | https://student-support-chat-cdw.pages.dev |
| ⚙️ **Backend API** | https://student-support-chat-worker.meeeghy.workers.dev |
| 📦 **GitHub Repo** | https://github.com/Meeeghy/student-support-chat |

---

## 👥 Demo Users

Use these accounts to test all roles. All accounts use the same password: `Test1234`

| Role | Email | Password | What they can do |
|------|-------|----------|-----------------|
| 🎓 Student | student1@gmail.com | Test1234 | Create conversations, send messages, see replies |
| 💼 Sales | sales1@gmail.com | Test1234 | See unassigned conversations, assign to self, reply, close |
| 👑 Manager | meryem@gmail.com | Test1234 | See all conversations, reassign to any sales user, reopen closed |

---

## 🔐 How to Test All Roles

There are **two ways** to test the app:

**Option 1 — Use existing demo accounts:**

| Role | Email | Password |
|------|-------|----------|
| 🎓 Student | student1@gmail.com | Test1234 |
| 💼 Sales | sales1@gmail.com | Test1234 |
| 👑 Manager | meryem@gmail.com | Test1234 |

**Option 2 — Create your own accounts:**

1. Go to the live app: https://student-support-chat-cdw.pages.dev
2. Click **Sign Up**
3. Select your role (Student, Sales, or Manager)
4. Fill in your name, email and password
5. You will be redirected to the correct dashboard automatically

> 💡 The role selector on signup is intentionally kept open so reviewers can easily test all three roles without needing to use pre-created accounts.

---

## ✨ Features

### 🎓 Student
- Sign up and log in
- Create support conversations with a subject and message
- Send and receive messages in real-time
- View conversation status (open / pending / closed)

### 💼 Sales User
- View all unassigned conversations
- Assign a conversation to themselves
- Reply to assigned conversations
- Update conversation status (pending / closed)

### 👑 Manager
- View ALL conversations
- Reassign any conversation to any sales user
- Reopen closed conversations

### ⚡ Technical Highlights
- Real-time messages without page refresh (Supabase Realtime)
- Role-based access control enforced on the backend
- JWT authentication on every API request
- Protected routes based on user role
- Loading, empty, and error states on all pages
- Clean professional UI with dark theme

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| State Management | TanStack Query |
| Routing | React Router v6 |
| Backend | Cloudflare Workers + Hono |
| Database | Supabase Postgres |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| Deployment | Cloudflare Pages + Workers |

---

## 📁 Project Structure

```
student-support-chat/
├── frontend/              # Vite + React app
│   ├── src/
│   │   ├── pages/         # LoginPage, StudentInboxPage, SalesInboxPage, ManagerQueuePage
│   │   ├── lib/           # supabaseClient, apiClient, realtime
│   │   └── app/           # router, queryClient
│   └── .env               # environment variables
└── backend/               # Cloudflare Worker + Hono
    ├── src/
    │   ├── routes/        # conversations, messages, users
    │   ├── middleware/    # auth (JWT verification)
    │   └── lib/           # supabaseAdmin
    └── wrangler.toml
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- A Supabase project
- A Cloudflare account

### 1. Clone the repository
```bash
git clone https://github.com/Meeeghy/student-support-chat.git
cd student-support-chat
```

### 2. Setup the backend
```bash
cd backend
npm install
```
Create a `.dev.vars` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
```
Start the backend:
```bash
npx wrangler dev
```
Backend runs at: `http://localhost:8787`

### 3. Setup the frontend
```bash
cd frontend
npm install
```
Create a `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8787
```
Start the frontend:
```bash
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## ☁️ Deployment

### Backend (Cloudflare Workers)
```bash
cd backend
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

### Frontend (Cloudflare Pages)
```bash
cd frontend
npm run build
# Upload the dist/ folder to Cloudflare Pages
```

---

## 📋 Environment Variables

### Frontend `.env`
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable key |
| `VITE_API_URL` | Backend Worker URL |

### Backend `.dev.vars`
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase secret key |

---

## 📝 Submission Details

- **Position**: Intern
- **Repo**: https://github.com/Meeeghy/student-support-chat
- **Frontend**: https://student-support-chat-cdw.pages.dev
- **Backend API**: https://student-support-chat-worker.meeeghy.workers.dev
- **Deadline**: 1st June, 2026

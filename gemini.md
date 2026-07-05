# KOVO NET — Knowledge Network Platform

Welcome to the official developer documentation for **KOVO NET** (formerly Kovo-Net). This document serves as a comprehensive guide to the platform's brand identity, architectural design, technical stack, directory structure, and development workflows.

---

## 🌟 Project Vision & Core Branding

KOVO NET is a **human-first knowledge network** designed to solve complex student and professional problems where AI falls short. By combining community expertise with a sleek, modern interface, KOVO connects users across multiple departments to exchange genuine insights.

### 🎨 Brand Identity Guidelines
To maintain visual consistency across all views:
1. **Stacked Typography Logo**: 
   * **KOVO** (Primary: Large, Bold, Tracking-Tight, `Plus Jakarta Sans`).
   * **NET** (Secondary: Small, Uppercase, Tracking-Wide/Spaced, written directly below "KOVO").
2. **KN Circular Emblem**: A rounded container displaying "KN" using the application gradient.
3. **Glassmorphism Theme**: Floating UI panels, tooltips, sidebars, and headers utilize semi-translucent backdrops (`backdrop-filter: blur(24px) saturate(200%)`) with soft borders and inset drop shadows.
4. **Vercel Ecosystem**: Performance-oriented optimization using built-in analytics and site speed auditing.

---

## 🛠 Tech Stack

### Frontend (SPA)
* **Core Library**: React (v18)
* **Build System**: Vite
* **Styling**: Vanilla CSS custom themes (Light/Dark mode) combined with utility classes (via Tailwind CSS CDN).
* **Icons**: Iconify Engine featuring the premium **Solar Bold Duotone** icon set.
* **Integrations**: Vercel Web Analytics & Vercel Speed Insights.

### Backend (REST & WebSocket)
* **Runtime**: Node.js (>=18.0.0)
* **Framework**: Express.js
* **Database**: Supabase PostgreSQL client (or an automated in-memory **Mock Database** fallback for local-first developer builds).
* **Security & Reliability**: 
  * Rate-limiting (`express-rate-limit`) configured to support rapid sequential onboarding.
  * Trust proxy configurations for serverless cloud environments (e.g. Vercel).
  * CORS & Helmet protection.
* **Real-time communication**: Native experimental WebSockets.

---

## 📁 Directory Structure

```
d:/Kovo-Net/
├── kovo_frontend/               # React SPA Frontend
│   ├── src/
│   │   ├── api/                 # API connection configurations
│   │   ├── assets/              # Static media assets & SVG branding logos
│   │   ├── components/          # Reusable UI elements (Sidebar, Icon, KovoBrand, etc.)
│   │   ├── context/             # AppContext (global navigation state, theme toggles, auth data)
│   │   ├── utils/               # Styling helpers, avatar gradients, and level calculations
│   │   ├── views/               # Screen components (Landing, Login, Register, Feed)
│   │   ├── App.jsx              # Main view manager
│   │   ├── index.css            # Stylesheets, variables, custom responsive breakpoints, and glass buttons
│   │   └── main.jsx             # Entry point (initializing Vercel tools, AppContext, React root)
│   ├── package.json
│   └── vite.config.js
│
├── kovo_backend/                # Express API Backend
│   ├── src/
│   │   ├── config/              # Server configuration and environment variable validation (Zod)
│   │   ├── controllers/         # Request handling logic (auth, connections, posts, profile)
│   │   ├── db/                  # Supabase clients, schema scripts, and local mock database implementation
│   │   ├── middleware/          # Rate limiters, security guards, CORS, and auth verifiers
│   │   ├── routes/              # Express API endpoints
│   │   ├── server.js            # Entry point for the server
│   │   └── app.js               # Express application initialization
│   └── package.json
│
└── gemini.md                    # Project documentation (this file)
```

---

## 🔐 Onboarding & Auth Flow

KOVO features a state-heavy registration and onboarding workflow built to ensure a high-trust, safe community:
1. **Register**: User creates credentials (guarded by IP rate-limiting to prevent spam).
2. **Onboard**: User selects their academic/professional department and sets interests.
3. **Terms of Service**: Explicit consent to terms and privacy policy before system access.
4. **Session Handshake**: JWT token validation, profile generation, and redirection to the Home Feed.

---

## 📈 Vercel Analytics & Speed Insights

The application is configured to automatically report layout performance and visitor demographics straight to the Vercel Dashboard:
* **Analytics**: Real-time traffic, visitor metrics, and pageview duration tracking.
* **Speed Insights**: Core Web Vitals audit (LCP, FID, CLS) to measure page load speeds and responsiveness on real visitor devices.

These are loaded at the root of the React app inside `kovo_frontend/src/main.jsx`:
```javascript
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
      <Analytics />
      <SpeedInsights />
    </AppProvider>
  </React.StrictMode>
);
```

---

## 💬 User Feedback System

KOVO includes a built-in user feedback reporting system designed to collect review inputs, feature ideas, and technical issues:
* **Interactive Rating**: Star-based experience scoring (1 to 5 scale).
* **Category Tagging**: Categorizes input into `General Review`, `Bug Report`, `Feature Request`, or `Academic/Department Issue`.
* **Optional Anonymity**: An active toggle switch allows users to hide their name and profile info from moderators.
* **Database Logs**: Persists submissions with direct association to the user session (unless anonymous) to resolve community bugs faster.

---

## 🚀 Setup & Running Locally

### Prerequisites
* Node.js v18 or higher installed on your computer.

### Step 1: Run the Backend
1. Open a terminal in `/kovo_backend`.
2. Run `npm install` to download dependencies.
3. Run `npm start` to run the development server.
   * *Note: The backend will automatically fall back to an in-memory database if Supabase configurations are omitted, making it zero-setup.*

### Step 2: Run the Frontend
1. Open another terminal in `/kovo_frontend`.
2. Run `npm install`.
3. Run `npm run dev` to start the Vite HMR server on `http://localhost:5173`.

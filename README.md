# MotionBus_AI

A React + TypeScript project built with Vite, shadcn-ui, and Tailwind CSS.

## 🔗 Repository

**GitHub:** https://github.com/kotsiosla/MotionBus_AI

## 📅 Latest Updates (Jan 2026)

### Notification System Refactor & Fixes
- **Refactored `check-stop-arrivals`**: Split the monolithic Edge Function into modular components:
  - `crypto.ts`: Handles VAPID key parsing (supporting both Raw and PKCS#8 formats) and payload encryption.
  - `push.ts`: Encapsulates push notification sending logic with improved error handling.
  - `index.ts`: Streamlined main logic for subscription matching and polling.
- **Reliability Improvements**:
  - Increased Push Notification **TTL to 86400s (24 hours)** to ensure delivery even if user devices are in "Doze" mode or offline.
  - Fixed VAPID key parsing issues to prevent "InconsistentComponents" errors.
- **Cleanup**: Removed deprecated `check-stop-arrivalsAG` function.
- **Verification**: Validated the entire notification pipeline (DB -> API -> Proxy -> Push), confirming accurate alert triggering based on bus proximity (threshold logic).

### 🍎 iOS PWA Push Notifications (Critical Configuration)
**Do not modify without reading this.**

To ensure reliable delivery to iOS devices (which are stricter than Android), the following configuration MUST be maintained:

1.  **Headers**: Apple's APNS requires **lowercase** HTTP/2 headers.
    -   Use `urgency: 'high'` (not `Urgency`).
    -   Use `ttl: '3600'` (not `TTL`).
2.  **Payload Structure**: The JSON payload must be wrapped in a `notification` object.
    -   Correct: `{ "notification": { "title": "...", "body": "..." } }`
    -   Incorrect: `{ "title": "...", "body": "..." }` (Works on Android, fails silently on iOS).
3.  **Service Worker**:
    -   Must be a **Single File** (`sw.js`). Do not use `importScripts()` as it causes caching/network issues on iOS.
    -   Registration scope must include the trailing slash: `/MotionAG/`.

## ☁️ Deployment
This project uses **Supabase Edge Functions**.
To deploy changes to the backend logic (e.g. `check-stop-arrivals`):

```bash
npx supabase functions deploy check-stop-arrivals --project-ref jftthfniwfarxyisszjh
```

## 🚀 Quick Start

### Sync Changes to GitHub

Use the sync script for easy synchronization:

**PowerShell:**
```powershell
.\sync.ps1 "Your commit message"
```

**Bash:**
```bash
./sync.sh "Your commit message"
```

See [WORKFLOW.md](./WORKFLOW.md) for detailed workflow guide.

## Project info

**Lovable URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

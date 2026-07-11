# ChitChat 💬

An elegant, real-time messaging application featuring a state-of-the-art glassmorphic dark UI. Designed to emulate WhatsApp-style features including real-time group chat administration, context-aware nested message replies, unified contact search, and secure account recovery flows.

### 🌍 Live Demo → **[chitchat.vikasmora.tech](https://chitchat.vikasmora.tech)**

> 🧪 **Quick Login**: Use `test@gmail.com` / `123456` to explore without signing up.

## 🚀 Tech Stack

*   **Frontend**: React (Vite), React Router DOM (v6), HSL-styled Vanilla CSS
*   **Backend**: Node.js, Express, MongoDB (Mongoose)
*   **Real-Time Sync**: Socket.io (WebSockets)
*   **Email Engine**: Brevo API / SMTP Relay via Nodemailer
*   **Security & Crypto**: Node `crypto` module (SHA-256 token hashes), `bcrypt` password salt hashes

---

## ✨ Features

### 1. WhatsApp-Style Group Chats
*   **Creation & Info**: Create groups, upload group icons, add custom descriptions, and view creation dates.
*   **Roles & Permissions**: Full support for group roles (**Admin** and **Member**).
*   **Admin Dashboard Controls**: Admins can promote members to admin, demote admins, remove members, edit group parameters, or delete the group.
*   **Locked Announcement Mode**: Admins can toggle the group to "Only admins can send messages", which dynamically locks the typing bar and outputs system warnings for regular members.
*   **System Event Messages**: Automatic system notification cards generated for event logs (e.g., `"Vikas created group Testing"`, `"Admin promoted Mora to admin"`, `"You left the group"`).

### 2. Message Replies (Thread Mentions)
*   Hover or long-press on any bubble to show a **Reply** trigger icon.
*   Pops up an input attachment preview card featuring the original sender's name and message text snippet.
*   Replied messages display nested quoted bubbles. Clicking a reply quote **instantly scrolls to and highlights** the original message in the viewport history.

### 3. Unified Contact & Chat Search
*   Type query keywords in the chat panel to search **two lists simultaneously**:
    1.  **Chats**: Filter active threads matching name, username, or message snippets.
    2.  **Contacts / New**: Search the complete user directory for accounts you haven't chatted with yet, allowing you to click and start a new chat instantly.
*   Fully debounced (300-400ms delay) to minimize redundant database query loads.

### 4. Secure Authentication & Password Recovery
*   **Sign In / Sign Up**: Sleek dark mode login grids including a mobile-responsive **Quick-Fill Credentials Box** to access the demo user (`test@gmail.com` / `123456`) with a single click.
*   **Forgot / Reset Flow**: 
  *   Accepts email/phone and generates secure random 32-byte tokens.
  *   Hashes tokens using SHA-256 for MongoDB storage.
  *   Dispatches HTML reset buttons via **Brevo API (REST HTTPS)** or **Nodemailer SMTP** (automatically switches based on key formatting to bypass cloud provider port blocks).
  *   Enforces a 1-hour expiration limit.

---

## 🛠️ Environment Variables Setup

Create a `.env` file inside the `/backend` folder:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_uri

# Brevo Mail Configuration
BREVO_API_KEY=your_brevo_api_key_or_smtp_key
BREVO_USER=your_brevo_account_login_email
```

> [!NOTE]
> The backend handles both API keys (starts with `xkeysib-`) and SMTP keys (starts with `xsmtpsib-`). If deploying on cloud hosts like Render which block SMTP port 587, use a standard API key (`xkeysib-`) to automatically route mail deliveries over port 443 HTTPS.

---

## 🏁 Getting Started

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/moravikas/chitchat.git
cd chitchat

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Run Locally

Start the backend server (runs on port 3000 by default):
```bash
cd backend
npm run dev
```

Start the Vite frontend development server:
```bash
cd frontend
npm run dev
```

---

## 🌐 Deployment Configuration

### Frontend (Vite Router Rewrite on Vercel)
Vite projects routing with `react-router-dom` require path redirects to `index.html` to prevent 404 errors on browser page reloads. A `vercel.json` file is configured at the frontend root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

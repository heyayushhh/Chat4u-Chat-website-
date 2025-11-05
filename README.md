# ✨ Chatty — Full Stack Realtime Chat App ✨

![Screenshot](/frontend/public/login-screenshot.png)

Chat4U is a full-stack chat application built with the MERN stack and Socket.IO. It supports direct messages, group chats, online presence, media attachments, and group calls, with a modern UI using TailwindCSS and DaisyUI.

## Features
- Tech stack: `MongoDB` + `Express` + `React` + `Node`, `Socket.IO`
- Authentication and authorization with `JWT` (cookies)
- Real-time messaging (DMs and Groups) and online user status
- Group calls with active call banner and periodic polling
- Global state management with `Zustand`
- Cloudinary uploads for profile photos and media
- Robust server-side validation and error handling

## Recent Improvements (What We Did)
- Hardened group member addition:
  - Backend validation of `memberIds` and enforced 12-member cap
  - Frontend filters invalid contacts and sanitizes payloads
- Eliminated noisy aborted request logs:
  - Refactored `ActiveCallBanner` polling to use a `setTimeout` chain
- Reliable online presence after re-login:
  - Backend `login`/`signup` responses include `accountStatus`
  - Frontend clears `onlineUsers` and resets socket state on logout
- Enforced global email uniqueness:
  - One email (e.g., Gmail) maps to only one user
- Hosting guidance:
  - Documented same-origin and free hosting options with WebSockets

## Project Structure
```
chatty/
├── backend/           # Node/Express API + Socket.IO server
│   └── src/
│       ├── controllers/  # Auth, groups, messages, calls
│       ├── lib/          # socket, db, utils, config
│       ├── middleware/   # rate limiter, auth
│       ├── models/       # Mongoose schemas
│       ├── routes/       # API routes
│       └── seeds/        # optional seed/reset scripts
├── frontend/          # React + Vite + Tailwind + DaisyUI
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # app pages
│       ├── store/        # Zustand stores & sockets
│       └── lib/          # axios, logger
└── README.md
```

## Prerequisites
- Node.js `>=18`
- A MongoDB connection string (MongoDB Atlas free tier works great)

## Environment Setup (Backend .env)
Create `backend/.env` and set:
```
MONGODB_URI=<your mongodb connection string>
PORT=5001
JWT_SECRET=<a strong secret>

# Optional: Cloudinary if you plan to upload images/files
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<api key>
CLOUDINARY_API_SECRET=<api secret>

# Use development locally to allow lax cookies across localhost ports
NODE_ENV=development

# Optional (OAuth & production deployments)
CLIENT_URL=<frontend base url, e.g., https://chat.example.com>
OAUTH_CALLBACK_BASE=<backend base url, e.g., https://api.example.com>
```

## Running Locally (Development)
Open two terminals:
1) Backend (API + Socket.IO)
```
npm run dev --prefix backend
```
2) Frontend (Vite dev server)
```
npm run dev --prefix frontend
```
Default dev ports:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`

Login/signup from the frontend; the backend sets a secure cookie and the socket connects automatically when `accountStatus === "active"`.

## Production Build & Start (Same-Origin)
This mode serves the built frontend from the backend server in production.

Build frontend and install deps:
```
npm run build
```
Start backend in production:
```
npm start
```
Set `NODE_ENV=production` and ensure `PORT` is exposed. In production, cookies use `secure` and `sameSite: strict`; a same-origin deployment (one domain) is recommended so auth works without CORS changes.

## Free Hosting Options
You can host for free using:
- Frontend: Netlify (free)
- Backend: Render or Railway (free tiers, support WebSockets)
- Database: MongoDB Atlas (free)

Two approaches:
- Same-origin (recommended): reverse proxy `/` to frontend and `/api` + `/socket.io` to backend on one domain, e.g., `https://chat.example.com`.
- Cross-origin (Netlify + backend elsewhere): set a frontend env `VITE_API_BASE_URL=https://<your-backend-domain>`, and adjust backend cookie/CORS for cross-site auth (`sameSite: "none"`, `secure: true`, `credentials: true`).

## Troubleshooting
- Frontend loads but login fails: verify cookie settings, `CLIENT_URL`, HTTPS.
- Socket not connecting: check proxy `Upgrade/Connection` headers or CORS (origin + credentials).
- Mixed content warnings: ensure all endpoints are `https://` in production.
- Group member add errors: confirm you’re an admin and the group size <= 12.

## Trademark & Notices
- “Chatty” and associated branding are project identifiers. If you publish under your own brand, update names and assets accordingly.
- Google, Cloudinary, MongoDB, Netlify, Render, Railway are trademarks of their respective owners. Use of these services is subject to their terms.

## License
See `LICENSE` in this repository for licensing terms.

## Credits
- UI built with TailwindCSS + DaisyUI
- Real-time powered by Socket.IO
- State management with Zustand

## Contributing
Issues and PRs are welcome. Please avoid committing secrets and ensure environment variables are documented in PR descriptions.

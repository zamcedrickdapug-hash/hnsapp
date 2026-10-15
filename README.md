# H&S Booking System

H&S Booking System is a web application for coordinating school transportation. The current codebase includes parent, driver, and administrator interfaces; backend routes for authentication and user/driver/parent workflows; trip and van requests; notifications; and GPS, routing, safety-reporting, and analytics features.

The project is built with a React and TypeScript frontend and a Node.js/Express backend. MongoDB is used for application persistence. Firebase Authentication, email delivery, and web push are integrations that require configuration; their presence in the code does not mean an instance is configured or ready for production.

## Technology

- Node.js 20 or later
- Frontend: React 19, TypeScript, Vite, React Router
- Backend: Node.js, Express, Mongoose/MongoDB, Socket.IO
- Integrations in the codebase: Firebase Authentication/Admin SDK, SMTP email, web push (VAPID), and mapping/GPS-related functionality

## Repository layout

- `backend/` - Express entry point, API routes, models, middleware, services, utilities, and tests
- `frontend/` - Vite application; UI entry point is `src/main.tsx`
- `backend/.env.example` - backend environment template
- `package.json` - root convenience scripts for development and startup

## Local setup

### Prerequisites

- Node.js 20 or later and npm
- A MongoDB database and a MongoDB connection URI

### Install dependencies

Run these commands from the repository root:

```sh
npm install --prefix backend
npm install --prefix frontend
```

### Configure environment

Copy `backend/.env.example` to `backend/.env`, then set the values needed for your local configuration. The example file includes a local MongoDB URI for `MONGO_URL`; replace it with your own MongoDB connection URI if needed. The backend requires `MONGO_URL` (it also accepts the legacy name `MongoUrl`) to connect to the database. The `DB_*` values in the example are not used for the main server's MongoDB connection.

Set `JWT_SECRET` to a strong, private value for backend token signing. Set `ADMIN_PASSWORD` if you want the backend to create its initial administrator account; `ADMIN_EMAIL` optionally selects that account’s email.

For Firebase-backed frontend authentication, copy `frontend/.env.example` to `frontend/.env.local` and fill in the Firebase web-app values:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The frontend reads those values during its Firebase initialization. For backend verification of Firebase identity tokens, configure `FIREBASE_SERVICE_ACCOUNT` with the service-account JSON in the deployment environment. `FIREBASE_ADMIN_SDK_PATH` remains available for a locally stored file. Keep both credentials private and out of Git.

The frontend uses `VITE_API_URL` for API and socket connections. It defaults to `http://localhost:4000/api` for local development; set it to the backend URL ending in `/api` for a split-domain deployment.

Other integration settings are optional unless you use the corresponding feature:

- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` (mail sender settings may also use `MAIL_FROM_EMAIL` and `MAIL_FROM_NAME`); the backend email service also reads `EMAIL_SERVICE`, `EMAIL_USER`, and `EMAIL_PASSWORD`
- Web push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` must all be configured to enable push initialization
- Development/runtime: `PORT` (defaults to `4000`), `FRONTEND_URL` (comma-separated frontend origins), and `MONGODB_DNS_SERVERS` (development-only DNS override)

Do not put real credentials in `.env.example`, source files, or documentation. Use private local environment files or your deployment platform’s secret configuration.

## Run locally

From the repository root, start the backend in one terminal:

```sh
npm run backend:dev
```

Start the frontend in a second terminal:

```sh
npm run frontend:dev
```

The frontend normally runs at `http://localhost:5173`; the backend defaults to port `4000`. `VITE_API_URL` defaults to `http://localhost:4000/api` for local API and socket connections. Vite also retains proxies for any relative `/api` and `/socket.io` requests. The backend exposes `/api/health` for a health check and reports database connection state there.

To build the frontend:

```sh
npm run build
```

## Split-domain deployment

For a Render backend and Vercel frontend:

- On Render, set the service root to `backend`, use `npm ci` as the build command and `npm start` as the start command. Configure `MONGO_URL`, `JWT_SECRET`, and `FRONTEND_URL`; Render supplies `PORT`. `FRONTEND_URL` accepts a comma-separated list of frontend origins.
- On Vercel, set the project root to `frontend`, use `npm run build` as the build command, and `dist` as the output directory. Set `VITE_API_URL` to the Render backend URL ending in `/api`, and configure the `VITE_FIREBASE_*` values if Firebase authentication is enabled.
- Configure `FIREBASE_SERVICE_ACCOUNT` in Render when the backend needs Firebase Admin verification. The frontend's `vercel.json` rewrites app routes to `index.html` for client-side route refreshes.
- MongoDB Atlas must allow connections from the Render service. Keep database, JWT, SMTP, Firebase Admin, and VAPID credentials in the deployment platform's secret settings.
- New Valid ID uploads are stored as buffers in a separate MongoDB collection, limited to JPEG, PNG, or PDF files up to 2 MiB. They do not depend on Render's filesystem. Legacy files on disk are neither migrated nor deleted automatically.

The backend can serve the built frontend from `frontend/dist` when present.

## Tests

The backend package does not define an npm test script. Its two test files use Node’s built-in test runner. From the repository root, run:

```sh
cd backend
node --test tests/authentication.test.js tests/vanRequestFlow.test.js
```

These are the available backend tests identified in the repository. No test or build result is implied by this README.

## Integration notes

- Firebase web configuration is needed for the frontend Firebase initialization and Firebase-backed authentication flows. Backend Firebase token verification additionally needs Firebase Admin credentials.
- Email delivery depends on valid SMTP configuration.
- Push notification initialization is disabled unless all three VAPID settings are configured.
- GPS, routing, and map behavior depends on the relevant application code and any external services/configuration it uses. Review the specific feature configuration before enabling it.

This README describes the current code and local scripts; it does not claim that all integrations are configured or that the application is production-ready.

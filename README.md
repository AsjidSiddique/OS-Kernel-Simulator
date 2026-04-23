# 🖥️ Mini OS Kernel Simulator

> A full-stack user-space Operating System simulator built for CS-330 CEP (BESE-30).  
> Simulates CPU Scheduling, Memory Management, Process Synchronization, and Process/Thread Management — all running inside a React + Node.js application.

---

## 📌 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup — Backend](#setup--backend)
- [Setup — Frontend](#setup--frontend)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [OS Modules Explained](#os-modules-explained)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

This simulator models core OS kernel functionalities entirely in user space. It does **not** use real OS-level processes or kernel threads — instead it simulates them as JavaScript objects, mimicking how a real OS kernel would manage resources.

**Subsystems implemented:**
- CPU Scheduling (FCFS, SJF, Round Robin, Priority)
- Memory Management with Page Replacement (FIFO, LRU, Optimal)
- Process Synchronization (Counting & Binary Semaphore)
- Process & Thread Management (PCB, TCB, state transitions)

---

## Features

- 4 CPU scheduling algorithms with Gantt chart visualization
- 3 page replacement algorithms with step-by-step trace
- Semaphore simulation with thread execution logs
- Process lifecycle simulation (NEW → READY → RUNNING → WAITING → TERMINATED)
- JWT-based authentication (register / login)
- Save, view, and delete simulation results (MongoDB)
- CSV import for scheduling inputs
- Export results as PDF or CSV
- User profile with avatar upload

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Recharts, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (JSON Web Tokens) |
| Logging | Winston |
| File Upload | Multer |

---

## Project Structure

```
os-simulator-fixed-v2/
├── os-simulator-backend/
│   ├── src/
│   │   ├── app.js                  # Express app setup, middleware, routes
│   │   ├── server.js               # HTTP server entry point
│   │   ├── config/
│   │   │   └── db.js               # MongoDB connection
│   │   ├── controllers/
│   │   │   ├── simulationController.js   # Runs all OS simulations
│   │   │   ├── authController.js         # Register / login
│   │   │   ├── profileController.js      # User profile + avatar
│   │   │   └── csvController.js          # CSV import handler
│   │   ├── services/
│   │   │   └── osSimulator.js      # Core OS logic (all algorithms)
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   └── SimulationResult.js
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── .env                        # Environment variables (create this yourself)
│   └── package.json
│
└── os-simulator-frontend/
    ├── src/
    │   ├── App.js
    │   ├── pages/
    │   │   ├── SchedulingPage.js
    │   │   ├── MemoryPage.js
    │   │   ├── SynchronizationPage.js
    │   │   ├── ProcessManagementPage.js
    │   │   ├── DashboardPage.js
    │   │   ├── ResultsPage.js
    │   │   ├── LoginPage.js
    │   │   └── RegisterPage.js
    │   ├── components/
    │   │   ├── GanttChart.js
    │   │   └── Layout.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   └── utils/
    │       ├── api.js              # Axios instance with JWT interceptor
    │       └── export.js           # PDF/CSV export helpers
    ├── .env                        # Frontend env (create this yourself)
    └── package.json
```

---

## Prerequisites

Make sure the following are installed on your machine before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | v18 or higher | https://nodejs.org |
| npm | comes with Node.js | — |
| Git | any recent version | https://git-scm.com |
| MongoDB Atlas account | free tier is enough | https://www.mongodb.com/atlas |

To verify your installations, run:

```bash
node --version
npm --version
git --version
```

---

## Setup — Backend

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### Step 2 — Go into the backend folder

```bash
cd os-simulator-backend
```

### Step 3 — Install dependencies

```bash
npm install
```

This installs: express, mongoose, jsonwebtoken, bcryptjs, multer, winston, cors, helmet, dotenv, csv-parse, and others listed in `package.json`.

### Step 4 — Create your `.env` file

Create a file named `.env` inside `os-simulator-backend/` with the following content:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB — paste your Atlas connection string here
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=YourApp

# JWT
JWT_SECRET=replace_this_with_any_long_random_string
JWT_EXPIRES_IN=7d

# Cookie
COOKIE_SECRET=replace_this_with_another_random_string

# CORS — URL of your running frontend
CLIENT_URL=http://localhost:3000
```


### How to get your MongoDB URI

1. Go to https://www.mongodb.com/atlas and sign in (or create a free account)
2. Create a new **free cluster** (M0 tier)
3. Under **Database Access**, create a database user with a username and password
4. Under **Network Access**, click **Add IP Address** → choose **Allow Access from Anywhere** (for development)
5. Go to your cluster → click **Connect** → **Connect your application**
6. Copy the connection string — it looks like:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
7. Paste it as the value of `MONGO_URI` in your `.env`

### Step 5 — Start the backend

For development (auto-restarts on file changes):
```bash
npm run dev
```

For production:
```bash
npm start
```

You should see output like:
```
Server running on port 5000
MongoDB connected
```

To verify the backend is working, open your browser and go to:
```
http://localhost:5000/api/health
```

You should get:
```json
{ "status": "OK", "timestamp": "..." }
```

---

## Setup — Frontend

Open a **new terminal window** (keep the backend terminal running).

### Step 1 — Go into the frontend folder

```bash
cd os-simulator-frontend
```

### Step 2 — Install dependencies

```bash
npm install
```

This installs: react, react-dom, react-router-dom, axios, recharts, react-scripts.

### Step 3 — Create your `.env` file

Create a file named `.env` inside `os-simulator-frontend/` with:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

This tells the frontend where to send API requests. If you change the backend port, update this too.

### Step 4 — Start the frontend

```bash
npm start
```

This opens the app automatically at:
```
http://localhost:3000
```

---

## Running the Application

You need **two terminals running at the same time**:

| Terminal | Command | What it does |
|---|---|---|
| Terminal 1 | `cd os-simulator-backend && npm run dev` | Starts the API server on port 5000 |
| Terminal 2 | `cd os-simulator-frontend && npm start` | Starts the React app on port 3000 |

Then open `http://localhost:3000` in your browser.

**First time use:**
1. Click **Register** and create an account
2. Log in with your credentials
3. Navigate to any simulator module from the sidebar

---

## Environment Variables

### Backend (`os-simulator-backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the backend runs on | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key used to sign tokens | any long random string |
| `JWT_EXPIRES_IN` | How long login sessions last | `7d` |
| `COOKIE_SECRET` | Secret for signed cookies | any long random string |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Frontend (`os-simulator-frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_URL` | Base URL for all API calls | `http://localhost:5000/api` |

---

## API Endpoints

All routes are prefixed with `/api`.

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and receive JWT |
| POST | `/api/auth/logout` | Logout |

### Simulations (require JWT)
| Method | Route | Description |
|---|---|---|
| POST | `/api/simulate/scheduling` | Run CPU scheduling simulation |
| POST | `/api/simulate/memory` | Run page replacement simulation |
| POST | `/api/simulate/sync` | Run semaphore simulation |
| POST | `/api/simulate/processes` | Run process management simulation |
| POST | `/api/simulate/results` | Save a simulation result |
| GET | `/api/simulate/results` | Get saved results (paginated) |
| GET | `/api/simulate/results/:id` | Get one saved result |
| DELETE | `/api/simulate/results/:id` | Delete a saved result |

### Other
| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| POST | `/api/csv/scheduling` | Import CSV for scheduling |
| GET/PUT | `/api/profile` | View / update user profile |

---

## OS Modules Explained

### CPU Scheduling
Send a POST to `/api/simulate/scheduling` with:
```json
{
  "algorithm": "FCFS",
  "processes": [
    { "pid": 1, "name": "P1", "arrivalTime": 0, "burstTime": 6, "priority": 2 },
    { "pid": 2, "name": "P2", "arrivalTime": 2, "burstTime": 4, "priority": 1 }
  ],
  "quantum": 2
}
```
Available algorithms: `FCFS`, `SJF`, `RoundRobin`, `Priority`

### Memory Management
Send a POST to `/api/simulate/memory` with:
```json
{
  "algorithm": "LRU",
  "referenceString": [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
  "frameCount": 3
}
```
Available algorithms: `FIFO`, `LRU`, `Optimal`

### Synchronization
Send a POST to `/api/simulate/sync` with:
```json
{
  "primitive": "Semaphore",
  "semaphoreType": "counting",
  "threadCount": 4,
  "semaphoreValue": 2,
  "iterations": 3
}
```
Semaphore types: `counting`, `binary`

---

## Troubleshooting

**Backend won't start — `MongooseServerSelectionError`**
- Check your `MONGO_URI` in `.env` — username/password must be correct
- Go to MongoDB Atlas → Network Access → confirm your IP is whitelisted
- Make sure you have internet access

**Frontend shows blank page or "Network Error"**
- Confirm the backend is running on port 5000
- Check `REACT_APP_API_URL` in frontend `.env` matches the backend port
- Open browser DevTools → Network tab to see which request is failing

**`npm install` fails**
- Make sure Node.js v18+ is installed: `node --version`
- Try deleting `node_modules` and `package-lock.json` then running `npm install` again

**Port already in use**
- Something else is using port 5000 or 3000
- Change `PORT=5001` in backend `.env` and update `REACT_APP_API_URL` in frontend `.env` accordingly

**Login not working after registration**
- Make sure both frontend and backend are running
- Check that `CLIENT_URL` in backend `.env` matches exactly where your frontend is running (including `http://`)

---

## Authors

BESE-30 — CS-330 Operating Systems  
Spring 2026 — CEP Group Project

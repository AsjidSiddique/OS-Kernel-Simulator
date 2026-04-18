<<<<<<< HEAD
# OS Kernel Simulator v2.0

A full-stack Mini OS Kernel Simulator with four core subsystems.

## Modules
- **Process & Thread Management** — PCB/TCB, state transitions, I/O-bound vs CPU-bound
- **CPU Scheduling** — FCFS, SJF, Round Robin, Priority with Gantt charts
- **Process Synchronization** — Mutex, Counting Semaphore, race detection
- **Memory Management** — FIFO, LRU, Optimal page replacement

---

## Quick Start

### 1. Backend
```bash
cd os-simulator-backend
npm install
# Edit .env — set your MONGO_URI
npm run dev
```

### 2. Frontend
```bash
cd os-simulator-frontend
npm install
npm start
```

Open **http://localhost:3000**

---

## Environment Variables

### Backend `.env`
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your_cookie_secret
CLIENT_URL=http://localhost:3000
```

### Frontend `.env`
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_BACKEND_URL=http://localhost:5000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/simulate/scheduling` | Run CPU scheduling |
| POST | `/api/simulate/memory` | Run memory simulation |
| POST | `/api/simulate/sync` | Run synchronization |
| POST | `/api/processes/simulate` | Run process/thread sim |
| GET | `/api/simulate/results` | Get saved results |
| POST | `/api/profile/avatar` | Upload avatar |
| PUT | `/api/profile` | Update profile |
=======
# OS-Kernel-Simulator
OS-Kernel Simulator
>>>>>>> d091a21873ba3750e190a91d9f449d3a55567072

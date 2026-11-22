# Slide Bolt

A browser-based slide editor built for one job: turning **existing PowerPoint decks into LMS-ready SCORM packages** — fast.

Import a PPTX → fix what needs fixing → export a SCORM package → move on to the next deck.

## Features

- **PPTX import** – Python-based parser converts `.pptx` files into editable slides
- **Slide editor** – drag, resize and rotate elements; alignment guides; context menus; rich text via CKEditor 5
- **Elements** – text, images (with cropping), shapes and charts
- **Real-time collaboration** – multi-user editing over Socket.IO
- **Presentation management** – dashboard, search, tags, public/private presentations, thumbnails
- **SCORM export** – package presentations for upload to any SCORM-compliant LMS
- **Authentication** – JWT-based register / login

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, CKEditor 5, React Router |
| Backend  | Node.js, Express, TypeScript, Socket.IO |
| Database | MongoDB (Mongoose) |
| Import   | Python (`python-pptx`) |

## Project structure

```
.
├── src/                 # React app (components, store, services, hooks)
├── server/
│   └── src/
│       ├── controllers/ # Route handlers
│       ├── models/      # Mongoose models
│       ├── routes/      # Express routes
│       ├── services/    # Presentation, PPTX conversion, thumbnails, SCORM export
│       ├── realtime/    # Collaboration server (Socket.IO)
│       └── python/pptx/ # PPTX parser
├── scorm.html           # SCORM player entry
└── PRODUCT.md           # Product & design context
```

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (local instance or a MongoDB Atlas connection string)
- Python 3.9+ with `python-pptx` (only needed for PPTX import)

### 1. Clone and install

```bash
git clone https://github.com/D1N35HV/html-slides.git
cd html-slides
npm install
cd server && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Edit `server/.env` and set at least `MONGODB_URI` and a strong `JWT_SECRET`.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/slidesdb` |
| `JWT_SECRET` | Secret used to sign tokens | — (required) |
| `CORS_ORIGINS` | Allowed frontend origins | — |
| `MAX_FILE_SIZE` / `UPLOAD_PATH` | Upload limits / location | see `.env.example` |

Frontend (`.env`): `VITE_API_URL` points to the API (default `http://localhost:3001`).

### 3. Install the PPTX parser dependency

```bash
pip install python-pptx
```

### 4. Run

In two terminals:

```bash
# Terminal 1 – API
cd server && npm run dev

# Terminal 2 – frontend
npm run dev
```

Open <http://localhost:5173>.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| root | `npm run dev` | Start Vite dev server |
| root | `npm run build` | Production build to `dist/` |
| root | `npm run preview` | Preview the production build |
| `server/` | `npm run dev` | API with nodemon |
| `server/` | `npm run build` / `npm start` | Compile and run the API |
| `server/` | `npm test` | Run Jest tests |

## Security

Never commit `.env` files. Only the `*.example` templates are tracked.

## License

No license specified yet.

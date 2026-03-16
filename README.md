# express-backend-setup

A CLI tool to scaffold a production-ready Express.js backend instantly — just like `create-react-app` but for your Node.js backend.

```bash
npx express-backend-setup my-app
```

No manual setup. No boilerplate hunting. Answer 4 questions and your backend is running.

---

## Table of Contents

- [Quick Start](#quick-start)
- [CLI Experience](#cli-experience)
- [What Gets Generated](#what-gets-generated)
- [Project Structure](#project-structure)
- [Database Options](#database-options)
- [Feature Options](#feature-options)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Adding New Routes](#adding-new-routes)
- [Adding Cron Jobs](#adding-cron-jobs)
- [File Uploads](#file-uploads)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

**Requirements:** Node.js >= 14.0.0

```bash
# Recommended — pass project name directly
npx express-backend-setup my-app

# Or run without a name and the CLI will ask
npx express-backend-setup
```

The CLI will ask you 4 questions, then scaffold and install everything automatically:

```
────────────────────────────────────────────────────────────
  🚀  express-backend-setup
  Scaffold a production-ready Express.js backend instantly
────────────────────────────────────────────────────────────

  ? Project name:               my-app
  ? Select a database:          MongoDB (Mongoose)
  ? Select features to include: Cron Jobs, Rate Limiting, API Logging
  ? Default server port:        5000
```

After answering, it will:

1. Show a project summary
2. Scaffold all files
3. Run `npm install` automatically
4. Print the generated file tree
5. Print next steps

```bash
cd my-app
cp .env.example .env    # fill in your values
npm run dev             # start development server
```

---

## CLI Experience

The CLI is designed to be clear and informative at every step.

### Project Summary

Before generating anything, the CLI shows you exactly what will be created:

```
────────────────────────────────────────────────────────────
  📋  Project Summary
────────────────────────────────────────────────────────────
  Name      my-app
  Database  mongo
  Port      5000
  Features  cron, rateLimit, morgan
────────────────────────────────────────────────────────────
```

### Progress Spinners

Two separate spinners show you which phase is running:

```
⠋ Scaffolding project files...
✔ Project files created

⠋ Installing dependencies (this may take a minute)...
✔ Dependencies installed
```

### Generated File Tree

After generation, the CLI prints the exact structure that was created:

```
────────────────────────────────────────────────────────────
  📁  Generated Structure
────────────────────────────────────────────────────────────
  my-app/
  ├── src/
  │   ├── server.js           ← entry point, starts HTTP server
  │   ├── app.js              ← express setup, middleware, routes
  │   ├── routes/
  │   │   └── index.js        ← /api/health endpoint
  │   ├── middleware/
  │   │   └── errorHandler.js ← global error handler
  │   ├── config/
  │   │   └── database.js     ← db connection
  │   ├── models/             ← add your models here
  │   └── jobs/
  │       └── index.js        ← cron-guardian schedules
  ├── .env.example            ← copy to .env and fill values
  ├── .gitignore
  └── package.json
────────────────────────────────────────────────────────────
```

### Installed Packages List

```
────────────────────────────────────────────────────────────
  📦  Installed Packages
────────────────────────────────────────────────────────────
  ✔  express
  ✔  cors
  ✔  helmet
  ✔  dotenv
  ✔  mongoose
  ✔  cron-guardian
  ✔  express-rate-limit
  ✔  morgan
────────────────────────────────────────────────────────────
```

### Next Steps

```
  ✔  Success! Your project is ready at ./my-app

  🏁  Next Steps
────────────────────────────────────────────────────────────
  1.  cd my-app
  2.  cp .env.example .env     ← fill in your environment values
  3.  npm run dev              ← start the development server
────────────────────────────────────────────────────────────

  Health check →  http://localhost:5000/api/health
```

---

## What Gets Generated

Every project always includes these files:

| File | Purpose |
|---|---|
| `src/server.js` | Entry point — loads `.env` and starts the HTTP server |
| `src/app.js` | Express app — middleware stack, routes, DB connection |
| `src/routes/index.js` | Root API router with `/api/health` endpoint |
| `src/middleware/errorHandler.js` | Global error handler |
| `.env.example` | Environment variable template |
| `.gitignore` | Ignores `node_modules`, `.env`, `uploads/`, `*.sqlite` |
| `package.json` | Only includes packages you selected |

Additional files are generated based on your selections:

| Selection | Extra files generated |
|---|---|
| Any database | `src/config/database.js`, `src/models/` directory |
| Cron Jobs | `src/jobs/index.js` |
| File Upload | `src/middleware/upload.js`, `uploads/` directory |

---

## Project Structure

### With MongoDB + All Features

```
my-app/
├── src/
│   ├── server.js                   # HTTP server entry point
│   ├── app.js                      # Express app, full middleware stack
│   ├── config/
│   │   └── database.js             # Mongoose connection
│   ├── models/                     # Add your Mongoose models here
│   ├── middleware/
│   │   └── errorHandler.js         # Global error handler
│   ├── routes/
│   │   └── index.js                # Main router (/api/health)
│   └── jobs/
│       └── index.js                # cron-guardian job definitions
├── uploads/                        # File upload destination (multer)
├── .env.example                    # Environment variable template
├── .gitignore
└── package.json
```

### With PostgreSQL / MySQL / SQLite

Same structure, but `src/config/database.js` uses **Sequelize** instead of Mongoose.

### With No Database

- No `src/config/` directory
- No `src/models/` directory

---

## Database Options

### MongoDB (Mongoose)

Connects via `MONGO_URI` environment variable.

```js
// src/config/database.js
mongoose.connect(process.env.MONGO_URI);
```

**Required `.env` variable:**
```
MONGO_URI=mongodb://localhost:27017/my-app
```

---

### PostgreSQL (pg + Sequelize)

```js
new Sequelize({ dialect: 'postgres', host, port, username, password, database })
```

**Required `.env` variables:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my-app
DB_USER=postgres
DB_PASS=password
```

---

### MySQL (mysql2 + Sequelize)

```js
new Sequelize({ dialect: 'mysql', host, port, username, password, database })
```

**Required `.env` variables:**
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=my-app
DB_USER=root
DB_PASS=password
```

---

### SQLite (Sequelize)

Zero-config local database. Great for development and small projects.

```js
new Sequelize({ dialect: 'sqlite', storage: process.env.DB_STORAGE })
```

**Required `.env` variable:**
```
DB_STORAGE=./my-app.sqlite
```

---

## Feature Options

### Cron Jobs (cron-guardian)

**Package:** `cron-guardian`

**Generated file:** `src/jobs/index.js`

Jobs are auto-loaded when the app starts. `cron-guardian` wraps `node-cron` with retries, overlap prevention, failure callbacks, and a monitoring API.

**Example job:**

```js
const { SmartCron } = require('cron-guardian');
const guardian = new SmartCron();

guardian.schedule(
  '0 0 * * *',           // every day at midnight
  async () => {
    await cleanupOldRecords();
  },
  {
    name: 'daily-cleanup',
    retries: 3,            // retry up to 3 times on failure
    retryDelay: 5000,      // wait 5s between retries
    preventOverlap: true,  // skip if previous run is still going
    onFailure: (err, job) => {
      console.error(`${job.name} failed:`, err.message);
    },
  }
);
```

**Monitoring API:**

```js
guardian.listJobs()    // all registered jobs + current status
guardian.getLogs()     // full execution history (name/status/duration/error)
guardian.stop(name)    // pause a job by name
guardian.start(name)   // resume a paused job
guardian.remove(name)  // unregister a job completely
```

**Cron expression reference:**

| Expression | Meaning |
|---|---|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Every day at midnight |
| `0 9 * * 1-5` | Weekdays at 9am |
| `0 0 1 * *` | First day of every month |

---

### File Upload (multer)

**Package:** `multer`

**Generated file:** `src/middleware/upload.js`

- Files saved to `uploads/` directory
- Filename: `{timestamp}-{originalname}`
- Allowed types: `jpeg`, `jpg`, `png`, `gif`, `pdf`
- Max file size: **5 MB**

**Using in a route:**

```js
const upload = require('../middleware/upload');

// Single file
router.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({ file: req.file });
});

// Multiple files (up to 5)
router.post('/gallery', upload.array('images', 5), (req, res) => {
  res.json({ files: req.files });
});
```

---

### Rate Limiting (express-rate-limit)

**Package:** `express-rate-limit`

Applied globally in `src/app.js`:

```js
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

Limits each IP to **100 requests per 15 minutes**. To apply a stricter limit on a specific route:

```js
const rateLimit = require('express-rate-limit');

const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
router.post('/submit', strictLimiter, handler);
```

---

### Request Validation (joi)

**Package:** `joi`

Use it inside your route handlers or as middleware:

```js
const Joi = require('joi');

const schema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

exports.createUser = async (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  // ... rest of handler
};
```

---

### API Logging (morgan)

**Package:** `morgan`

Applied globally in `src/app.js` using the `dev` format:

```
GET  /api/health  200  3.456 ms - 42
POST /api/users   201  18.23 ms - 85
```

To change the format, edit `src/app.js`:

```js
app.use(morgan('combined'));  // Apache-style full logs (recommended for production)
app.use(morgan('tiny'));      // Minimal one-line output
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | App environment (`development` / `production`) |
| `PORT` | `5000` | HTTP server port |
| `MONGO_URI` | — | MongoDB connection string (MongoDB only) |
| `DB_HOST` | `localhost` | Database host (SQL databases) |
| `DB_PORT` | `5432` / `3306` | Database port (SQL databases) |
| `DB_NAME` | project name | Database name (SQL databases) |
| `DB_USER` | — | Database username (SQL databases) |
| `DB_PASS` | — | Database password (SQL databases) |
| `DB_STORAGE` | — | SQLite file path (SQLite only) |

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon — auto-restarts on every file change |
| `npm start` | Start in production mode (no auto-restart) |

---

## API Reference

### Health Check

```
GET /api/health
```

Response `200`:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Used by load balancers, uptime monitors, and Docker health checks to verify the server is alive.

---

## Adding New Routes

**1. Create a controller in `src/controllers/`:**

```js
// src/controllers/productController.js

exports.getAll = async (req, res, next) => {
  try {
    // Replace with your real DB query
    res.json({ products: [] });
  } catch (err) {
    next(err); // passes to global error handler
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ product: { id } });
  } catch (err) {
    next(err);
  }
};
```

**2. Create a route file in `src/routes/`:**

```js
// src/routes/products.js
const router     = require('express').Router();
const controller = require('../controllers/productController');

router.get('/',    controller.getAll);
router.get('/:id', controller.getOne);

module.exports = router;
```

**3. Register it in `src/routes/index.js`:**

```js
const productRoutes = require('./products');
router.use('/products', productRoutes);
```

Your new endpoints are now available at:
- `GET /api/products`
- `GET /api/products/:id`

---

## Adding Cron Jobs

Open `src/jobs/index.js` and add a new `guardian.schedule()` call:

```js
guardian.schedule(
  '0 9 * * 1-5',
  async () => {
    await sendWeeklyReport();
  },
  {
    name: 'weekly-report',
    retries: 2,
    retryDelay: 10000,
    preventOverlap: true,
    onFailure: (err, job) => {
      console.error(`${job.name} failed:`, err.message);
    },
  }
);
```

For complex jobs, keep `src/jobs/index.js` clean by splitting into separate files:

```js
// src/jobs/reportJob.js
const { SmartCron } = require('cron-guardian');
const guardian = new SmartCron();

guardian.schedule('0 9 * * 1-5', async () => {
  await sendWeeklyReport();
}, { name: 'weekly-report', retries: 2, retryDelay: 10000, preventOverlap: true });

module.exports = guardian;

// src/jobs/index.js
require('./reportJob');
require('./cleanupJob');
```

---

## Error Handling

All errors flow through `src/middleware/errorHandler.js`. Trigger it from any route or controller using `next(err)`:

```js
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      return next(err);
    }

    res.json(user);
  } catch (err) {
    next(err); // unexpected errors → 500
  }
};
```

All error responses follow this format:

```json
{ "error": "User not found" }
```

Stack traces are logged to the console in `development` mode only.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT

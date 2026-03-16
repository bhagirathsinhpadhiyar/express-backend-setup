# express-backend-setup — Technical Documentation

Complete internal reference for contributors and developers who want to extend, modify, or understand how the CLI works under the hood.

---

## Table of Contents

- [Package Overview](#package-overview)
- [Repository Structure](#repository-structure)
- [CLI Package Dependencies](#cli-package-dependencies)
- [bin/cli.js — Internals](#binclijs--internals)
  - [Argument Handling](#argument-handling)
  - [Prompt Design](#prompt-design)
  - [Terminal Output System](#terminal-output-system)
  - [Full CLI Flow](#full-cli-flow)
- [lib/generator.js — Internals](#libgeneratorjs--internals)
  - [generate()](#generate)
  - [install()](#install)
- [lib/templates/index.js — Internals](#libtemplatesindexjs--internals)
  - [Dependency Maps](#dependency-maps)
  - [Template Function Reference](#template-function-reference)
- [Generated App Architecture](#generated-app-architecture)
  - [Middleware Stack Order](#middleware-stack-order)
  - [Request Lifecycle](#request-lifecycle)
  - [Database Layer](#database-layer)
  - [Cron Job System](#cron-job-system)
  - [File Upload Pipeline](#file-upload-pipeline)
  - [Error Handling Flow](#error-handling-flow)
- [Adding a New Database](#adding-a-new-database)
- [Adding a New Feature](#adding-a-new-feature)
- [Local Development & Testing](#local-development--testing)
- [Publishing to npm](#publishing-to-npm)

---

## Package Overview

`express-backend-setup` is a CLI scaffolding tool. When a user runs it, it:

1. Asks 4 interactive questions via terminal prompts
2. Generates a complete Express.js project on disk based on the answers
3. Runs `npm install` inside the new project automatically

The CLI package itself is kept intentionally small — it only contains the scaffolding logic. The generated project has zero dependency on this package after creation.

---

## Repository Structure

```
express-backend-setup/
├── bin/
│   └── cli.js                  ← CLI entry point (registered in package.json "bin")
├── lib/
│   ├── generator.js            ← Orchestrates directory creation, file writes, npm install
│   └── templates/
│       └── index.js            ← Pure functions returning file content strings
├── index.js                    ← Package entry point (exports generator)
└── package.json                ← CLI package manifest
```

---

## CLI Package Dependencies

| Package | Version | Role |
|---|---|---|
| `inquirer` | ^8.2.6 | Interactive terminal prompts (list, checkbox, input) |
| `chalk` | ^4.1.2 | Terminal color and styling |
| `ora` | ^5.4.1 | Spinner animations during async operations |
| `fs-extra` | ^11.2.0 | Extended `fs` with `ensureDir` and `outputFile` |

> These are the CLI tool's own dependencies — not the generated project's dependencies.

---

## bin/cli.js — Internals

### Argument Handling

The CLI supports two usage modes:

```bash
# Mode 1 — project name passed as argument (skips name prompt)
npx express-backend-setup my-app

# Mode 2 — no argument (asks for name interactively)
npx express-backend-setup
```

This is implemented by reading `process.argv[2]` at startup:

```js
const argProjectName = process.argv[2];

// In the questions array:
...(!argProjectName ? [{ type: 'input', name: 'projectName', ... }] : [])

// After prompts resolve:
if (argProjectName) answers.projectName = argProjectName;
```

---

### Prompt Design

The CLI uses three prompt types from `inquirer`:

| Prompt type | Used for | Why |
|---|---|---|
| `input` | Project name, port | Free text with validation |
| `list` | Database selection | Exactly one choice required |
| `checkbox` | Feature selection | Zero or more choices allowed |

Database choices are color-coded using `chalk` to make them visually distinct:

```js
{ name: `${chalk.green('●')} MongoDB    ${chalk.gray('(Mongoose)')}`,  value: 'mongo'    }
{ name: `${chalk.blue('●')} PostgreSQL ${chalk.gray('(pg + Sequelize)')}`, value: 'postgres' }
{ name: `${chalk.yellow('●')} MySQL    ${chalk.gray('(mysql2 + Sequelize)')}`, value: 'mysql' }
{ name: `${chalk.magenta('●')} SQLite  ${chalk.gray('(Sequelize)')}`,   value: 'sqlite'   }
```

Feature checkboxes have sensible defaults pre-checked:

| Feature | Default |
|---|---|
| Cron Jobs | ✔ checked |
| File Upload | unchecked |
| Rate Limiting | ✔ checked |
| Validation | unchecked |
| API Logging | ✔ checked |

---

### Terminal Output System

Two helper functions keep the output consistent throughout the file:

```js
const divider = () => console.log(chalk.gray('─'.repeat(60)));
const gap     = () => console.log('');
```

These are used to build structured sections:

```
────────────────────────────────────────────────────────────
  📋  Section Title
────────────────────────────────────────────────────────────
  content line 1
  content line 2
────────────────────────────────────────────────────────────
```

The output is split into 6 distinct sections:

| Section | When shown | Content |
|---|---|---|
| Banner | On startup | Tool name + tagline |
| Project Summary | After prompts | Name, DB, port, features |
| Spinner 1 | During file generation | "Scaffolding project files..." |
| Spinner 2 | During npm install | "Installing dependencies..." |
| Generated Structure | After install | Dynamic file tree |
| Installed Packages | After install | All packages that were installed |
| Next Steps | After install | 3 commands + health check URL |

---

### Full CLI Flow

```
startup
  │
  ├── print banner
  │
  ├── read process.argv[2]
  │     ├── present → skip name prompt
  │     └── absent  → include name prompt
  │
  ├── inquirer.prompt(questions)
  │     ├── database  (list)
  │     ├── features  (checkbox)
  │     └── port      (input)
  │
  ├── print Project Summary
  │
  ├── check if targetDir exists
  │     └── exists → print error + process.exit(1)
  │
  ├── ora spinner 1 start → generator.generate(targetDir, answers)
  │     ├── success → spinner.succeed
  │     └── failure → spinner.fail + process.exit(1)
  │
  ├── ora spinner 2 start → generator.install(targetDir)
  │     ├── success → spinner.succeed
  │     └── failure → spinner.fail + process.exit(1)
  │
  ├── print Generated Structure (dynamic based on selections)
  ├── print Installed Packages
  └── print Next Steps + health check URL
```

---

## lib/generator.js — Internals

### generate()

```js
async function generate(targetDir, options)
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `targetDir` | `string` | Absolute path to the new project folder |
| `options.projectName` | `string` | e.g. `'my-app'` |
| `options.database` | `string` | `'mongo'` \| `'postgres'` \| `'mysql'` \| `'sqlite'` \| `'none'` |
| `options.features` | `string[]` | e.g. `['cron', 'rateLimit', 'morgan']` |
| `options.port` | `string` | e.g. `'5000'` |

**Directory creation logic:**

```
Always created:
  src/routes/
  src/middleware/

Created when database !== 'none':
  src/config/
  src/models/

Created when features includes 'cron':
  src/jobs/

Created when features includes 'upload':
  uploads/
```

**File write list:**

Files are collected into a `writes` array as `[relativePath, content]` pairs, then all written concurrently with `Promise.all`:

```js
// Always written
['package.json',                   templates.packageJson(options)]
['.env.example',                   templates.envExample(options)]
['.gitignore',                     templates.gitignore()]
['src/server.js',                  templates.server()]
['src/app.js',                     templates.app(options)]
['src/routes/index.js',            templates.routes()]
['src/middleware/errorHandler.js', templates.errorHandler()]

// Conditional
['src/config/database.js'          → when database !== 'none']
['src/jobs/index.js'               → when features includes 'cron']
['src/middleware/upload.js'        → when features includes 'upload']
```

`Promise.all` is used intentionally — all files are written in parallel rather than sequentially, which is faster on large projects.

---

### install()

```js
function install(targetDir): Promise<void>
```

Wraps Node's `execSync` in a Promise:

```js
execSync('npm install', { cwd: targetDir, stdio: 'ignore' });
```

- `cwd: targetDir` — runs npm install inside the generated project, not the CLI package
- `stdio: 'ignore'` — suppresses npm's own output so the ora spinner is the only feedback the user sees

---

## lib/templates/index.js — Internals

This file contains only pure functions. No file I/O, no side effects. Every function takes `options` (or a subset) and returns a string.

### Dependency Maps

Two lookup objects drive the `packageJson()` function:

#### DB_PACKAGES

```js
const DB_PACKAGES = {
  mongo:    { pkg: '"mongoose": "^8.0.0"' },
  postgres: { pkg: '"pg": "^8.11.0", "pg-hstore": "^2.3.4", "sequelize": "^6.35.0"' },
  mysql:    { pkg: '"mysql2": "^3.6.0", "sequelize": "^6.35.0"' },
  sqlite:   { pkg: '"sqlite3": "^5.1.6", "sequelize": "^6.35.0"' },
};
```

#### FEATURE_PACKAGES

```js
const FEATURE_PACKAGES = {
  cron:       '"cron-guardian": "^1.0.2"',
  upload:     '"multer": "^1.4.5-lts.1"',
  rateLimit:  '"express-rate-limit": "^7.1.5"',
  validation: '"joi": "^17.11.0"',
  morgan:     '"morgan": "^1.10.0"',
};
```

`packageJson()` parses these comma-separated strings and merges them into the `dependencies` object. This means the generated `package.json` only contains packages the user actually selected.

**Base packages always included (regardless of selections):**

```
express  ^4.18.2   HTTP framework
cors     ^2.8.5    Cross-Origin Resource Sharing
dotenv   ^16.3.1   Loads .env into process.env
helmet   ^7.1.0    Secure HTTP headers
```

**Dev dependencies always included:**

```
nodemon  ^3.0.2    Auto-restart on file changes
```

---

### Template Function Reference

| Function | Output file | Depends on |
|---|---|---|
| `packageJson(options)` | `package.json` | database, features, projectName |
| `envExample(options)` | `.env.example` | database, port |
| `gitignore()` | `.gitignore` | nothing |
| `server()` | `src/server.js` | nothing |
| `app(options)` | `src/app.js` | database, features |
| `routes()` | `src/routes/index.js` | nothing |
| `errorHandler()` | `src/middleware/errorHandler.js` | nothing |
| `dbConfig(db)` | `src/config/database.js` | database |
| `cronJobs()` | `src/jobs/index.js` | nothing |
| `uploadMiddleware()` | `src/middleware/upload.js` | nothing |

---

## Generated App Architecture

### Middleware Stack Order

The generated `src/app.js` applies middleware in this exact order:

```
Incoming Request
      │
      ▼
[Rate Limiter]           ← express-rate-limit (if selected)
      │                    Rejects abusive IPs before any processing
      ▼
[Helmet]                 ← Sets X-Content-Type-Options, X-Frame-Options,
      │                    Strict-Transport-Security, and more
      ▼
[CORS]                   ← Allows cross-origin requests
      │                    Restrict in production: cors({ origin: 'https://yourdomain.com' })
      ▼
[express.json()]         ← Parses JSON request bodies
      │
      ▼
[express.urlencoded()]   ← Parses form-encoded bodies
      │
      ▼
[Morgan]                 ← Logs METHOD /path STATUS response-time (if selected)
      │
      ▼
[Routes /api/*]          ← Application routes
      │
      ▼
[Error Handler]          ← Catches anything passed to next(err)
```

Rate limiting is placed first intentionally — it rejects abusive requests before any CPU or DB work is done.

---

### Request Lifecycle

```
Client
  │
  │  GET /api/health
  ▼
src/server.js            ← loads .env, starts HTTP listener
  │
  ▼
src/app.js               ← middleware stack runs top to bottom
  │
  ▼
src/routes/index.js      ← matches /api prefix, delegates to sub-routers
  │
  ▼
router.get('/health')    ← handler runs, sends response
  │
  └── res.json({ status: 'ok', timestamp: '...' })
```

For errors:

```
route handler
  │
  └── next(err)
        │
        ▼
  src/middleware/errorHandler.js
        │
        └── res.status(err.status).json({ error: err.message })
```

---

### Database Layer

#### MongoDB (Mongoose)

`src/config/database.js` calls `mongoose.connect()` on import and exports `mongoose.connection`. The connection fires `open` and `error` events which are logged to the console.

To define a model, create a file in `src/models/`:

```js
// src/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
```

#### Sequelize (PostgreSQL / MySQL / SQLite)

`src/config/database.js` exports a `Sequelize` instance. `app.js` calls `sequelize.authenticate()` on startup to verify the connection.

To auto-create tables from your models, add this to `src/app.js`:

```js
// Updates existing tables to match model definitions (safe for development)
sequelize.sync({ alter: true });

// Drops and recreates all tables (destructive — dev only)
sequelize.sync({ force: true });
```

To define a model:

```js
// src/models/Product.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  name:  { type: DataTypes.STRING,  allowNull: false },
  price: { type: DataTypes.DECIMAL, allowNull: false },
});

module.exports = Product;
```

---

### Cron Job System

`src/jobs/index.js` is `require()`d in `src/app.js` — jobs start as soon as the Express app module loads, before the HTTP server begins listening.

`cron-guardian`'s `SmartCron` wraps `node-cron` with:

| Feature | How it works |
|---|---|
| `retries` | Re-runs the handler up to N times if it throws |
| `retryDelay` | Waits N milliseconds between each retry attempt |
| `preventOverlap` | Checks `job.isRunning` before each tick — skips if still running |
| `onFailure` | Called after all retries are exhausted with `(error, job)` |

Execution results (success or failure) are stored in an internal log accessible via `guardian.getLogs()`. Each log entry contains:

```js
{
  jobName:      'daily-cleanup',
  startTime:    Date,
  endTime:      Date,
  duration:     1234,        // milliseconds
  status:       'success' | 'failure',
  errorMessage: 'string'     // only present on failure
}
```

The `guardian` instance is exported from `src/jobs/index.js` so you can expose job health over HTTP:

```js
// src/routes/index.js
const guardian = require('../jobs');

router.get('/jobs/status', (req, res) => {
  res.json({
    jobs: guardian.listJobs(),
    logs: guardian.getLogs(),
  });
});
```

---

### File Upload Pipeline

```
Client sends multipart/form-data
  │
  ▼
multer middleware (upload.single / upload.array)
  │
  ├── fileFilter checks file extension
  │     allowed: jpeg, jpg, png, gif, pdf
  │     rejected → cb(null, false) → file silently skipped
  │
  ├── size check (max 5 MB)
  │     exceeded → MulterError → errorHandler → 500
  │
  ├── diskStorage saves to uploads/{timestamp}-{originalname}
  │
  └── req.file / req.files populated → next() → route handler
```

To serve uploaded files publicly, add this to `src/app.js`:

```js
app.use('/uploads', express.static('uploads'));
```

Files are then accessible at `http://localhost:5000/uploads/{filename}`.

---

### Error Handling Flow

```
Any route or middleware
  │
  └── next(err)  or  throw (inside async handler)
        │
        ▼
  src/middleware/errorHandler.js
        │
        ├── NODE_ENV === 'development' → console.error(err.stack)
        │
        └── res.status(err.status || 500).json({ error: err.message })
```

To attach a custom HTTP status to an error:

```js
const err = new Error('Resource not found');
err.status = 404;
next(err);
```

---

## Adding a New Database

**1. Add the package mapping in `lib/templates/index.js`:**

```js
const DB_PACKAGES = {
  // existing entries...
  redis: { pkg: '"ioredis": "^5.3.2"' },
};
```

**2. Add the CLI choice in `bin/cli.js`:**

```js
{ name: `${chalk.red('●')} Redis      ${chalk.gray('(ioredis)')}`, value: 'redis' },
```

**3. Add the config template in `lib/templates/index.js` inside `dbConfig()`:**

```js
if (db === 'redis') {
  return `/**
 * config/database.js — Redis via ioredis
 * Required .env variable: REDIS_URL=redis://localhost:6379
 */
const Redis = require('ioredis');
const client = new Redis(process.env.REDIS_URL);
client.on('connect', () => console.log('[DB] Redis connected'));
module.exports = client;
`;
}
```

**4. Add the `.env` variable in `envExample()`:**

```js
if (options.database === 'redis') {
  env += `\n# ─── Redis\nREDIS_URL=redis://localhost:6379\n`;
}
```

**5. Add the directory creation in `generator.js` if needed:**

```js
if (options.database === 'redis') {
  await fs.ensureDir(path.join(targetDir, 'src/config'));
}
```

---

## Adding a New Feature

**1. Add the package to `FEATURE_PACKAGES` in `lib/templates/index.js`:**

```js
const FEATURE_PACKAGES = {
  // existing entries...
  swagger: '"swagger-ui-express": "^5.0.0", "swagger-jsdoc": "^6.2.8"',
};
```

**2. Add the CLI checkbox in `bin/cli.js`:**

```js
{ name: `API Docs      ${chalk.gray('(swagger-ui-express)')}`, value: 'swagger', checked: false },
```

**3. Add a template function in `lib/templates/index.js`:**

```js
function swaggerSetup() {
  return `/**
 * config/swagger.js
 * Mounts Swagger UI at /api-docs
 */
const swaggerUi   = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } },
  apis: ['./src/routes/*.js'],
});

module.exports = (app) => app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
`;
}
```

**4. Wire it in `generator.js`:**

```js
if (options.features.includes('swagger')) {
  writes.push(['src/config/swagger.js', templates.swaggerSetup()]);
}
```

**5. Export it from `lib/templates/index.js`:**

```js
module.exports = {
  // existing exports...
  swaggerSetup,
};
```

---

## Local Development & Testing

### Test the CLI without publishing to npm

```bash
# Inside the CLI package directory — creates a global symlink
npm link

# Now use it from anywhere
cd ~
express-backend-setup my-test-app

# Changes to your source files are reflected immediately (it's a live symlink)
# No need to re-run npm link after edits

# When done testing
cd /path/to/express-setup
npm unlink
```

### Test the generator programmatically

```js
const generator = require('./lib/generator');

generator.generate('/tmp/test-app', {
  projectName: 'test-app',
  database:    'mongo',
  features:    ['cron', 'rateLimit', 'morgan'],
  port:        '5000',
}).then(() => {
  console.log('Files generated successfully');
});
```

### Test with npx directly (no publish needed)

```bash
npx /absolute/path/to/express-setup my-test-app
```

---

## Publishing to npm

### First publish

```bash
npm login
npm publish --access public
```

### Updating

Follow semantic versioning:

| Change type | Version bump | Example |
|---|---|---|
| Bug fix | `patch` | `1.0.0` → `1.0.1` |
| New feature (backward compatible) | `minor` | `1.0.0` → `1.1.0` |
| Breaking change | `major` | `1.0.0` → `2.0.0` |

```bash
npm version patch    # or minor / major — updates package.json automatically
npm publish
```

### Verify before publishing

```bash
# See exactly what files will be included in the published package
npm pack --dry-run
```

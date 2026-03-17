/**
 * templates/index.js
 *
 * Pure functions that return generated file contents as strings.
 * No file I/O happens here — all writing is handled by generator.js.
 */

// ─── Dependency maps ──────────────────────────────────────────────────────────

const DB_PACKAGES = {
  mongo:    'mongoose:^8.0.0',
  postgres: 'pg:^8.11.0,pg-hstore:^2.3.4,sequelize:^6.35.0',
  mysql:    'mysql2:^3.6.0,sequelize:^6.35.0',
  sqlite:   'sqlite3:^5.1.6,sequelize:^6.35.0',
};

const FEATURE_PACKAGES = {
  cron:       'cron-guardian:^1.0.2',
  rateLimit:  'express-rate-limit:^7.1.5',
  validation: 'joi:^17.11.0',
  morgan:     'morgan:^1.10.0',
};

const UPLOAD_PACKAGES = {
  local:       'multer:^1.4.5-lts.1',
  cloudinary:  'multer:^1.4.5-lts.1,cloudinary:^2.0.0,multer-storage-cloudinary:^4.0.0',
  s3:          'multer:^1.4.5-lts.1,@aws-sdk/client-s3:^3.0.0,multer-s3:^3.0.1',
  firebase:    'multer:^1.4.5-lts.1,firebase-admin:^12.0.0',
  uploadcare:  '@uploadcare/upload-client:^6.0.0',
  mux:         '@mux/mux-node:^8.0.0',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePkgString(str) {
  const deps = {};
  str.split(',').forEach((p) => {
    const idx = p.lastIndexOf(':');
    deps[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  });
  return deps;
}

// ─── package.json ─────────────────────────────────────────────────────────────

function packageJson(options) {
  const deps = {
    express: '^4.18.2',
    cors:    '^2.8.5',
    dotenv:  '^16.3.1',
    helmet:  '^7.1.0',
  };

  if (options.database !== 'none') {
    Object.assign(deps, parsePkgString(DB_PACKAGES[options.database]));
  }

  options.features.forEach((f) => {
    if (FEATURE_PACKAGES[f]) Object.assign(deps, parsePkgString(FEATURE_PACKAGES[f]));
    if (f === 'upload' && options.uploadProvider) {
      Object.assign(deps, parsePkgString(UPLOAD_PACKAGES[options.uploadProvider] || UPLOAD_PACKAGES.local));
    }
  });

  return JSON.stringify(
    {
      name:    options.projectName,
      version: '1.0.0',
      main:    'src/server.js',
      scripts: { start: 'node src/server.js', dev: 'nodemon src/server.js' },
      dependencies:    deps,
      devDependencies: { nodemon: '^3.0.2' },
    },
    null,
    2
  );
}

// ─── .env.example ─────────────────────────────────────────────────────────────

function envExample(options) {
  let env = `# ─── App ──────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=${options.port || 5000}
`;

  if (options.database === 'mongo') {
    env += `
# ─── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/${options.projectName}
`;
  } else if (['postgres', 'mysql', 'sqlite'].includes(options.database)) {
    const port = options.database === 'postgres' ? '5432' : '3306';
    if (options.database === 'sqlite') {
      env += `
# ─── SQLite ───────────────────────────────────────────────────────────────────
DB_STORAGE=./${options.projectName}.sqlite
`;
    } else {
      env += `
# ─── ${options.database === 'postgres' ? 'PostgreSQL' : 'MySQL'} ───────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=${port}
DB_NAME=${options.projectName}
DB_USER=${options.database === 'postgres' ? 'postgres' : 'root'}
DB_PASS=password
`;
    }
  }

  if (options.features && options.features.includes('upload')) {
    switch (options.uploadProvider) {
      case 'cloudinary':
        env += `
# ─── Cloudinary ───────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
`;
        break;
      case 's3':
        env += `
# ─── AWS S3 ───────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name
`;
        break;
      case 'firebase':
        env += `
# ─── Firebase Storage ─────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
`;
        break;
      case 'uploadcare':
        env += `
# ─── Uploadcare ───────────────────────────────────────────────────────────────
UPLOADCARE_PUBLIC_KEY=your_public_key
UPLOADCARE_SECRET_KEY=your_secret_key
`;
        break;
      case 'mux':
        env += `
# ─── Mux ──────────────────────────────────────────────────────────────────────
MUX_TOKEN_ID=your_token_id
MUX_TOKEN_SECRET=your_token_secret
`;
        break;
    }
  }

  return env;
}

// ─── .gitignore ───────────────────────────────────────────────────────────────

function gitignore() {
  return `node_modules/
.env
uploads/
*.sqlite
`;
}

// ─── src/app.js ───────────────────────────────────────────────────────────────

function app(options) {
  const { features, database } = options;
  const lines = [];

  lines.push(`require('dotenv').config();`);
  lines.push(`const express = require('express');`);
  lines.push(`const cors    = require('cors');`);
  lines.push(`const helmet  = require('helmet');`);
  if (features.includes('morgan'))    lines.push(`const morgan    = require('morgan');`);
  if (features.includes('rateLimit')) lines.push(`const rateLimit = require('express-rate-limit');`);
  lines.push(`const errorHandler = require('./middleware/errorHandler');`);
  lines.push(`const routes       = require('./routes');`);
  if (database !== 'none') lines.push(`const db = require('./config/database');`);
  if (features.includes('cron'))      lines.push(`require('./jobs');`);
  lines.push(`\nconst app = express();\n`);

  if (features.includes('rateLimit')) {
    lines.push(`app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));`);
  }
  lines.push(`app.use(helmet());`);
  lines.push(`app.use(cors());`);
  lines.push(`app.use(express.json());`);
  lines.push(`app.use(express.urlencoded({ extended: true }));`);
  if (features.includes('morgan')) lines.push(`app.use(morgan('dev'));`);

  if (features.includes('upload') && options.uploadProvider === 'local') {
    lines.push(`\n// Serve uploaded files as static assets — accessible at /uploads/<filename>`);
    lines.push(`app.use('/uploads', express.static('uploads'));`);
  }
  lines.push(`\napp.use('/api', routes);`);
  lines.push(`app.use(errorHandler);`);

  if (database !== 'none') {
    lines.push(`\ndb.authenticate()`);
    lines.push(`  .then(() => console.log('[DB] Connection established successfully'))`);
    lines.push(`  .catch((err) => console.error('[DB] Unable to connect:', err.message));`);
  }

  lines.push(`\nmodule.exports = app;`);
  return lines.join('\n');
}

// ─── src/server.js ────────────────────────────────────────────────────────────

function server() {
  return `require('dotenv').config();
const app  = require('./app');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(\`[SERVER] Running in \${process.env.NODE_ENV} mode on port \${PORT}\`);
});
`;
}

// ─── src/routes/index.js ──────────────────────────────────────────────────────

function routes(options) {
  const hasUpload = options.features && options.features.includes('upload');
  let out = `const router = require('express').Router();\n`;
  if (hasUpload) out += `const uploadRoutes = require('./upload');\n`;
  out += `
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
`;
  if (hasUpload) out += `\nrouter.use('/upload', uploadRoutes);\n`;
  out += `\nmodule.exports = router;\n`;
  return out;
}

// ─── src/middleware/errorHandler.js ───────────────────────────────────────────

function errorHandler() {
  return `module.exports = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
};
`;
}

// ─── src/config/database.js ───────────────────────────────────────────────────

function dbConfig(db) {
  if (db === 'mongo') {
    return `const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI);

const conn = mongoose.connection;
conn.on('error', (err) => console.error('[DB] MongoDB error:', err.message));
conn.once('open', () => console.log('[DB] MongoDB connected'));

module.exports = conn;
`;
  }

  const dialectConfig = {
    postgres: `dialect: 'postgres', host: process.env.DB_HOST, port: process.env.DB_PORT,
  username: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,`,
    mysql:    `dialect: 'mysql', host: process.env.DB_HOST, port: process.env.DB_PORT,
  username: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,`,
    sqlite:   `dialect: 'sqlite', storage: process.env.DB_STORAGE,`,
  };

  return `const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({ ${dialectConfig[db]} logging: false });

module.exports = sequelize;
`;
}

// ─── src/jobs/index.js ────────────────────────────────────────────────────────

function cronJobs() {
  return `const { SmartCron } = require('cron-guardian');

const guardian = new SmartCron();

guardian.schedule(
  '0 0 * * *',
  async () => {
    console.log('[CRON] daily-cleanup started');
    // TODO: add your cleanup logic here
  },
  {
    name: 'daily-cleanup',
    retries: 3,
    retryDelay: 5000,
    preventOverlap: true,
    onFailure: (err, job) => console.error(\`[CRON] \${job.name} failed:\`, err.message),
  }
);

guardian.schedule(
  '0 * * * *',
  async () => {
    console.log('[CRON] hourly-sync started');
    // TODO: add your sync logic here
  },
  {
    name: 'hourly-sync',
    retries: 2,
    retryDelay: 3000,
    preventOverlap: true,
    onFailure: (err, job) => console.error(\`[CRON] \${job.name} failed:\`, err.message),
  }
);

module.exports = guardian;
`;
}

// ─── src/middleware/upload.js — per provider ──────────────────────────────────

function uploadLocal() {
  return `const multer = require('multer');
const path   = require('path');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, \`\${Date.now()}-\${file.originalname}\`),
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
`;
}

function uploadCloudinary() {
  return `const multer              = require('multer');
const cloudinary          = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'uploads', allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf'] },
});

module.exports = { upload: multer({ storage }), cloudinary };
`;
}

function uploadS3() {
  return `const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multerS3({
  s3,
  bucket: process.env.AWS_BUCKET_NAME,
  key: (req, file, cb) => cb(null, \`\${Date.now()}-\${file.originalname}\`),
});

module.exports = { upload: multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }), s3 };
`;
}

function uploadFirebase() {
  return `const multer = require('multer');
const admin  = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

// Files are held in memory then streamed to Firebase
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload, bucket };
`;
}

function uploadUploadcare() {
  return `const { UploadClient } = require('@uploadcare/upload-client');

// Uploadcare handles uploads directly from the client or via signed server requests.
// This module exports a configured client for server-side uploads.
const client = new UploadClient({ publicKey: process.env.UPLOADCARE_PUBLIC_KEY });

module.exports = { client };
`;
}

function uploadMux() {
  return `const Mux = require('@mux/mux-node');

const mux = new Mux({
  tokenId:     process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

module.exports = { mux };
`;
}

// ─── src/controllers/uploadController.js ─────────────────────────────────────

function uploadController(provider) {
  switch (provider) {
    case 'local':
      return `exports.uploadFile = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const host = \`\${req.protocol}://\${req.get('host')}\`;
  const url  = \`\${host}/uploads/\${req.file.filename}\`;
  res.json({ url, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype });
};
`;

    case 'cloudinary':
      return `exports.uploadFile = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // multer-storage-cloudinary puts the full CDN URL in req.file.path
  res.json({ url: req.file.path, publicId: req.file.filename, size: req.file.size, mimetype: req.file.mimetype });
};
`;

    case 's3':
      return `exports.uploadFile = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // multer-s3 sets req.file.location to the full public S3 URL
  const url = req.file.location || \`https://\${process.env.AWS_BUCKET_NAME}.s3.\${process.env.AWS_REGION}.amazonaws.com/\${req.file.key}\`;
  res.json({ url, key: req.file.key, bucket: process.env.AWS_BUCKET_NAME, size: req.file.size, mimetype: req.file.mimetype });
};
`;

    case 'firebase':
      return `const { bucket } = require('../middleware/upload');

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filename = \`\${Date.now()}-\${req.file.originalname}\`;
    const blob     = bucket.file(filename);
    const stream   = blob.createWriteStream({ metadata: { contentType: req.file.mimetype } });

    stream.on('error', next);
    stream.on('finish', async () => {
      await blob.makePublic();
      const url = \`https://storage.googleapis.com/\${bucket.name}/\${filename}\`;
      res.json({ url, filename, size: req.file.size, mimetype: req.file.mimetype });
    });

    stream.end(req.file.buffer);
  } catch (err) {
    next(err);
  }
};
`;

    case 'uploadcare':
      return `const { client } = require('../middleware/upload');

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.body.fileData) return res.status(400).json({ error: 'No fileData in request body' });

    // Expects base64-encoded file in req.body.fileData and filename in req.body.fileName
    const buffer   = Buffer.from(req.body.fileData, 'base64');
    const fileName = req.body.fileName || 'upload';
    const result   = await client.uploadFile(buffer, { fileName });
    const url      = \`https://ucarecdn.com/\${result.uuid}/\`;
    res.json({ url, uuid: result.uuid, fileName });
  } catch (err) {
    next(err);
  }
};
`;

    case 'mux':
      return `const { mux } = require('../middleware/upload');

// Step 1 — call this to get a direct upload URL, then PUT the video file to that URL from the client
exports.createUploadUrl = async (req, res, next) => {
  try {
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: { playback_policy: ['public'] },
    });
    // uploadUrl  → PUT your video file directly to this URL (no auth header needed)
    // uploadId   → save this, then poll GET /api/upload/status/:uploadId to confirm
    res.json({ uploadId: upload.id, uploadUrl: upload.url });
  } catch (err) {
    next(err);
  }
};

// Step 2 — poll this after the client PUT finishes; returns playback URL once asset is ready
exports.getUploadStatus = async (req, res, next) => {
  try {
    const upload = await mux.video.uploads.retrieve(req.params.uploadId);
    const response = { status: upload.status, assetId: upload.asset_id || null };
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);
      const playbackId = asset.playback_ids && asset.playback_ids[0] && asset.playback_ids[0].id;
      if (playbackId) response.url = \`https://stream.mux.com/\${playbackId}.m3u8\`;
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
};
`;
  }
}

// ─── src/routes/upload.js ─────────────────────────────────────────────────────

function uploadRoute(provider) {
  if (provider === 'mux') {
    return `const router     = require('express').Router();
const controller = require('../controllers/uploadController');

router.post('/', controller.createUploadUrl);
router.get('/status/:uploadId', controller.getUploadStatus);

module.exports = router;
`;
  }

  if (provider === 'uploadcare') {
    return `const router     = require('express').Router();
const controller = require('../controllers/uploadController');

// POST /api/upload — body: { fileData: '<base64>', fileName: 'photo.jpg' }
router.post('/', controller.uploadFile);

module.exports = router;
`;
  }

  // local, cloudinary, s3, firebase — all use multer middleware
  const middlewareImport = provider === 'local'
    ? `const upload     = require('../middleware/upload');`
    : `const { upload } = require('../middleware/upload');`;

  return `const router     = require('express').Router();
const controller = require('../controllers/uploadController');
${middlewareImport}

// POST /api/upload — multipart/form-data, field name: 'file'
router.post('/', upload.single('file'), controller.uploadFile);

module.exports = router;
`;
}

// ─── src/controllers/sampleController.js ─────────────────────────────────────

function sampleController() {
  return `/**
 * controllers/sampleController.js
 *
 * Example CRUD controller — replace with your own resource and DB queries.
 * All async errors are forwarded to the global error handler via next(err).
 */

exports.getAll = async (req, res, next) => {
  try {
    // TODO: const items = await YourModel.find();
    res.json({ items: [] });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: const item = await YourModel.findById(id);
    res.json({ item: { id } });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    // TODO: const item = await YourModel.create(req.body);
    res.status(201).json({ item: req.body });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: const item = await YourModel.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ item: { id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: await YourModel.findByIdAndDelete(id);
    res.json({ message: \`Item \${id} deleted\` });
  } catch (err) {
    next(err);
  }
};
`;
}

// ─── tsconfig.json ───────────────────────────────────────────────────────────

function tsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target:          'ES2020',
      module:          'commonjs',
      lib:             ['ES2020'],
      outDir:          './dist',
      rootDir:         './src',
      strict:          true,
      esModuleInterop: true,
      skipLibCheck:    true,
      resolveJsonModule: true,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  }, null, 2);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  packageJson,
  envExample,
  gitignore,
  app,
  server,
  routes,
  errorHandler,
  dbConfig,
  cronJobs,
  uploadLocal,
  uploadCloudinary,
  uploadS3,
  uploadFirebase,
  uploadUploadcare,
  uploadMux,
  uploadController,
  uploadRoute,
  sampleController,
  tsConfig,
};

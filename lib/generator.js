/**
 * generator.js
 *
 * Orchestrates the full project scaffolding process:
 *   1. Creates the required directory structure
 *   2. Writes all generated files to disk (based on user selections)
 *   3. Runs `npm install` inside the new project folder
 */

const fs           = require('fs-extra');
const path         = require('path');
const { execSync } = require('child_process');
const templates    = require('./templates');

/**
 * generate(targetDir, options)
 *
 * @param {string} targetDir  - Absolute path to the new project folder
 * @param {object} options
 *   @param {string}   options.projectName    - e.g. 'my-app'
 *   @param {string}   options.database       - 'mongo' | 'postgres' | 'mysql' | 'sqlite' | 'none'
 *   @param {string[]} options.features       - ['cron', 'upload', 'rateLimit', 'validation', 'morgan']
 *   @param {string}   options.uploadProvider - 'local' | 'cloudinary' | 's3' | 'firebase' | 'uploadcare' | 'mux'
 *   @param {string}   options.port           - e.g. '5000'
 */
async function generate(targetDir, options) {
  const { features, database, uploadProvider } = options;

  // ── Create directory structure ─────────────────────────────────────────────
  // Always created
  await fs.ensureDir(path.join(targetDir, 'src/routes'));
  await fs.ensureDir(path.join(targetDir, 'src/middleware'));
  await fs.ensureDir(path.join(targetDir, 'src/controllers'));

  // Database directories — only when a DB is selected
  if (database !== 'none') {
    await fs.ensureDir(path.join(targetDir, 'src/config'));
    await fs.ensureDir(path.join(targetDir, 'src/models'));
  }

  // Feature-specific directories
  if (features.includes('cron'))                                    await fs.ensureDir(path.join(targetDir, 'src/jobs'));
  if (features.includes('upload') && uploadProvider === 'local')   await fs.ensureDir(path.join(targetDir, 'uploads'));

  // ── Build file write list ──────────────────────────────────────────────────
  // Every entry is [relativePath, fileContent]
  const writes = [
    ['package.json',                   templates.packageJson(options)],
    ['.env.example',                   templates.envExample(options)],
    ['.gitignore',                     templates.gitignore()],
    ['src/server.js',                  templates.server()],
    ['src/app.js',                     templates.app(options)],
    ['src/routes/index.js',            templates.routes(options)],
    ['src/middleware/errorHandler.js', templates.errorHandler()],
    // Sample controller — always generated so user understands the pattern
    ['src/controllers/sampleController.js', templates.sampleController()],
  ];

  // Database config
  if (database !== 'none') {
    writes.push(['src/config/database.js', templates.dbConfig(database)]);
  }

  // Cron jobs
  if (features.includes('cron')) {
    writes.push(['src/jobs/index.js', templates.cronJobs()]);
  }

  // ── Upload middleware — routed by provider ─────────────────────────────────
  // Each provider gets its own dedicated template with correct packages and API
  if (features.includes('upload')) {
    switch (uploadProvider) {
      case 'local':
        writes.push(['src/middleware/upload.js', templates.uploadLocal()]);
        break;
      case 'cloudinary':
        writes.push(['src/middleware/upload.js', templates.uploadCloudinary()]);
        break;
      case 's3':
        writes.push(['src/middleware/upload.js', templates.uploadS3()]);
        break;
      case 'firebase':
        writes.push(['src/middleware/upload.js', templates.uploadFirebase()]);
        break;
      case 'uploadcare':
        writes.push(['src/middleware/upload.js', templates.uploadUploadcare()]);
        break;
      case 'mux':
        writes.push(['src/middleware/upload.js', templates.uploadMux()]);
        break;
    }

    // Upload controller — test API for the selected provider
    writes.push(['src/controllers/uploadController.js', templates.uploadController(uploadProvider)]);
    // Upload route — POST /api/upload
    writes.push(['src/routes/upload.js', templates.uploadRoute(uploadProvider)]);
  }

  // ── Write all files concurrently ───────────────────────────────────────────
  await Promise.all(
    writes.map(([file, content]) =>
      fs.outputFile(path.join(targetDir, file), content)
    )
  );
}

/**
 * install(targetDir)
 *
 * Runs `npm install` inside the newly generated project folder.
 * Uses stdio: 'ignore' to suppress npm output — ora spinner handles feedback.
 *
 * @param {string} targetDir - Absolute path to the generated project folder
 */
function install(targetDir) {
  return new Promise((resolve, reject) => {
    try {
      execSync('npm install', { cwd: targetDir, stdio: 'ignore' });
      resolve();
    } catch (err) {
      reject(new Error('npm install failed: ' + err.message));
    }
  });
}

module.exports = { generate, install };

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
  const { features, database, uploadProvider, language } = options;
  const ext = language === 'ts' ? 'ts' : 'js';

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
    ['package.json',                              templates.packageJson(options)],
    ['.env.example',                              templates.envExample(options)],
    ['.gitignore',                                templates.gitignore()],
    [`src/server.${ext}`,                         templates.server(language)],
    [`src/app.${ext}`,                            templates.app(options)],
    [`src/routes/index.${ext}`,                   templates.routes(options)],
    [`src/middleware/errorHandler.${ext}`,        templates.errorHandler(language)],
    [`src/controllers/sampleController.${ext}`,   templates.sampleController(language)],
  ];

  if (language === 'ts') {
    writes.push(['tsconfig.json', templates.tsConfig()]);
  }

  // Database config
  if (database !== 'none') {
    writes.push([`src/config/database.${ext}`, templates.dbConfig(database, language)]);
  }

  // Cron jobs
  if (features.includes('cron')) {
    writes.push([`src/jobs/index.${ext}`, templates.cronJobs(language)]);
  }

  // ── Upload middleware — routed by provider ─────────────────────────────────
  // Each provider gets its own dedicated template with correct packages and API
  if (features.includes('upload')) {
    switch (uploadProvider) {
      case 'local':       writes.push([`src/middleware/upload.${ext}`, templates.uploadLocal(language)]);        break;
      case 'cloudinary':  writes.push([`src/middleware/upload.${ext}`, templates.uploadCloudinary(language)]);   break;
      case 's3':          writes.push([`src/middleware/upload.${ext}`, templates.uploadS3(language)]);           break;
      case 'firebase':    writes.push([`src/middleware/upload.${ext}`, templates.uploadFirebase(language)]);     break;
      case 'uploadcare':  writes.push([`src/middleware/upload.${ext}`, templates.uploadUploadcare(language)]);   break;
      case 'mux':         writes.push([`src/middleware/upload.${ext}`, templates.uploadMux(language)]);          break;
    }

    writes.push([`src/controllers/uploadController.${ext}`, templates.uploadController(uploadProvider, language)]);
    writes.push([`src/routes/upload.${ext}`,                templates.uploadRoute(uploadProvider, language)]);
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

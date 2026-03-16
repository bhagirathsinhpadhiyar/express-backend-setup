#!/usr/bin/env node

/**
 * bin/cli.js
 *
 * CLI entry point for express-backend-setup.
 *
 * Usage:
 *   npx express-backend-setup my-app   ← skips the project name prompt
 *   npx express-backend-setup          ← asks for project name interactively
 *
 * Flow:
 *   1. Print banner
 *   2. Collect user input via interactive prompts (inquirer)
 *   3. Print a project summary
 *   4. Validate the target directory doesn't already exist
 *   5. Scaffold all project files  (generator.generate)
 *   6. Run npm install inside the new project (generator.install)
 *   7. Print generated file tree + installed packages + next steps
 */

const inquirer  = require('inquirer');
const chalk     = require('chalk');
const ora       = require('ora');
const path      = require('path');
const fs        = require('fs');
const generator = require('../lib/generator');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Prints a full-width horizontal divider line */
const divider = () => console.log(chalk.gray('─'.repeat(60)));

/** Prints an empty line */
const gap = () => console.log('');

// ── Banner ────────────────────────────────────────────────────────────────────

gap();
divider();
console.log(chalk.bold.cyan('  🚀  express-backend-setup'));
console.log(chalk.gray('  Scaffold a production-ready Express.js backend instantly'));
divider();
gap();

// Allow passing the project name directly as a CLI argument:
//   express-backend-setup my-app
const argProjectName = process.argv[2];

// ── Interactive prompts ───────────────────────────────────────────────────────
const questions = [

  // ── Project name ────────────────────────────────────────────────────────────
  // Skipped if provided as a CLI argument (e.g. express-backend-setup my-app)
  ...(!argProjectName ? [{
    type:     'input',
    name:     'projectName',
    message:  chalk.white('Project name:'),
    default:  'my-backend',
    validate: (v) => /^[a-z0-9-_]+$/.test(v) || chalk.red('Use lowercase letters, numbers, hyphens only'),
  }] : []),

  // ── Language ─────────────────────────────────────────────────────────────────
  // Determines whether .js or .ts files are generated, and whether
  // tsconfig.json + ts-node/typescript devDependencies are added
  {
    type:    'list',
    name:    'language',
    message: chalk.white('Select language:'),
    choices: [
      { name: `${chalk.yellow('JS')}  JavaScript  ${chalk.gray('(CommonJS, no compilation needed)')}`, value: 'js' },
      { name: `${chalk.blue('TS')}  TypeScript  ${chalk.gray('(tsconfig, ts-node, full type safety)')}`, value: 'ts' },
    ],
  },

  // ── Database ─────────────────────────────────────────────────────────────────
  // Single choice — drives which DB driver is installed and which
  // config/database file is generated
  {
    type:    'list',
    name:    'database',
    message: chalk.white('Select a database:'),
    choices: [
      { name: `${chalk.green('●')} MongoDB    ${chalk.gray('(Mongoose)')}`,             value: 'mongo'    },
      { name: `${chalk.blue('●')} PostgreSQL ${chalk.gray('(pg + Sequelize)')}`,        value: 'postgres' },
      { name: `${chalk.yellow('●')} MySQL     ${chalk.gray('(mysql2 + Sequelize)')}`,   value: 'mysql'    },
      { name: `${chalk.magenta('●')} SQLite   ${chalk.gray('(Sequelize)')}`,            value: 'sqlite'   },
      { name: `${chalk.gray('●')} None`,                                                 value: 'none'     },
    ],
  },

  // ── Features ─────────────────────────────────────────────────────────────────
  // Multi-select checkboxes — only selected features are installed and generated
  {
    type:    'checkbox',
    name:    'features',
    message: chalk.white('Select features to include:'),
    choices: [
      { name: `Cron Jobs     ${chalk.gray('(cron-guardian)')}`,       value: 'cron',       checked: true  },
      { name: `File Upload   ${chalk.gray('(multer / cloud)')}`,      value: 'upload',     checked: false },
      { name: `Rate Limiting ${chalk.gray('(express-rate-limit)')}`,  value: 'rateLimit',  checked: true  },
      { name: `Validation    ${chalk.gray('(joi)')}`,                 value: 'validation', checked: false },
      { name: `API Logging   ${chalk.gray('(morgan)')}`,              value: 'morgan',     checked: true  },
    ],
  },

  // ── Upload storage provider ───────────────────────────────────────────────────
  // Only shown when the user selected "File Upload" above.
  // Drives which upload middleware template and which npm packages are generated.
  {
    type:    'list',
    name:    'uploadProvider',
    message: chalk.white('Select upload storage provider:'),
    when:    (answers) => answers.features.includes('upload'),
    choices: [
      {
        name:  `${chalk.white('Local Disk')}       ${chalk.gray('(multer — saves to uploads/ folder)')}`,
        value: 'local',
      },
      {
        name:  `${chalk.yellow('Cloudinary')}       ${chalk.gray('(cloud image & video CDN)')}`,
        value: 'cloudinary',
      },
      {
        name:  `${chalk.yellow('AWS S3')}           ${chalk.gray('(Amazon Simple Storage Service)')}`,
        value: 's3',
      },
      {
        name:  `${chalk.yellow('Firebase Storage')} ${chalk.gray('(Google Firebase file storage)')}`,
        value: 'firebase',
      },
      {
        name:  `${chalk.yellow('Uploadcare')}       ${chalk.gray('(file upload & delivery platform)')}`,
        value: 'uploadcare',
      },
      {
        name:  `${chalk.yellow('Mux')}              ${chalk.gray('(video upload & streaming platform)')}`,
        value: 'mux',
      },
    ],
  },

  // ── Server port ───────────────────────────────────────────────────────────────
  {
    type:    'input',
    name:    'port',
    message: chalk.white('Default server port:'),
    default: '5000',
  },
];

// ── Run prompts and generate project ─────────────────────────────────────────
inquirer.prompt(questions).then(async (answers) => {

  // Merge CLI argument into answers if project name was passed directly
  if (argProjectName) answers.projectName = argProjectName;

  // Default uploadProvider to 'local' if upload was not selected
  if (!answers.features.includes('upload')) answers.uploadProvider = 'none';

  const targetDir = path.join(process.cwd(), answers.projectName);
  const ext       = answers.language === 'ts' ? 'ts' : 'js';

  // ── Project Summary ──────────────────────────────────────────────────────────
  // Show the user exactly what will be generated before doing anything
  gap();
  divider();
  console.log(chalk.bold.white('  📋  Project Summary'));
  divider();
  console.log(`  ${chalk.gray('Name')}      ${chalk.cyan(answers.projectName)}`);
  console.log(`  ${chalk.gray('Language')}  ${answers.language === 'ts' ? chalk.blue('TypeScript') : chalk.yellow('JavaScript')}`);
  console.log(`  ${chalk.gray('Database')}  ${chalk.cyan(answers.database === 'none' ? 'None' : answers.database)}`);
  console.log(`  ${chalk.gray('Port')}      ${chalk.cyan(answers.port)}`);
  console.log(`  ${chalk.gray('Features')}  ${
    answers.features.length
      ? answers.features.map(f => chalk.cyan(f)).join(chalk.gray(', '))
      : chalk.gray('none selected')
  }`);
  if (answers.features.includes('upload')) {
    console.log(`  ${chalk.gray('Upload')}    ${chalk.cyan(answers.uploadProvider)}`);
  }
  divider();
  gap();

  // ── Directory conflict check ──────────────────────────────────────────────────
  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`  ✖  Directory "${answers.projectName}" already exists.`));
    console.log(chalk.gray(`     Delete it or choose a different project name.\n`));
    process.exit(1);
  }

  // ── Step 1 — Scaffold files ───────────────────────────────────────────────────
  const spinnerFiles = ora({
    text:    chalk.white('Scaffolding project files...'),
    spinner: 'dots',
  }).start();

  try {
    await generator.generate(targetDir, answers);
    spinnerFiles.succeed(chalk.green('Project files created'));
  } catch (err) {
    spinnerFiles.fail(chalk.red('Failed to scaffold project files'));
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  }

  // ── Step 2 — Install dependencies ────────────────────────────────────────────
  const spinnerInstall = ora({
    text:    chalk.white('Installing dependencies  (this may take a minute)...'),
    spinner: 'dots',
  }).start();

  try {
    await generator.install(targetDir);
    spinnerInstall.succeed(chalk.green('Dependencies installed'));
  } catch (err) {
    spinnerInstall.fail(chalk.red('npm install failed'));
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  }

  // ── Generated file tree ───────────────────────────────────────────────────────
  gap();
  divider();
  console.log(chalk.bold.white('  📁  Generated Structure'));
  divider();
  console.log(`  ${chalk.cyan(answers.projectName + '/')}`);
  console.log(`  ${chalk.gray('├──')} ${chalk.white('src/')}`);
  console.log(`  ${chalk.gray('│   ├──')} ${chalk.white(`server.${ext}`)}          ${chalk.gray('← entry point, starts HTTP server')}`);
  console.log(`  ${chalk.gray('│   ├──')} ${chalk.white(`app.${ext}`)}             ${chalk.gray('← express setup, middleware, routes')}`);
  console.log(`  ${chalk.gray('│   ├──')} ${chalk.white('routes/')}`);
  console.log(`  ${chalk.gray('│   │   └──')} ${chalk.white(`index.${ext}`)}       ${chalk.gray('← /api/health endpoint')}`);
  console.log(`  ${chalk.gray('│   ├──')} ${chalk.white('middleware/')}`);
  console.log(`  ${chalk.gray('│   │   └──')} ${chalk.white(`errorHandler.${ext}`)} ${chalk.gray('← global error handler')}`);

  if (answers.database !== 'none') {
    console.log(`  ${chalk.gray('│   ├──')} ${chalk.white('config/')}`);
    console.log(`  ${chalk.gray('│   │   └──')} ${chalk.white(`database.${ext}`)}   ${chalk.gray('← db connection')}`);
    console.log(`  ${chalk.gray('│   └──')} ${chalk.white('models/')}           ${chalk.gray('← add your models here')}`);
  }

  if (answers.features.includes('cron')) {
    console.log(`  ${chalk.gray('│   └──')} ${chalk.white('jobs/')}`);
    console.log(`  ${chalk.gray('│       └──')} ${chalk.white(`index.${ext}`)}      ${chalk.gray('← cron-guardian schedules')}`);
  }

  if (answers.features.includes('upload')) {
    const providerLabel = {
      local:      'multer local disk',
      cloudinary: 'cloudinary upload',
      s3:         'aws s3 upload',
      firebase:   'firebase storage upload',
      uploadcare: 'uploadcare upload',
      mux:        'mux video upload',
    }[answers.uploadProvider];
    console.log(`  ${chalk.gray('│   └──')} ${chalk.white('middleware/')}`);
    console.log(`  ${chalk.gray('│       └──')} ${chalk.white(`upload.${ext}`)}     ${chalk.gray(`← ${providerLabel}`)}`);
  }

  if (answers.language === 'ts') {
    console.log(`  ${chalk.gray('├──')} ${chalk.white('tsconfig.json')}          ${chalk.gray('← TypeScript compiler config')}`);
  }
  console.log(`  ${chalk.gray('├──')} ${chalk.white('.env.example')}           ${chalk.gray('← copy to .env and fill values')}`);
  console.log(`  ${chalk.gray('├──')} ${chalk.white('.gitignore')}`);
  console.log(`  ${chalk.gray('└──')} ${chalk.white('package.json')}`);
  divider();

  // ── Installed packages ────────────────────────────────────────────────────────
  gap();
  console.log(chalk.bold.white('  📦  Installed Packages'));
  divider();

  const always = ['express', 'cors', 'helmet', 'dotenv'];
  always.forEach(p => console.log(`  ${chalk.green('✔')}  ${chalk.white(p)}`));

  const dbLabels = {
    mongo:    'mongoose',
    postgres: 'pg + pg-hstore + sequelize',
    mysql:    'mysql2 + sequelize',
    sqlite:   'sqlite3 + sequelize',
  };
  if (answers.database !== 'none') {
    console.log(`  ${chalk.green('✔')}  ${chalk.white(dbLabels[answers.database])}`);
  }

  const featureLabels = {
    cron:       'cron-guardian',
    rateLimit:  'express-rate-limit',
    validation: 'joi',
    morgan:     'morgan',
  };
  answers.features.filter(f => f !== 'upload').forEach(f => {
    console.log(`  ${chalk.green('✔')}  ${chalk.white(featureLabels[f])}`);
  });

  // Upload provider packages
  if (answers.features.includes('upload')) {
    const uploadLabels = {
      local:      'multer',
      cloudinary: 'multer + cloudinary + multer-storage-cloudinary',
      s3:         'multer + @aws-sdk/client-s3 + multer-s3',
      firebase:   'multer + firebase-admin',
      uploadcare: '@uploadcare/upload-client',
      mux:        '@mux/mux-node',
    };
    console.log(`  ${chalk.green('✔')}  ${chalk.white(uploadLabels[answers.uploadProvider])}`);
  }

  if (answers.language === 'ts') {
    console.log(`  ${chalk.green('✔')}  ${chalk.white('typescript + ts-node + @types/node + @types/express')} ${chalk.gray('(dev)')}`);
  }

  divider();

  // ── Next steps ────────────────────────────────────────────────────────────────
  gap();
  console.log(chalk.bold.green('  ✔  Success! ') + chalk.white('Your project is ready at ') + chalk.cyan(`./${answers.projectName}`));
  gap();
  console.log(chalk.bold.white('  🏁  Next Steps'));
  divider();
  console.log(`  ${chalk.gray('1.')}  ${chalk.cyan(`cd ${answers.projectName}`)}`);
  console.log(`  ${chalk.gray('2.')}  ${chalk.cyan('cp .env.example .env')}     ${chalk.gray('← fill in your environment values')}`);
  console.log(`  ${chalk.gray('3.')}  ${chalk.cyan('npm run dev')}              ${chalk.gray('← start the development server')}`);
  divider();
  gap();
  console.log(`  ${chalk.gray('Health check →')}  ${chalk.cyan(`http://localhost:${answers.port}/api/health`)}`);
  gap();
  divider();
  gap();
});

#!/usr/bin/env node

// Setup validation script for Courtesy Inspection Server
// Validates architecture, dependencies, and configuration

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Courtesy Inspection Server Setup...\n');

const checks = [];

// Check required files exist
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'src/server.ts',
  'src/types/entities.ts',
  'src/types/dtos.ts',
  'src/types/common.ts',
  'src/repositories/BaseRepository.ts',
  'src/repositories/UserRepository.ts',
  'src/repositories/InspectionRepository.ts',
  'src/repositories/CustomerRepository.ts',
  'src/services/AuthService.ts',
  'src/services/InspectionService.ts',
  'src/services/VoiceService.ts',
  'src/services/SMSService.ts',
  'src/controllers/AuthController.ts',
  'src/controllers/InspectionController.ts',
  'src/middleware/auth.ts',
  'src/middleware/validation.ts',
  'src/middleware/error.ts',
  'src/validators/schemas.ts',
  'src/utils/database.ts',
  'src/utils/logger.ts'
];

let filesExist = 0;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    filesExist++;
  } else {
    console.log(`❌ Missing file: ${file}`);
  }
});

checks.push({
  name: 'Required files',
  passed: filesExist === requiredFiles.length,
  details: `${filesExist}/${requiredFiles.length} files found`
});

// Check package.json dependencies
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const requiredDeps = [
  'express', 'pg', 'bcrypt', 'jsonwebtoken', 'joi', 'cors', 'helmet', 'compression', 'multer', 'dotenv', 'uuid'
];

let depsFound = 0;
requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    depsFound++;
  } else {
    console.log(`❌ Missing dependency: ${dep}`);
  }
});

checks.push({
  name: 'Dependencies',
  passed: depsFound === requiredDeps.length,
  details: `${depsFound}/${requiredDeps.length} dependencies found`
});

// Check TypeScript configuration
const tsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tsconfig.json'), 'utf8'));
const strictMode = tsConfig.compilerOptions.strict;
const targetES2020 = tsConfig.compilerOptions.target === 'ES2020';

checks.push({
  name: 'TypeScript config',
  passed: strictMode && targetES2020,
  details: `Strict: ${strictMode}, Target: ${tsConfig.compilerOptions.target}`
});

// Check directory structure
const requiredDirs = [
  'src/controllers',
  'src/services', 
  'src/repositories',
  'src/middleware',
  'src/validators',
  'src/utils',
  'src/types'
];

let dirsExist = 0;
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    dirsExist++;
  } else {
    console.log(`❌ Missing directory: ${dir}`);
  }
});

checks.push({
  name: 'Directory structure',
  passed: dirsExist === requiredDirs.length,
  details: `${dirsExist}/${requiredDirs.length} directories found`
});

// Check template files are accessible (from project root)
const templateFiles = [
  'templates/db.js',
  'templates/auth.js', 
  'templates/voice-parser.js',
  'templates/sms-templates.js'
];

let templatesFound = 0;
templateFiles.forEach(template => {
  const templatePath = path.join(__dirname, '../../', template);
  if (fs.existsSync(templatePath)) {
    templatesFound++;
  } else {
    console.log(`❌ Missing template: ${template}`);
  }
});

checks.push({
  name: 'Template files',
  passed: templatesFound === templateFiles.length,
  details: `${templatesFound}/${templateFiles.length} templates found`
});

// Check scripts in package.json
const requiredScripts = ['build', 'start', 'dev', 'test', 'lint'];
let scriptsFound = 0;
requiredScripts.forEach(script => {
  if (packageJson.scripts[script]) {
    scriptsFound++;
  } else {
    console.log(`❌ Missing script: ${script}`);
  }
});

checks.push({
  name: 'NPM scripts',
  passed: scriptsFound === requiredScripts.length,
  details: `${scriptsFound}/${requiredScripts.length} scripts found`
});

// Print results
console.log('\n📊 Validation Results:\n');
let totalPassed = 0;

checks.forEach(check => {
  const status = check.passed ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.details}`);
  if (check.passed) totalPassed++;
});

console.log(`\n🎯 Overall: ${totalPassed}/${checks.length} checks passed`);

if (totalPassed === checks.length) {
  console.log('\n🚀 Setup validation complete! Server architecture is ready.');
  console.log('\n📋 Next steps:');
  console.log('1. Copy .env.example to .env and configure variables');
  console.log('2. Run: npm install');
  console.log('3. Run: npm run build');
  console.log('4. Run: npm run dev');
  console.log('5. Test health endpoint: http://localhost:3000/health');
} else {
  console.log('\n⚠️  Some checks failed. Please review and fix the issues above.');
  process.exit(1);
}
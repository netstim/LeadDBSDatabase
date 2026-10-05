#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { path7za } = require('7zip-bin');

const [, , command, ...args] = process.argv;

function fail(message) {
  throw new Error(message);
}

function run7Zip(sevenZipArgs, options = {}) {
  const result = spawnSync(path7za, sevenZipArgs, {
    encoding: options.encoding || 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`7-Zip failed (${sevenZipArgs.join(' ')}):\n${result.stderr || ''}`);
  }
  return result;
}

function expectedExecutable(leadArch) {
  switch (leadArch) {
    case 'maca64':
    case 'maci64':
      return 'LeadDBSProgrammer.app/Contents/MacOS/LeadDBSProgrammer';
    case 'win32':
      return 'LeadDBSProgrammer/LeadDBSProgrammer.exe';
    case 'glnxa64':
      return 'LeadDBSProgrammer/LeadDBSProgrammer';
    default:
      return fail(`Unsupported Lead-DBS architecture: ${leadArch}`);
  }
}

function assertBinaryArchitecture(file, leadArch) {
  const descriptor = fs.openSync(file, 'r');
  const header = Buffer.alloc(4096);
  let bytesRead;
  try {
    bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  const bytes = header.subarray(0, bytesRead);

  if (leadArch === 'maca64' || leadArch === 'maci64') {
    if (bytes.length < 8 || bytes.readUInt32LE(0) !== 0xfeedfacf) {
      fail(`${file} is not a thin 64-bit Mach-O executable.`);
    }
    const expectedCpu = leadArch === 'maca64' ? 0x0100000c : 0x01000007;
    if (bytes.readUInt32LE(4) !== expectedCpu) {
      fail(`${file} has the wrong macOS CPU architecture for ${leadArch}.`);
    }
    return;
  }

  if (leadArch === 'win32') {
    if (bytes.length < 0x40 || bytes.toString('ascii', 0, 2) !== 'MZ') {
      fail(`${file} is not a Windows executable.`);
    }
    const peOffset = bytes.readUInt32LE(0x3c);
    if (
      peOffset + 6 > bytes.length ||
      bytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0' ||
      bytes.readUInt16LE(peOffset + 4) !== 0x8664
    ) {
      fail(`${file} is not a 64-bit x86 Windows executable.`);
    }
    return;
  }

  if (
    bytes.length < 20 ||
    !bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
    bytes[4] !== 2
  ) {
    fail(`${file} is not a 64-bit ELF executable.`);
  }
  const machine =
    bytes[5] === 2 ? bytes.readUInt16BE(18) : bytes.readUInt16LE(18);
  if (machine !== 0x3e) {
    fail(`${file} is not a 64-bit x86 Linux executable.`);
  }
}

function verifyArchive(zipFile, leadArch) {
  const archive = path.resolve(zipFile);
  if (!fs.statSync(archive).isFile()) fail(`Archive not found: ${archive}`);

  run7Zip(['t', archive]);
  const listing = run7Zip(['l', '-slt', archive]).stdout;
  const executable = expectedExecutable(leadArch);
  const root = executable.split('/')[0];
  const entries = listing
    .slice(listing.indexOf('----------'))
    .split(/\r?\n/)
    .filter((line) => line.startsWith('Path = '))
    .map((line) => line.slice('Path = '.length).replaceAll('\\', '/'));

  if (!entries.includes(executable)) {
    fail(`${path.basename(archive)} does not contain ${executable}.`);
  }
  if (
    entries.some((entry) => entry !== root && !entry.startsWith(`${root}/`))
  ) {
    fail(`${path.basename(archive)} contains files outside ${root}/.`);
  }

  const executableRecord = listing
    .slice(listing.indexOf(`Path = ${executable}`))
    .split(/\r?\n\r?\n/, 1)[0];
  if (leadArch !== 'win32' && !/Attributes = .*x/.test(executableRecord)) {
    fail(`${executable} is missing its executable permission.`);
  }

  const extractDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lead-dbs-zip-verify-'),
  );
  try {
    run7Zip(['e', '-y', `-o${extractDirectory}`, archive, executable]);
    assertBinaryArchitecture(
      path.join(extractDirectory, path.basename(executable)),
      leadArch,
    );
  } finally {
    fs.rmSync(extractDirectory, { recursive: true, force: true });
  }

  console.log(`Verified ${path.basename(archive)} (${leadArch}).`);
}

function wrapPortableApplication(sourceDirectory, zipFile, leadArch) {
  if (leadArch !== 'win32' && leadArch !== 'glnxa64') {
    fail('Only Windows and Linux builds need the portable-app wrapper.');
  }

  const source = path.resolve(sourceDirectory);
  const archive = path.resolve(zipFile);
  if (!fs.statSync(source).isDirectory()) {
    fail(`Unpacked application not found: ${source}`);
  }
  if (fs.existsSync(archive)) fail(`Refusing to overwrite ${archive}.`);

  const stageDirectory = fs.mkdtempSync(
    path.join(path.dirname(archive), '.lead-dbs-zip-'),
  );
  const wrappedApplication = path.join(stageDirectory, 'LeadDBSProgrammer');
  try {
    fs.renameSync(source, wrappedApplication);
    const executable = path.join(
      wrappedApplication,
      leadArch === 'win32' ? 'LeadDBSProgrammer.exe' : 'LeadDBSProgrammer',
    );
    if (!fs.statSync(executable).isFile()) {
      fail(`Packaged executable not found: ${executable}`);
    }
    run7Zip(
      ['a', '-tzip', '-mx=9', '-snh', '-snl', archive, 'LeadDBSProgrammer'],
      { cwd: stageDirectory, stdio: 'inherit' },
    );
  } finally {
    fs.rmSync(stageDirectory, { recursive: true, force: true });
  }

  try {
    verifyArchive(archive, leadArch);
  } catch (error) {
    fs.rmSync(archive, { force: true });
    throw error;
  }
}

function keepOnlyArchive(buildDirectory, zipFile) {
  const buildRoot = fs.realpathSync(buildDirectory);
  const archive = fs.realpathSync(zipFile);
  if (path.dirname(archive) !== buildRoot || !fs.statSync(archive).isFile()) {
    fail('The retained ZIP must be a direct file inside the build directory.');
  }

  fs.readdirSync(buildRoot).forEach((entry) => {
    const candidate = path.join(buildRoot, entry);
    if (candidate !== archive) {
      fs.rmSync(candidate, { recursive: true, force: true });
    }
  });
  console.log(`Kept only ${path.basename(archive)} in ${buildRoot}.`);
}

if (command === 'wrap' && args.length === 3) {
  wrapPortableApplication(args[0], args[1], args[2]);
} else if (command === 'verify' && args.length === 2) {
  verifyArchive(args[0], args[1]);
} else if (command === 'prune' && args.length === 2) {
  keepOnlyArchive(args[0], args[1]);
} else {
  fail(
    'Usage:\n' +
      '  lead-dbs-zip.cjs wrap <unpacked-directory> <zip-file> <win32|glnxa64>\n' +
      '  lead-dbs-zip.cjs verify <zip-file> <maca64|maci64|win32|glnxa64>\n' +
      '  lead-dbs-zip.cjs prune <build-directory> <zip-file>',
  );
}

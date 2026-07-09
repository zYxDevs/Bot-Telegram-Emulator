#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const reason = String(process.argv[2] || 'manual').replace(/[^a-z0-9._-]/gi, '_').slice(0, 40);
const outDir = process.env.BACKUP_DIR || path.join(ROOT, 'data', 'backups');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const staging = path.join(outDir, `.stage-${ts}-${process.pid}`);
const archive = path.join(outDir, `copux-backup-${ts}-${reason}.tar.gz`);

function exists(p) {
    try { fs.accessSync(p); return true; } catch { return false; }
}

function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o600);
}

function copyDir(src, dst) {
    if (!exists(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    execFileSync('cp', ['-a', `${src}/.`, dst], { stdio: 'ignore' });
}

function sha256(file) {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(file));
    return h.digest('hex');
}

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

try {
    const manifest = {
        createdAt: new Date().toISOString(),
        reason,
        root: ROOT,
        includes: []
    };

    for (const file of ['.env', '.copux-keys.json', 'package.json', 'package-lock.json']) {
        const src = path.join(ROOT, file);
        if (exists(src)) {
            copyFile(src, path.join(staging, 'repo', file));
            manifest.includes.push(file);
        }
    }

    for (const dir of ['config', 'data/kb']) {
        const src = path.join(ROOT, dir);
        if (exists(src)) {
            copyDir(src, path.join(staging, 'repo', dir));
            manifest.includes.push(dir);
        }
    }

    for (const file of ['data/history.json', 'data/addfix.jsonl', 'data/runtime-state.json', 'data/user-profiles.json']) {
        const src = path.join(ROOT, file);
        if (exists(src)) {
            copyFile(src, path.join(staging, 'repo', file));
            manifest.includes.push(file);
        }
    }

    const nineRouterDb = process.env.NINEROUTER_DB || '/root/.9router/db/data.sqlite';
    if (exists(nineRouterDb)) {
        copyFile(nineRouterDb, path.join(staging, '9router', 'data.sqlite'));
        manifest.includes.push(nineRouterDb);
    }

    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
    execFileSync('tar', ['-C', staging, '-czf', archive, '.'], { stdio: 'ignore' });
    fs.writeFileSync(`${archive}.sha256`, `${sha256(archive)}  ${path.basename(archive)}\n`);
    let finalArchive = archive;
    if (process.env.BACKUP_ENCRYPTION_PASSWORD) {
        const enc = `${archive}.enc`;
        execFileSync('openssl', [
            'enc', '-aes-256-cbc', '-salt', '-pbkdf2',
            '-pass', 'env:BACKUP_ENCRYPTION_PASSWORD',
            '-in', archive,
            '-out', enc
        ], { stdio: 'ignore', env: process.env });
        fs.writeFileSync(`${enc}.sha256`, `${sha256(enc)}  ${path.basename(enc)}\n`);
        finalArchive = enc;
        if (String(process.env.BACKUP_KEEP_PLAIN || '0') !== '1') {
            fs.rmSync(archive, { force: true });
            fs.rmSync(`${archive}.sha256`, { force: true });
        }
    }
    fs.rmSync(staging, { recursive: true, force: true });

    const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10));
    const backups = fs.readdirSync(outDir)
        .filter((f) => /^copux-backup-.*\.tar\.gz(?:\.enc)?$/.test(f))
        .sort()
        .reverse();
    for (const old of backups.slice(keep)) {
        fs.rmSync(path.join(outDir, old), { force: true });
        fs.rmSync(path.join(outDir, `${old}.sha256`), { force: true });
    }

    console.log(finalArchive);
} catch (e) {
    fs.rmSync(staging, { recursive: true, force: true });
    console.error(e.message);
    process.exit(1);
}

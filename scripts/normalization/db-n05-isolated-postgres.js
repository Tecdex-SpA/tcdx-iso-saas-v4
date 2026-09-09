'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
function run(cmd, args, input, allowFailure = false) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', input, env: { ...process.env, LC_ALL: 'C' }, timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (!allowFailure) assert.equal(r.status, 0, `${cmd} failed: ${r.stderr || r.error || r.stdout}`);
  return r;
}
function createPostgres() {
  const mode = process.env.DBN05_PG_MODE || 'auto';
  if (mode === 'docker' || (mode === 'auto' && run('docker', ['image', 'inspect', 'pgvector/pgvector:pg16'], null, true).status === 0)) {
    const image = process.env.DBN05_PG_IMAGE || 'pgvector/pgvector:pg16';
    const imageId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image]).stdout.trim();
    const name = `dbn05-pg-${crypto.randomBytes(8).toString('hex')}`;
    const pg = { container: name, socketDir: '127.0.0.1' };
    try {
      run('docker', ['run', '--detach', '--name', name, '--label', 'tcdx.test=db-n05', '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data:rw', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', imageId]);
      pg.port = run('docker', ['port', name, '5432/tcp']).stdout.trim().split(':').at(-1);
      assert.match(pg.port, /^\d+$/);
      run('docker', ['exec', name, 'sh', '-c', 'i=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do i=$((i+1)); [ "$i" -lt 100 ] || exit 1; sleep 0.1; done']);
      console.log(`ISOLATED_POSTGRES docker image=${imageId} localhost_only=YES`);
      return pg;
    } catch (e) { stopPostgres(pg); throw e; }
  }
  assert.ok(['auto', 'local'].includes(mode), 'DBN05_PG_MODE must be auto, local or docker');
  const bin = process.env.DBN05_PG_BIN || ['/opt/homebrew/opt/postgresql@16/bin', '/opt/homebrew/opt/postgresql@17/bin', '/opt/homebrew/bin', '/usr/local/bin'].find(p => fs.existsSync(path.join(p, 'postgres')));
  assert.ok(bin, 'Local PostgreSQL binaries unavailable');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-n05-pg-'));
  const pg = { tempRoot, dataDir: path.join(tempRoot, 'data'), socketDir: path.join(tempRoot, 'socket'), port: String(35000 + crypto.randomInt(2500)), bin };
  fs.mkdirSync(pg.socketDir);
  try {
    run(path.join(bin, 'initdb'), ['-A', 'trust', '-U', 'postgres', '-D', pg.dataDir]);
    run(path.join(bin, 'pg_ctl'), ['-D', pg.dataDir, '-l', path.join(tempRoot, 'postgres.log'), '-o', `-k ${pg.socketDir} -p ${pg.port} -h ''`, '-w', 'start']);
    return pg;
  } catch (e) { stopPostgres(pg); throw e; }
}
function stopPostgres(pg) {
  if (!pg) return;
  if (pg.container) {
    run('docker', ['rm', '--force', '--volumes', pg.container]);
    console.log('ISOLATED_POSTGRES_CLEANUP PASS');
  } else {
    run(path.join(pg.bin, 'pg_ctl'), ['-D', pg.dataDir, '-m', 'fast', '-w', 'stop'], null, true);
    fs.rmSync(pg.tempRoot, { recursive: true, force: true });
  }
}
function psqlExec(pg, sql, options = {}) {
  const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At', '-f', '-'];
  return pg.container
    ? run('docker', ['exec', '-i', pg.container, 'psql', ...args], sql, options.allowFailure)
    : run(path.join(pg.bin, 'psql'), [...args, '-h', pg.socketDir, '-p', pg.port], sql, options.allowFailure);
}
module.exports = { createPostgres, stopPostgres, psqlExec };

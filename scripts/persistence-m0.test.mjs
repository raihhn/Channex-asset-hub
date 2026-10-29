import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertLocal, assertRestoreTarget, mediaManifest, checkBundle } from './persistence-m0.mjs';

test('source guard rejects remote and unnamed databases', () => {
  for (const url of ['postgres://example.com/assethub_dev', 'postgres://localhost/', 'https://localhost/db'])
    assert.throws(() => assertLocal(url));
  assert.equal(assertLocal('postgresql://localhost:54329/assethub_dev').pathname, '/assethub_dev');
});
test('restore guard rejects active, generic test and caller-chosen targets', () => {
  for (const target of ['assethub_dev', 'assethub_test', 'postgres', 'assethub_m0_restore_bad'])
    assert.throws(() => assertRestoreTarget(target, 'assethub_dev'));
  const target = 'assethub_m0_restore_' + 'a'.repeat(24);
  assert.throws(() => assertRestoreTarget(target, target));
  assert.doesNotThrow(() => assertRestoreTarget(target, 'assethub_dev'));
});
test('media traversal refuses symlinks rather than copying outside the media root', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'assethub-m0-test-'));
  try {
    await fs.symlink(os.tmpdir(), path.join(directory, 'escape'));
    await assert.rejects(mediaManifest(directory), /symlinks/);
  } finally { await fs.rm(directory, { recursive: true }); }
});
test('backup corruption is rejected before restore can create a database', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'assethub-m0-test-'));
  try {
    const expected = createHash('sha256').update('original').digest('hex');
    await fs.writeFile(path.join(directory, 'database.dump'), 'corrupt');
    await fs.writeFile(path.join(directory, 'baseline.json'), JSON.stringify({ dumpSha256: expected }));
    await assert.rejects(checkBundle(directory), /checksum mismatch/);
  } finally { await fs.rm(directory, { recursive: true }); }
});

import crypto from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';
import { isAuthed } from './_auth.js';

// Datasets live in a PRIVATE Vercel Blob store as gzip-compressed JSON.
// Metadata is carried in the pathname:  ds/<id>~<rows>~<base64url(name)>.gz
//
// GET    /api/datasets            -> [{id,name,rows,size,savedAt}]
// GET    /api/datasets?id=<id>    -> gzip bytes
// PUT    /api/datasets?name=&rows=   (body: gzip bytes) -> {id}
// DELETE /api/datasets?id=<id>

const PREFIX = 'ds/';
const MAX_BYTES = 4.3 * 1024 * 1024; // Vercel function request body limit is 4.5 MB
const ID_RE = /^[a-z0-9]{10,40}$/;

function parse(blob) {
  const m = /^ds\/([a-z0-9]+)~(\d+)~([\w-]*)\.gz$/.exec(blob.pathname);
  if (!m) return null;
  return {
    id: m[1],
    rows: Number(m[2]),
    name: Buffer.from(m[3], 'base64url').toString('utf8'),
    size: blob.size,
    savedAt: new Date(blob.uploadedAt).getTime(),
  };
}

async function find(id) {
  if (!ID_RE.test(id || '')) return null;
  const { blobs } = await list({ prefix: `${PREFIX}${id}~`, limit: 1 });
  return blobs[0] || null;
}

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';

    if (req.method === 'GET' && !id) {
      const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
      const out = blobs.map(parse).filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
      return res.status(200).json(out);
    }

    if (req.method === 'GET') {
      const blob = await find(id);
      if (!blob) return res.status(404).json({ error: 'not found' });
      const result = await get(blob.pathname, { access: 'private' });
      if (!result || !result.stream) return res.status(404).json({ error: 'not found' });
      const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.status(200).send(buf);
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (body.length < 20 || body[0] !== 0x1f || body[1] !== 0x8b) return res.status(400).json({ error: 'expected gzip body' });
      if (body.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });
      const name = String(req.query.name || 'dataset').trim().slice(0, 80) || 'dataset';
      const rows = Math.max(0, parseInt(req.query.rows, 10) || 0);
      const newId = Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
      const pathname = `${PREFIX}${newId}~${rows}~${Buffer.from(name, 'utf8').toString('base64url')}.gz`;
      await put(pathname, body, { access: 'private', contentType: 'application/gzip', addRandomSuffix: false });
      return res.status(200).json({ id: newId });
    }

    if (req.method === 'DELETE') {
      const blob = await find(id);
      if (!blob) return res.status(404).json({ error: 'not found' });
      await del(blob.url);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage error: ' + (err && err.message ? err.message : 'unknown') });
  }
}

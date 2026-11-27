const releases = /* RELEASES */ {};

function byteRange(header, size) {
  if (!header || !header.startsWith('bytes=') || header.includes(',')) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return false;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
  return { start, end: Math.min(end, size - 1) };
}

async function* chunks(url, assets, parts, start, end) {
  let offset = 0;
  for (const part of parts) {
    const first = offset;
    offset += part.size;
    if (first > end) break;
    if (offset <= start) continue;

    const response = await assets.fetch(new Request(new URL(part.path, url)));
    if (response.status !== 200 || !response.body) throw Error('Download part unavailable');
    const reader = response.body.getReader();
    let skip = Math.max(0, start - first);
    let remaining = Math.min(offset, end + 1) - first - skip;
    try {
      while (remaining > 0) {
        const { value, done } = await reader.read();
        if (done) throw Error('Download part ended early');
        const drop = Math.min(skip, value.byteLength);
        skip -= drop;
        const take = Math.min(remaining, value.byteLength - drop);
        if (!take) continue;
        yield value.subarray(drop, drop + take);
        remaining -= take;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const name = url.pathname.slice('/downloads/'.length);
    if (!url.pathname.startsWith('/downloads/')) return env.ASSETS.fetch(request);
    if (!Object.hasOwn(releases, name)) return new Response('Download not found', { status: 404 });
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });

    const release = releases[name], etag = '"' + release.sha256 + '"';
    const headers = new Headers({
      'Content-Type': release.type,
      'Content-Disposition': 'attachment; filename="' + name + '"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=0, must-revalidate, no-transform',
      'Accept-Ranges': 'bytes',
      ETag: etag,
    });
    const matchingTags = request.headers.get('If-None-Match')?.split(/\s*,\s*/) || [];
    if (matchingTags.some(tag => tag === '*' || tag.replace(/^W\//, '') === etag))
      return new Response(null, { status: 304, headers });

    const ifRange = request.headers.get('If-Range');
    const range = !ifRange || ifRange === etag
      ? byteRange(request.headers.get('Range'), release.size)
      : null;
    if (range === false) {
      headers.set('Content-Range', 'bytes */' + release.size);
      return new Response(null, { status: 416, headers });
    }
    const { start, end } = range ?? { start: 0, end: release.size - 1 };
    const length = end - start + 1, status = range ? 206 : 200;
    if (range) headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + release.size);
    headers.set('Content-Length', String(length));
    if (request.method === 'HEAD') return new Response(null, { status, headers });

    const iterator = chunks(url, env.ASSETS, release.parts, start, end);
    const source = new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel() { return iterator.return(); },
    });
    const pipe = new FixedLengthStream(length);
    ctx.waitUntil(source.pipeTo(pipe.writable).catch(error => {
      console.error('Pawside download stream', name, error.message);
    }));
    return new Response(pipe.readable, { status, headers });
  },
};

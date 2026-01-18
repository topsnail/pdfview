export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const password = env.ACCESS_PASSWORD;
    const kv = env.PDF_FILES;
    const headers = { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });

    // 文件有效性预检
    if (url.pathname === '/api/check') {
      const target = url.searchParams.get('url');
      try {
        const res = await fetch(target, { method: 'HEAD' });
        return new Response(JSON.stringify({ ok: res.ok }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { headers });
      }
    }

    const isAuth = request.headers.get('Authorization') === password;
    if (url.pathname.startsWith('/api/files')) {
      if (!isAuth) return new Response('Unauthorized', { status: 401, headers });
      if (request.method === 'GET') {
        const data = await kv.get('FILE_LIST');
        return new Response(data || '[]', { headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'POST') {
        const file = await request.json();
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        const idx = list.findIndex(f => f.id === file.id);
        if (idx > -1) list[idx] = file; else list.push(file);
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        list = list.filter(f => f.id !== id);
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
    }
    return env.ASSETS.fetch(request);
  }
};

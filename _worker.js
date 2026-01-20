export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const password = env.ACCESS_PASSWORD;
    const kv = env.PDF_FILES;
    const bucket = env.MY_BUCKET;
    
    const headers = { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });

    // 1. 公开预览接口 (带缓存)
    if (url.pathname === '/api/raw') {
      const id = url.searchParams.get('id');
      const file = await bucket.get(id);
      if (!file) return new Response('Not Found', { status: 404 });
      const resHeaders = new Headers(headers);
      file.writeHttpMetadata(resHeaders);
      resHeaders.set('Content-Type', 'application/pdf');
      resHeaders.set('Cache-Control', 'public, max-age=3600'); 
      return new Response(file.body, { headers: resHeaders });
    }

    // 2. API 接口校验 (只在请求 API 时拦截)
    if (url.pathname.startsWith('/api/files')) {
      const isAuth = request.headers.get('Authorization') === password;
      if (!isAuth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

      // GET: 获取列表 (分页)
      if (request.method === 'GET') {
        const tab = url.searchParams.get('tab') || 'library';
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('q') || '';

        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        let filtered = list.filter(f => (tab === 'trash' ? f.isDeleted : !f.isDeleted));
        if (search) filtered = filtered.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
        filtered.sort((a, b) => b.id - a.id);

        const data = filtered.slice((page - 1) * limit, page * limit);
        return new Response(JSON.stringify({ data, total: filtered.length }), { headers });
      }

      // POST: 上传/恢复
      if (request.method === 'POST') {
        const formData = await request.formData();
        const action = formData.get('action');
        const id = formData.get('id');
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (action === 'restore') {
          list = list.map(f => f.id === id ? { ...f, isDeleted: false } : f);
        } else {
          const file = formData.get('file');
          const newId = id || Date.now().toString();
          if (file && typeof file !== 'string') await bucket.put(newId, file);
          const fileData = {
            id: newId, 
            name: formData.get('name'),
            url: `/api/raw?id=${newId}`,
            tags: (formData.get('tags') || '').split(',').map(t => t.trim()).filter(t => t),
            date: new Date().toLocaleDateString(),
            isDeleted: false
          };
          const idx = list.findIndex(f => f.id === newId);
          if (idx > -1) list[idx] = fileData; else list.push(fileData);
        }
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }

      // DELETE: 逻辑删除/彻底删除
      if (request.method === 'DELETE') {
        const ids = JSON.parse(await request.text());
        const permanent = url.searchParams.get('purge') === 'true';
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (permanent) {
          for (const targetId of ids) { await bucket.delete(targetId); }
          list = list.filter(f => !ids.includes(f.id));
        } else {
          list = list.map(f => ids.includes(f.id) ? { ...f, isDeleted: true } : f);
        }
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
    }

    // 3. 兜底返回静态资源
    return env.ASSETS.fetch(request);
  }
};
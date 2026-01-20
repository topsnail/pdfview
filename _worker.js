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

    // --- 1. CDN 缓存优化 ---
    if (url.pathname === '/api/raw') {
      const id = url.searchParams.get('id');
      const file = await bucket.get(id);
      if (!file) return new Response('Not Found', { status: 404 });
      
      const resHeaders = new Headers(headers);
      file.writeHttpMetadata(resHeaders);
      resHeaders.set('Content-Type', 'application/pdf');
      // 设置缓存：浏览器缓存 1 小时，CDN 缓存 24 小时
      resHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return new Response(file.body, { headers: resHeaders });
    }

    const isAuth = request.headers.get('Authorization') === password;
    if (!isAuth) return new Response('Unauthorized', { status: 401, headers });

    if (url.pathname.startsWith('/api/files')) {
      // --- 2. 获取列表（支持分页与回收站过滤） ---
      if (request.method === 'GET') {
        const showDeleted = url.searchParams.get('tab') === 'trash';
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        
        // 过滤回收站状态
        let filtered = list.filter(f => showDeleted ? f.isDeleted : !f.isDeleted);
        filtered.sort((a, b) => b.id - a.id); // 按时间倒序

        const total = filtered.length;
        const data = filtered.slice((page - 1) * limit, page * limit);

        return new Response(JSON.stringify({ data, total, page, limit }), { 
          headers: { ...headers, 'Content-Type': 'application/json' } 
        });
      }

      // --- 3. 上传与恢复 (POST) ---
      if (request.method === 'POST') {
        const formData = await request.formData();
        const action = formData.get('action'); // 'restore' or 'upload'
        const id = formData.get('id');
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (action === 'restore') {
          list = list.map(f => f.id === id ? { ...f, isDeleted: false } : f);
        } else {
          const file = formData.get('file');
          const name = formData.get('name');
          const tags = formData.get('tags');
          const newId = id || Date.now().toString();

          if (file && typeof file !== 'string') await bucket.put(newId, file);

          const fileData = {
            id: newId,
            name,
            url: `/api/raw?id=${newId}`,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            date: new Date().toLocaleDateString(),
            isDeleted: false
          };

          const idx = list.findIndex(f => f.id === newId);
          if (idx > -1) list[idx] = { ...list[idx], ...fileData };
          else list.push(fileData);
        }

        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }

      // --- 4. 逻辑删除与彻底删除 (DELETE) ---
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        const ids = id ? [id] : JSON.parse(await request.text()); // 支持批量
        const permanent = url.searchParams.get('purge') === 'true';

        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (permanent) {
          // 彻底删除：从 R2 和 KV 同时移除
          for (const targetId of ids) { await bucket.delete(targetId); }
          list = list.filter(f => !ids.includes(f.id));
        } else {
          // 进入回收站：仅标记
          list = list.map(f => ids.includes(f.id) ? { ...f, isDeleted: true } : f);
        }

        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
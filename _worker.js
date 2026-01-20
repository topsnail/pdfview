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

    // 公开预览接口 (带缓存)
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

    // API 身份校验
    const isAuth = request.headers.get('Authorization') === password;
    if (url.pathname.startsWith('/api/files')) {
      if (!isAuth) return new Response('Unauthorized', { status: 401, headers });

      // GET: 获取分页列表
      if (request.method === 'GET') {
        const tab = url.searchParams.get('tab') || 'library';
        const search = url.searchParams.get('q') || '';
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        let filtered = list.filter(f => (tab === 'trash' ? f.isDeleted : !f.isDeleted));
        
        if (search) {
          // 检查是否为标签搜索 (#标签)
          if (search.startsWith('#')) {
            const tag = search.substring(1).toLowerCase();
            filtered = filtered.filter(f => f.tags.some(t => t.toLowerCase().includes(tag)));
          } else {
            // 普通搜索：搜索文件名
            filtered = filtered.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
          }
        }
        
        filtered.sort((a, b) => b.id - a.id);
        return new Response(JSON.stringify(filtered), { headers });
      }

      // POST: 处理本地上传 (FormData)
      if (request.method === 'POST') {
        const formData = await request.formData();
        const action = formData.get('action');
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (action === 'restore') {
          const id = formData.get('id');
          list = list.map(f => f.id === id ? { ...f, isDeleted: false } : f);
        } else {
          const file = formData.get('file');
          const id = Date.now().toString();
          // 获取文件大小 - 处理不同类型的文件对象
          let fileSize = 0;
          let uploadFile = file;
          try {
            if (file.size) {
              fileSize = file.size;
            } else if (file.byteLength) {
              fileSize = file.byteLength;
            } else if (typeof file === 'string') {
              fileSize = new Blob([file]).size;
            } else if (file.stream) {
              // 处理ReadableStream类型 - 保存流内容
              const reader = file.stream().getReader();
              let chunks = [];
              let totalBytes = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                totalBytes += value.length;
              }
              fileSize = totalBytes;
              uploadFile = new Blob(chunks);
            }
          } catch (e) {
            console.error('获取文件大小失败:', e);
          }
          // 写入 R2
          await bucket.put(id, uploadFile);
          const fileData = {
            id: id,
            name: formData.get('name'),
            url: `/api/raw?id=${id}`,
            tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : [],
            date: new Date().toLocaleDateString(),
            size: fileSize,
            isDeleted: false
          };
          list.push(fileData);
        }
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }

      // DELETE: 逻辑删除或彻底删除
      if (request.method === 'DELETE') {
        const ids = JSON.parse(await request.text());
        const purge = url.searchParams.get('purge') === 'true';
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');

        if (purge) {
          for (const id of ids) await bucket.delete(id);
          list = list.filter(f => !ids.includes(f.id));
        } else {
          list = list.map(f => ids.includes(f.id) ? { ...f, isDeleted: true } : f);
        }
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
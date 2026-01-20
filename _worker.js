export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const password = env.ACCESS_PASSWORD;
    const kv = env.PDF_FILES;
    const bucket = env.MY_BUCKET; // 需在 Pages 后台绑定
    
    const headers = { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });

    // --- 1. 读取 R2 文件流 (供预览使用) ---
    if (url.pathname === '/api/raw') {
      const id = url.searchParams.get('id');
      if (!id) return new Response('ID Required', { status: 400 });
      
      const file = await bucket.get(id);
      if (!file) return new Response('File Not Found', { status: 404 });
      
      const resHeaders = new Headers(headers);
      file.writeHttpMetadata(resHeaders);
      resHeaders.set('Content-Type', 'application/pdf');
      resHeaders.set('Content-Disposition', 'inline'); // 确保是预览而非强制下载
      return new Response(file.body, { headers: resHeaders });
    }

    const isAuth = request.headers.get('Authorization') === password;

    if (url.pathname.startsWith('/api/files')) {
      if (!isAuth) return new Response('Unauthorized', { status: 401, headers });

      // --- 2. 获取列表 (从 KV 读取) ---
      if (request.method === 'GET') {
        const data = await kv.get('FILE_LIST');
        return new Response(data || '[]', { 
          headers: { ...headers, 'Content-Type': 'application/json' } 
        });
      }

      // --- 3. 上传/更新 (R2 + KV) ---
      if (request.method === 'POST') {
        try {
          const formData = await request.formData();
          const file = formData.get('file'); // 获取二进制文件
          const name = formData.get('name');
          const tags = formData.get('tags');
          const id = formData.get('id') || Date.now().toString();

          // 如果上传了新的文件内容，存入 R2
          if (file && typeof file !== 'string') {
            await bucket.put(id, file);
          }

          let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
          const idx = list.findIndex(f => f.id === id);
          
          const fileData = {
            id,
            name,
            url: `/api/raw?id=${id}`, // 预览链接指向 Worker 自身接口
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            date: new Date().toLocaleDateString()
          };

          if (idx > -1) {
            // 编辑模式：合并新旧数据
            list[idx] = { ...list[idx], ...fileData };
          } else {
            // 新增模式
            list.push(fileData);
          }

          await kv.put('FILE_LIST', JSON.stringify(list));
          return new Response('OK', { headers });
        } catch (e) {
          return new Response(e.message, { status: 500, headers });
        }
      }

      // --- 4. 删除 (同时从 R2 和 KV 移除) ---
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        await bucket.delete(id); // 删除 R2 物理文件
        
        let list = JSON.parse(await kv.get('FILE_LIST') || '[]');
        list = list.filter(f => f.id !== id);
        await kv.put('FILE_LIST', JSON.stringify(list));
        return new Response('OK', { headers });
      }
    }

    // 静态资源返回
    return env.ASSETS.fetch(request);
  }
};
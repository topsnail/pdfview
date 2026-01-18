export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const kv = env.PDF_FILES;

    // 处理 API 路由
    if (url.pathname.startsWith('/api/files')) {
      // 跨域头
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

      if (request.method === 'GET') {
        const data = await kv.get('FILE_LIST');
        return new Response(data || '[]', { headers });
      }

      if (request.method === 'POST') {
        const newFile = await request.json();
        const data = JSON.parse(await kv.get('FILE_LIST') || '[]');
        data.push(newFile);
        await kv.put('FILE_LIST', JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        let data = JSON.parse(await kv.get('FILE_LIST') || '[]');
        data = data.filter(f => f.id !== id);
        await kv.put('FILE_LIST', JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }), { headers });
      }
    }

    // 否则作为普通静态请求返回（由 Pages 托管）
    return env.ASSETS.fetch(request);
  }
};

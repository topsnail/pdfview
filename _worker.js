export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const password = env.ACCESS_PASSWORD; // 从环境变量获取密码

    // 1. 简单的密码验证逻辑 (用于增删改请求)
    const checkAuth = (req) => {
      const auth = req.headers.get('Authorization');
      return auth === password;
    };

    // --- 路由: CORS 代理 [建议 1] ---
    if (url.pathname === '/api/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response('Missing URL', { status: 400 });
      const pdfRes = await fetch(targetUrl);
      const newRes = new Response(pdfRes.body, pdfRes);
      newRes.headers.set('Access-Control-Allow-Origin', '*'); // 强制允许跨域
      return newRes;
    }

    // --- 路由: API 文件管理 ---
    if (url.pathname.startsWith('/api/files')) {
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
      
      // 验证权限 (如果是 POST/DELETE 请求)
      if (request.method !== 'GET' && !checkAuth(request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
      }

      const kv = env.PDF_FILES;
      if (request.method === 'GET') {
        const data = await kv.get('FILE_LIST');
        return new Response(data || '[]', { headers });
      }

      if (request.method === 'POST') {
        const fileData = await request.json();
        let data = JSON.parse(await kv.get('FILE_LIST') || '[]');
        const index = data.findIndex(f => f.id === fileData.id);
        if (index > -1) data[index] = fileData; // 编辑更新
        else data.push(fileData); // 新增
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

    return env.ASSETS.fetch(request);
  }
};

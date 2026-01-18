// Cloudflare Worker 配置
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

// 处理请求
async function handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理API请求
    if (pathname.startsWith('/api')) {
        return handleApiRequest(request, pathname);
    }
    
    // 处理静态文件
    return serveStaticFile(request);
}

// 处理API请求
async function handleApiRequest(request, pathname) {
    const method = request.method;
    
    // 获取文件列表
    if (pathname === '/api/files' && method === 'GET') {
        return getFiles();
    }
    
    // 添加文件
    if (pathname === '/api/files' && method === 'POST') {
        return addFile(request);
    }
    
    // 删除文件
    if (pathname.match(/^\/api\/files\/([^/]+)$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        return deleteFile(id);
    }
    
    return new Response('Not Found', {
        status: 404,
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}

// 从KV获取文件列表
async function getFiles() {
    try {
        // 尝试从KV获取
        const filesJson = await PDF_FILES.get('files');
        const files = filesJson ? JSON.parse(filesJson) : [];
        
        return new Response(JSON.stringify(files), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('获取文件列表失败:', error);
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 添加文件到KV
async function addFile(request) {
    try {
        const file = await request.json();
        
        // 获取现有文件列表
        const filesJson = await PDF_FILES.get('files');
        const files = filesJson ? JSON.parse(filesJson) : [];
        
        // 添加新文件
        files.push(file);
        
        // 保存到KV
        await PDF_FILES.put('files', JSON.stringify(files));
        
        return new Response(JSON.stringify(file), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('添加文件失败:', error);
        return new Response('添加文件失败', {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 从KV删除文件
async function deleteFile(id) {
    try {
        // 获取现有文件列表
        const filesJson = await PDF_FILES.get('files');
        const files = filesJson ? JSON.parse(filesJson) : [];
        
        // 过滤掉要删除的文件
        const updatedFiles = files.filter(file => file.id !== id);
        
        // 保存到KV
        await PDF_FILES.put('files', JSON.stringify(updatedFiles));
        
        return new Response('删除成功', {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('删除文件失败:', error);
        return new Response('删除文件失败', {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// 提供静态文件
async function serveStaticFile(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    
    // 默认返回index.html
    if (path === '/') {
        path = '/index.html';
    }
    
    // 构建文件路径
    const filePath = '.' + path;
    
    try {
        // 尝试读取文件
        const response = await fetch(filePath, request);
        return response;
    } catch (error) {
        console.error('读取文件失败:', error);
        return new Response('Not Found', {
            status: 404,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
}
// 检测当前页面
const currentPage = window.location.pathname;

// API基础URL
const API_BASE = '/api';

// 本地存储键名（用于开发环境）
const LOCAL_STORAGE_KEY = 'pdf_files';

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Toast功能
function showToast(message, type = 'info', duration = 3000) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 显示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

// 从本地存储获取文件列表（开发环境）
function getFilesFromLocal() {
    const files = localStorage.getItem(LOCAL_STORAGE_KEY);
    return files ? JSON.parse(files) : [];
}

// 保存文件列表到本地存储（开发环境）
function saveFilesToLocal(files) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(files));
}

// 获取文件列表
async function getFiles() {
    try {
        // 尝试从API获取
        const response = await fetch(`${API_BASE}/files`);
        if (response.ok) {
            return await response.json();
        }
        // 如果API失败，使用本地存储（开发环境）
        return getFilesFromLocal();
    } catch (error) {
        console.error('获取文件列表失败:', error);
        // 使用本地存储（开发环境）
        return getFilesFromLocal();
    }
}

// 添加文件
async function addFile(name, url) {
    const file = {
        id: generateId(),
        name,
        url,
        createdAt: new Date().toISOString()
    };
    
    try {
        // 尝试调用API
        const response = await fetch(`${API_BASE}/files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(file)
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        // 如果API失败，使用本地存储（开发环境）
        const files = getFilesFromLocal();
        files.push(file);
        saveFilesToLocal(files);
        return file;
    } catch (error) {
        console.error('添加文件失败:', error);
        // 使用本地存储（开发环境）
        const files = getFilesFromLocal();
        files.push(file);
        saveFilesToLocal(files);
        return file;
    }
}

// 删除文件
async function deleteFile(id) {
    try {
        // 尝试调用API
        const response = await fetch(`${API_BASE}/files/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            return true;
        }
        
        // 如果API失败，使用本地存储（开发环境）
        const files = getFilesFromLocal();
        const updatedFiles = files.filter(file => file.id !== id);
        saveFilesToLocal(updatedFiles);
        return true;
    } catch (error) {
        console.error('删除文件失败:', error);
        // 使用本地存储（开发环境）
        const files = getFilesFromLocal();
        const updatedFiles = files.filter(file => file.id !== id);
        saveFilesToLocal(updatedFiles);
        return true;
    }
}

// 渲染文件列表
function renderFiles(files) {
    const filesList = document.getElementById('files-list');
    if (!filesList) return;
    
    filesList.innerHTML = '';
    
    if (files.length === 0) {
        filesList.innerHTML = '<p>暂无PDF文件，请添加</p>';
        return;
    }
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const shareUrl = `${window.location.origin}/viewer.html?id=${file.id}&url=${encodeURIComponent(file.url)}`;
        
        fileItem.innerHTML = `
            <div class="file-info">
                <h3>${file.name}</h3>
                <p>${file.url}</p>
            </div>
            <div class="file-actions">
                <a href="viewer.html?id=${file.id}&url=${encodeURIComponent(file.url)}" class="view-btn">查看</a>
                <button class="share-btn" data-url="${shareUrl}">分享</button>
                <button class="delete-btn" data-id="${file.id}">删除</button>
            </div>
        `;
        
        filesList.appendChild(fileItem);
    });
    
    // 添加分享按钮事件
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const shareUrl = e.target.dataset.url;
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast('分享链接已复制到剪贴板', 'success');
            } catch (error) {
                console.error('复制失败:', error);
                showToast('复制失败，请手动复制链接', 'error');
                prompt('请复制分享链接:', shareUrl);
            }
        });
    });
    
    // 添加删除按钮事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('确定要删除这个文件吗？')) {
                await deleteFile(id);
                loadFiles();
                showToast('文件删除成功', 'success');
            }
        });
    });
}

// 加载文件列表
async function loadFiles() {
    const files = await getFiles();
    renderFiles(files);
}

// 初始化首页
function initIndexPage() {
    // 加载文件列表
    loadFiles();
    
    // 添加表单提交事件
    const addForm = document.getElementById('add-form');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('pdf-name').value;
            const url = document.getElementById('pdf-url').value;
            
            if (name && url) {
                await addFile(name, url);
                // 清空表单
                addForm.reset();
                // 重新加载文件列表
                loadFiles();
                // 显示成功提示
                showToast('文件添加成功', 'success');
            }
        });
    }
}

// PDF文档和页面变量
let pdfDoc = null;
let currentPage = 1;
let pageRendering = false;
let pageNumPending = null;

// 初始化预览页
function initViewerPage() {
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('url');
    
    if (!pdfUrl) {
        document.getElementById('loading').textContent = '没有找到PDF文件URL';
        return;
    }
    
    // 加载PDF
    loadPDF(pdfUrl);
    
    // 添加事件监听器
    document.getElementById('prev-page').addEventListener('click', onPrevPage);
    document.getElementById('next-page').addEventListener('click', onNextPage);
    document.getElementById('page-num').addEventListener('change', onPageNumChange);
}

// 加载PDF
async function loadPDF(url) {
    const container = document.getElementById('pdf-container');
    const loading = document.getElementById('loading');
    
    if (!container || !loading) {
        console.error('容器元素未找到');
        return;
    }
    
    if (!url) {
        console.error('PDF URL为空');
        loading.textContent = 'PDF URL为空';
        loading.style.color = 'red';
        return;
    }
    
    if (typeof pdfjsLib === 'undefined') {
        console.error('PDF.js库未加载');
        loading.textContent = 'PDF.js库加载失败';
        loading.style.color = 'red';
        return;
    }
    
    try {
        console.log('开始加载PDF:', url);
        
        // 配置PDF加载选项，优化中文支持
        const loadingTask = pdfjsLib.getDocument({
            url: url,
            cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            withCredentials: false,
            enableXfa: true,
            useOnlyCssZoom: true
        });
        
        console.log('PDF加载任务创建成功');
        
        pdfDoc = await loadingTask.promise;
        console.log('PDF文档加载成功，页数:', pdfDoc.numPages);
        
        // 更新页面计数
        document.getElementById('page-count').textContent = pdfDoc.numPages;
        document.getElementById('page-num').max = pdfDoc.numPages;
        
        loading.style.display = 'none';
        
        // 渲染第一页
        renderPage(1);
        
        console.log('PDF加载完成，开始渲染');
    } catch (error) {
        console.error('加载PDF失败:', error);
        loading.textContent = '加载PDF失败: ' + error.message;
        loading.style.color = 'red';
    }
}

// 渲染页面
async function renderPage(num) {
    const container = document.getElementById('pdf-container');
    const loading = document.getElementById('loading');
    
    if (!container || !pdfDoc) return;
    
    pageRendering = true;
    loading.style.display = 'block';
    loading.textContent = '加载页面中...';
    
    try {
        // 获取页面
        const page = await pdfDoc.getPage(num);
        
        // 设置缩放比例
        const scale = 1.2;
        const viewport = page.getViewport({ scale });
        
        // 创建画布
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // 清空容器
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // 渲染页面
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // 更新当前页码
        currentPage = num;
        document.getElementById('page-num').value = num;
        
        // 启用/禁用导航按钮
        document.getElementById('prev-page').disabled = num <= 1;
        document.getElementById('next-page').disabled = num >= pdfDoc.numPages;
        
        console.log('页面', num, '渲染成功');
    } catch (error) {
        console.error('渲染页面失败:', error);
        loading.textContent = '渲染页面失败';
    } finally {
        pageRendering = false;
        loading.style.display = 'none';
        
        // 渲染待处理的页面
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    }
}

// 上一页
function onPrevPage() {
    if (pdfDoc && currentPage > 1) {
        renderPage(currentPage - 1);
    }
}

// 下一页
function onNextPage() {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
        renderPage(currentPage + 1);
    }
}

// 页码输入变化
function onPageNumChange() {
    if (!pdfDoc) return;
    
    const pageNum = parseInt(document.getElementById('page-num').value);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdfDoc.numPages) {
        renderPage(pageNum);
    } else {
        // 恢复当前页码
        document.getElementById('page-num').value = currentPage;
    }
}

// 初始化页面
if (currentPage.includes('viewer.html')) {
    initViewerPage();
} else {
    initIndexPage();
}
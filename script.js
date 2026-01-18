const API_URL = '/api/files';
let files = [];
let accessPassword = localStorage.getItem('pdf_access_token');

// 初始化：决定显示登录页还是主页
function init() {
    if (!accessPassword) {
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('main-content').style.display = 'none';
    } else {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    }
}

// 处理登录点击
function handleLogin() {
    const input = document.getElementById('pw-input');
    if (!input.value) return;
    accessPassword = input.value;
    localStorage.setItem('pdf_access_token', accessPassword);
    init(); // 重新检查 UI
}

// 统一 API 请求，处理 401 权限失效
async function apiFetch(url, options = {}) {
    options.headers = { ...options.headers, 'Authorization': accessPassword };
    const res = await fetch(url, options);
    if (res.status === 401) {
        showToast("密码错误或失效");
        logout();
        return null;
    }
    return res;
}

// 剩下的功能函数保持不变
async function loadFiles() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    try {
        const res = await apiFetch(API_URL);
        if (res && res.ok) files = await res.json();
    } catch (e) {
        console.error(e);
    } finally {
        loading.style.display = 'none';
        renderFileList();
    }
}

function renderFileList() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList');
    const filtered = files.filter(f => f.name.toLowerCase().includes(searchTerm));
    list.innerHTML = filtered.map(file => `
        <li>
            <div class="file-info"><strong>${file.name}</strong></div>
            <div class="actions">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" class="btn-sm btn-view" target="_blank">查看</a>
                <button onclick="editPrompt('${file.id}')" class="btn-sm btn-edit">编辑</button>
                <button onclick="shareFile('${file.url}')" class="btn-sm">分享</button>
                <button onclick="deleteFile('${file.id}')" class="btn-sm btn-del">删除</button>
            </div>
        </li>
    `).join('');
}

async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    if (!name || !url) return showToast("请填写完整信息");
    const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify({ id: Date.now().toString(), name, url }) });
    if (res && res.ok) { showToast("已保存"); loadFiles(); }
}

function editPrompt(id) {
    const file = files.find(f => f.id === id);
    const newName = prompt("新名称:", file.name);
    const newUrl = prompt("新地址:", file.url);
    if (newName && newUrl) {
        apiFetch(API_URL, { method: 'POST', body: JSON.stringify({ id, name: newName, url: newUrl }) }).then(() => loadFiles());
    }
}

async function deleteFile(id) {
    if (!confirm("确定删除？")) return;
    const res = await apiFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    if (res && res.ok) { showToast("已删除"); loadFiles(); }
}

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("链接已复制");
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function logout() {
    localStorage.removeItem('pdf_access_token');
    accessPassword = null;
    init();
}

// 启动
init();

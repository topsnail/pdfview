const API_URL = '/api/files';
let files = [];
let accessPassword = localStorage.getItem('pdf_access_token');

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

function handleLogin() {
    const input = document.getElementById('pw-input');
    if (!input.value) return;
    accessPassword = input.value;
    localStorage.setItem('pdf_access_token', accessPassword);
    init();
}

async function apiFetch(url, options = {}) {
    options.headers = { ...options.headers, 'Authorization': accessPassword };
    const res = await fetch(url, options);
    if (res.status === 401) { logout(); return null; }
    return res;
}

// 新增：文件预检 [建议 2]
async function checkUrl(url) {
    try {
        const res = await fetch(`/api/check?url=${encodeURIComponent(url)}`);
        return await res.json();
    } catch (e) { return { ok: false }; }
}

async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    const tags = document.getElementById('fileTags').value;
    const btn = document.getElementById('addBtn');

    if (!name || !url) return showToast("名称和链接必填");

    btn.disabled = true;
    btn.textContent = "预检中...";

    const check = await checkUrl(url);
    if (!check.ok) {
        btn.disabled = false; btn.textContent = "添加文件";
        return showToast("错误：链接无法访问");
    }

    const fileData = {
        id: Date.now().toString(),
        name,
        url,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        date: new Date().toLocaleDateString()
    };

    const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify(fileData) });
    if (res && res.ok) {
        showToast("添加成功" + (check.isPdf ? "" : " (注意：可能不是标准PDF)"));
        ["fileName", "fileUrl", "fileTags"].forEach(id => document.getElementById(id).value = '');
        loadFiles();
    }
    btn.disabled = false; btn.textContent = "添加文件";
}

function renderFileList() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList');
    
    // 支持 #标签 搜索 [建议 1]
    const filtered = files.filter(f => {
        if (query.startsWith('#')) {
            const tagQuery = query.slice(1);
            return f.tags?.some(t => t.toLowerCase().includes(tagQuery));
        }
        return f.name.toLowerCase().includes(query);
    });

    list.innerHTML = filtered.map(file => `
        <li class="file-card">
            <div class="file-main">
                <div class="file-info">
                    <strong>${file.name}</strong>
                    <div class="tag-container">
                        ${(file.tags || []).map(t => `<span class="tag" onclick="quickSearch('#${t}')">${t}</span>`).join('')}
                    </div>
                </div>
                <div class="file-date">${file.date || ''}</div>
            </div>
            <div class="actions">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" class="btn-action btn-view" target="_blank">查看</a>
                <button onclick="editPrompt('${file.id}')" class="btn-action">编辑</button>
                <button onclick="shareFile('${file.url}')" class="btn-action">分享</button>
                <button onclick="deleteFile('${file.id}')" class="btn-action btn-del">删除</button>
            </div>
        </li>
    `).join('');
}

function quickSearch(tag) {
    document.getElementById('searchInput').value = tag;
    renderFileList();
}

// ... (loadFiles, deleteFile, shareFile, logout 等函数保持上一版本逻辑) ...
async function loadFiles() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    const res = await apiFetch(API_URL);
    if (res && res.ok) files = await res.json();
    loading.style.display = 'none';
    renderFileList();
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

function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}
function editPrompt(id) {
    const file = files.find(f => f.id === id);
    const newName = prompt("新名称:", file.name);
    const newUrl = prompt("新地址:", file.url);
    if (newName && newUrl) {
        apiFetch(API_URL, { method: 'POST', body: JSON.stringify({ ...file, name: newName, url: newUrl }) }).then(() => loadFiles());
    }
}

init();

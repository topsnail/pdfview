const API_URL = '/api/files';
let files = [];
let accessPassword = localStorage.getItem('pdf_access_token');
let editingId = null; // 记录当前正在行内编辑的ID

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

async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    const tags = document.getElementById('fileTags').value;
    if (!name || !url) return showToast("请填写名称和链接");

    const fileData = {
        id: Date.now().toString(),
        name,
        url,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        date: new Date().toLocaleDateString()
    };

    const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify(fileData) });
    if (res && res.ok) {
        showToast("已保存");
        ["fileName", "fileUrl", "fileTags"].forEach(id => document.getElementById(id).value = '');
        loadFiles();
    }
}

function renderFileList() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList');
    
    const filtered = files.filter(f => {
        if (query.startsWith('#')) return f.tags?.some(t => t.toLowerCase().includes(query.slice(1)));
        return f.name.toLowerCase().includes(query);
    });

    list.innerHTML = filtered.map(file => {
        const isEditing = editingId === file.id;
        return `
        <li class="file-card">
            ${isEditing ? `
                <div class="edit-mode">
                    <input type="text" id="edit-name-${file.id}" value="${file.name}" placeholder="名称">
                    <input type="text" id="edit-url-${file.id}" value="${file.url}" placeholder="链接">
                    <div class="edit-actions">
                        <button onclick="saveEdit('${file.id}')" class="btn-save">保存</button>
                        <button onclick="cancelEdit()" class="btn-cancel">取消</button>
                    </div>
                </div>
            ` : `
                <div class="file-main">
                    <div class="file-info">
                        <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title-link">
                            ${file.name}
                        </a>
                        <div class="tag-container">
                            ${(file.tags || []).map(t => `<span class="tag" onclick="event.preventDefault(); quickSearch('#${t}')">${t}</span>`).join('')}
                        </div>
                    </div>
                    <div class="file-date">${file.date || ''}</div>
                </div>
                <div class="actions">
                    <button onclick="startEdit('${file.id}')" class="btn-action">编辑</button>
                    <button onclick="shareFile('${file.url}')" class="btn-action">分享</button>
                    <button onclick="deleteFile('${file.id}')" class="btn-action btn-del">删除</button>
                </div>
            `}
        </li>
    `}).join('');
}

// 行内编辑逻辑
function startEdit(id) { editingId = id; renderFileList(); }
function cancelEdit() { editingId = null; renderFileList(); }

async function saveEdit(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const url = document.getElementById(`edit-url-${id}`).value;
    const oldFile = files.find(f => f.id === id);
    
    const res = await apiFetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ ...oldFile, name, url }) 
    });
    
    if (res && res.ok) {
        showToast("修改成功");
        editingId = null;
        loadFiles();
    }
}

async function loadFiles() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';
    const res = await apiFetch(API_URL);
    if (res && res.ok) files = await res.json();
    if (loading) loading.style.display = 'none';
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
    showToast("分享链接已复制");
}

function quickSearch(tag) {
    document.getElementById('searchInput').value = tag;
    renderFileList();
}

function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

init();

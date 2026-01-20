const API_URL = '/api/files';
let files = [];
let accessPassword = localStorage.getItem('pdf_access_token');
let editingId = null;

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
    if (res && res.status === 401) { logout(); return null; }
    return res;
}

async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    const tags = document.getElementById('fileTags').value;
    const btn = document.getElementById('addBtn');
    if (!name || !url) return showToast("请完整填写");

    btn.disabled = true;
    const fileData = {
        id: Date.now().toString(),
        name, url,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        date: new Date().toLocaleDateString()
    };

    const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify(fileData) });
    if (res && res.ok) {
        showToast("保存成功");
        ["fileName", "fileUrl", "fileTags"].forEach(id => document.getElementById(id).value = '');
        loadFiles();
    }
    btn.disabled = false;
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
                    <div class="row"><input type="text" id="edit-name-${file.id}" value="${file.name}"><input type="text" id="edit-tags-${file.id}" value="${(file.tags || []).join(',')}"></div>
                    <input type="text" id="edit-url-${file.id}" value="${file.url}">
                    <div class="edit-actions"><button onclick="saveEdit('${file.id}')" class="btn-save">保存</button><button onclick="cancelEdit()" class="btn-cancel">取消</button></div>
                </div>
            ` : `
                <div class="file-row">
                    <div class="file-info">
                        <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title-link">${file.name}</a>
                        <div class="tag-container">${(file.tags || []).map(t => `<span class="tag" onclick="quickSearch('#${t}')">${t}</span>`).join('')}</div>
                    </div>
                    <div class="actions-inline">
                        <button onclick="startEdit('${file.id}')" class="btn-icon">改</button>
                        <button onclick="deleteFile('${file.id}')" class="btn-icon btn-del">删</button>
                        <button onclick="shareFile('${file.url}')" class="btn-icon">享</button>
                    </div>
                </div>
            `}
        </li>`
    }).join('');
}

function startEdit(id) { editingId = id; renderFileList(); }
function cancelEdit() { editingId = null; renderFileList(); }

async function saveEdit(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const url = document.getElementById(`edit-url-${id}`).value;
    const tags = document.getElementById(`edit-tags-${id}`).value;
    const old = files.find(f => f.id === id);
    const res = await apiFetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ ...old, name, url, tags: tags ? tags.split(',').map(t => t.trim()) : [] }) 
    });
    if (res && res.ok) { editingId = null; loadFiles(); showToast("更新成功"); }
}

async function loadFiles() {
    const res = await apiFetch(API_URL);
    if (res && res.ok) files = await res.json();
    renderFileList();
}

async function deleteFile(id) {
    if (confirm("确定删除吗?")) {
        const res = await apiFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showToast("已删除"); loadFiles(); }
    }
}

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("链接已复制");
}

function quickSearch(tag) { document.getElementById('searchInput').value = tag; renderFileList(); }
function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}
init();
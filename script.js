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

// 修改后的上传函数
async function addFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    const tags = document.getElementById('fileTags').value;
    const btn = document.getElementById('addBtn');

    if (!fileInput.files[0] || !name) return showToast("请选择文件并填写名称");

    btn.disabled = true;
    btn.textContent = "上传中...";

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', tags);

    const res = await apiFetch(API_URL, {
        method: 'POST',
        body: formData // 浏览器会自动设置正确的 Content-Type
    });

    if (res && res.ok) {
        showToast("上传成功");
        fileInput.value = '';
        document.getElementById('fileName').value = '';
        document.getElementById('fileTags').value = '';
        loadFiles();
    } else {
        showToast("上传失败，请检查配置或文件大小");
    }
    btn.disabled = false;
    btn.textContent = "上传并添加";
}

// 渲染列表
function renderFileList() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList');
    const filtered = files.filter(f => {
        if (query.startsWith('#')) return f.tags?.some(t => t.toLowerCase().includes(query.slice(1)));
        return f.name.toLowerCase().includes(query);
    });

    list.innerHTML = filtered.reverse().map(file => {
        const isEditing = editingId === file.id;
        return `
        <li class="file-card">
            ${isEditing ? `
                <div class="edit-mode">
                    <input type="text" id="edit-name-${file.id}" value="${file.name}">
                    <input type="text" id="edit-tags-${file.id}" value="${(file.tags || []).join(',')}">
                    <div class="edit-actions">
                        <button onclick="saveEdit('${file.id}')" class="btn-save">保存</button>
                        <button onclick="cancelEdit()" class="btn-cancel">取消</button>
                    </div>
                </div>
            ` : `
                <div class="file-row">
                    <div class="file-info">
                        <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title-link">${file.name}</a>
                        <div class="tag-container">
                            ${(file.tags || []).map(t => `<span class="tag" onclick="quickSearch('#${t}')">${t}</span>`).join('')}
                        </div>
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

async function loadFiles() {
    const res = await apiFetch(API_URL);
    if (res && res.ok) files = await res.json();
    renderFileList();
}

async function saveEdit(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const tags = document.getElementById(`edit-tags-${id}`).value;
    const formData = new FormData();
    formData.append('id', id);
    formData.append('name', name);
    formData.append('tags', tags);

    const res = await apiFetch(API_URL, { method: 'POST', body: formData });
    if (res && res.ok) { editingId = null; loadFiles(); showToast("更新成功"); }
}

async function deleteFile(id) {
    if (confirm("确定要删除此文件吗？（R2 中的文件也将被移除）")) {
        const res = await apiFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showToast("已删除"); loadFiles(); }
    }
}

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("预览链接已复制");
}

function startEdit(id) { editingId = id; renderFileList(); }
function cancelEdit() { editingId = null; renderFileList(); }
function quickSearch(tag) { document.getElementById('searchInput').value = tag; renderFileList(); }
function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}
init();
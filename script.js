const API_URL = '/api/files';
let files = [];
let accessPassword = localStorage.getItem('pdf_access_token');
let editingId = null;

function init() {
    if (!accessPassword) {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    } else {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    }
}

// 辅助：选择文件后更新界面文本
function updateFileNameDisplay() {
    const input = document.getElementById('fileInput');
    const display = document.getElementById('file-name-display');
    if (input.files.length > 0) {
        display.textContent = input.files[0].name;
        // 自动填入标题建议
        const nameInput = document.getElementById('fileName');
        if (!nameInput.value) {
            nameInput.value = input.files[0].name.replace('.pdf', '');
        }
    }
}

async function apiFetch(url, options = {}) {
    options.headers = { ...options.headers, 'Authorization': accessPassword };
    const res = await fetch(url, options);
    if (res && res.status === 401) { logout(); return null; }
    return res;
}

async function addFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    const tags = document.getElementById('fileTags').value;
    const btn = document.getElementById('addBtn');

    if (!fileInput.files[0] || !name) return showToast("请填写名称并选择文件");

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', tags);

    try {
        const res = await apiFetch(API_URL, { method: 'POST', body: formData });
        if (res && res.ok) {
            showToast("✨ 上传成功！");
            fileInput.value = '';
            document.getElementById('file-name-display').textContent = '选择 PDF 文件';
            document.getElementById('fileName').value = '';
            document.getElementById('fileTags').value = '';
            loadFiles();
        } else {
            showToast("❌ 上传失败，请检查配置");
        }
    } catch (e) {
        showToast("系统错误");
    }
    btn.disabled = false;
    btn.innerHTML = '开始上传';
}

function renderFileList() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList');
    
    const filtered = files.filter(f => {
        if (query.startsWith('#')) return f.tags?.some(t => t.toLowerCase().includes(query.slice(1)));
        return f.name.toLowerCase().includes(query);
    });

    document.getElementById('file-count').textContent = filtered.length;

    list.innerHTML = filtered.reverse().map(file => {
        const isEditing = editingId === file.id;
        return `
        <li class="file-card">
            <div class="file-row">
                ${isEditing ? `
                    <div class="form-grid">
                        <input type="text" id="edit-name-${file.id}" value="${file.name}">
                        <input type="text" id="edit-tags-${file.id}" value="${(file.tags || []).join(',')}">
                        <div class="actions-inline">
                            <button onclick="saveEdit('${file.id}')" class="btn-upload" style="padding:5px 15px">保存</button>
                            <button onclick="cancelEdit()" class="btn-icon">取消</button>
                        </div>
                    </div>
                ` : `
                    <div class="file-info">
                        <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title-link">
                           <i class="far fa-file-pdf" style="margin-right:8px; color:#ef4444"></i>${file.name}
                        </a>
                        <div class="tag-container">
                            ${(file.tags || []).map(t => `<span class="tag" onclick="quickSearch('#${t}')">${t}</span>`).join('')}
                        </div>
                        <div class="actions-inline">
                            <button onclick="startEdit('${file.id}')" class="btn-icon" title="重命名"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteFile('${file.id}')" class="btn-icon btn-del" title="删除"><i class="fas fa-trash-alt"></i></button>
                            <button onclick="shareFile('${file.url}')" class="btn-icon" title="分享链接"><i class="fas fa-share-alt"></i></button>
                        </div>
                    </div>
                `}
            </div>
        </li>`
    }).join('');
}

// ... 其余 loadFiles, deleteFile, saveEdit, logout, showToast 函数保持不变 ...
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
    if (res && res.ok) { editingId = null; loadFiles(); showToast("已更新"); }
}

async function deleteFile(id) {
    if (confirm("确定要删除吗？此操作无法撤销。")) {
        const res = await apiFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showToast("文件已删除"); loadFiles(); }
    }
}

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("📋 链接已复制到剪贴板");
}

function handleLogin() {
    const input = document.getElementById('pw-input');
    if (!input.value) return;
    accessPassword = input.value;
    localStorage.setItem('pdf_access_token', accessPassword);
    init();
}

function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
function startEdit(id) { editingId = id; renderFileList(); }
function cancelEdit() { editingId = null; renderFileList(); }
function quickSearch(tag) { document.getElementById('searchInput').value = tag; renderFileList(); }

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

init();
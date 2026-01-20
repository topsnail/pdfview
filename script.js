let currentTab = 'library', currentPage = 1, limit = 10, selectedIds = new Set();
let accessPassword = localStorage.getItem('pdf_access_token');

function init() {
    if (!accessPassword) {
        document.getElementById('login-overlay').style.display = 'flex';
    } else {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    }
}

async function handleLogin() {
    const pw = document.getElementById('pw-input').value;
    accessPassword = pw;
    localStorage.setItem('pdf_access_token', pw);
    init();
}

async function loadFiles() {
    const q = document.getElementById('searchInput').value;
    const res = await fetch(`/api/files?tab=${currentTab}&page=${currentPage}&limit=${limit}&q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': accessPassword }
    });
    if (res.status === 401) { logout(); return; }
    const result = await res.json();
    renderList(result.data);
    renderPagination(result.total);
}

function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    if (!fileInput.files[0] || !name) return showToast("请填写名称并选择文件", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', document.getElementById('fileTags').value);

    const xhr = new XMLHttpRequest();
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');

    pContainer.style.display = 'block';
    xhr.upload.onprogress = e => {
        const p = Math.round((e.loaded / e.total) * 100);
        pBar.style.width = p + '%';
        document.getElementById('progress-text').textContent = p + '%';
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            showToast("✨ 上传成功", "success");
            fileInput.value = ''; document.getElementById('fileName').value = '';
            loadFiles();
        } else { showToast("❌ 上传失败", "error"); }
        setTimeout(() => pContainer.style.display = 'none', 1000);
    };
    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('Authorization', accessPassword);
    xhr.send(formData);
}

function renderList(data) {
    const list = document.getElementById('fileList');
    list.innerHTML = data.map(file => `
        <li class="file-card">
            <input type="checkbox" class="check-box" onchange="onSelect('${file.id}')" ${selectedIds.has(file.id) ? 'checked' : ''}>
            <div class="file-info">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title">
                   <i class="far fa-file-pdf" style="color:var(--danger)"></i> ${file.name}
                </a>
                <div class="file-meta">
                    <span>📅 ${file.date}</span>
                    <span>🏷️ ${(file.tags || []).join(', ')}</span>
                </div>
            </div>
            <div class="actions">
                ${currentTab === 'library' 
                    ? `<button onclick="deleteItems(['${file.id}'])" class="btn-icon"><i class="fas fa-trash"></i></button>`
                    : `<button onclick="restoreItem('${file.id}')" class="btn-icon"><i class="fas fa-undo"></i></button>`}
            </div>
        </li>
    `).join('');
}

async function deleteItems(ids, purge = false) {
    if (!confirm(purge ? "彻底删除无法恢复！确定吗？" : "移入回收站？")) return;
    const res = await fetch(`/api/files${purge ? '?purge=true' : ''}`, {
        method: 'DELETE',
        headers: { 'Authorization': accessPassword },
        body: JSON.stringify(ids)
    });
    if (res.ok) { showToast("操作成功", "info"); selectedIds.clear(); updateBatchUI(); loadFiles(); }
}

function showToast(msg, type = "info") {
    const t = document.getElementById('toast');
    t.className = `toast show ${type}`;
    t.textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function onFilePicked() {
    const f = document.getElementById('fileInput').files[0];
    if (f) {
        document.getElementById('file-name-text').textContent = f.name;
        if (!document.getElementById('fileName').value) 
            document.getElementById('fileName').value = f.name.replace('.pdf', '');
    }
}

function onSelect(id) { selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id); updateBatchUI(); }
function updateBatchUI() { 
    document.getElementById('batch-toolbar').style.display = selectedIds.size > 0 ? 'flex' : 'none';
    document.getElementById('selected-count').textContent = `已选 ${selectedIds.size} 项`;
}
function handleBatchDelete() { deleteItems(Array.from(selectedIds), currentTab === 'trash'); }
function switchTab(t) { currentTab = t; currentPage = 1; selectedIds.clear(); updateBatchUI(); loadFiles(); }
function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
init();
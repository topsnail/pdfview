let currentTab = 'library', currentPage = 1, limit = 10, selectedIds = new Set();
let accessPassword = localStorage.getItem('pdf_access_token');

function init() {
    if (!accessPassword) {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    } else {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    }
}

async function handleLogin() {
    const pw = document.getElementById('pw-input').value;
    if (!pw) return;
    accessPassword = pw;
    localStorage.setItem('pdf_access_token', pw);
    init();
}

async function loadFiles() {
    const q = document.getElementById('searchInput').value;
    const res = await fetch(`/api/files?tab=${currentTab}&page=${currentPage}&limit=${limit}&q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': accessPassword }
    });
    
    if (res.status === 401) {
        localStorage.removeItem('pdf_access_token');
        accessPassword = null;
        init();
        return;
    }
    
    const result = await res.json();
    renderList(result.data);
    renderPagination(result.total);
}

function renderList(data) {
    const list = document.getElementById('fileList');
    list.innerHTML = data.map(file => `
        <li class="file-card">
            <input type="checkbox" onchange="toggleSelect('${file.id}')" ${selectedIds.has(file.id) ? 'checked' : ''}>
            <div class="file-info">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title">
                    <i class="far fa-file-pdf" style="color:var(--danger)"></i> ${file.name}
                </a>
                <div class="tag-container">
                    ${(file.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    <span style="font-size:11px; color:#94a3b8; margin-left:10px">${file.date}</span>
                </div>
            </div>
            <div class="card-actions">
                ${currentTab === 'library' 
                    ? `<button onclick="deleteSingle('${file.id}')" class="btn-icon"><i class="fas fa-trash"></i></button>`
                    : `<button onclick="restoreSingle('${file.id}')" class="btn-icon"><i class="fas fa-undo"></i></button>`
                }
            </div>
        </li>
    `).join('');
}

function addFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    if (!fileInput.files[0] || !name) return showToast("请填写完整", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', document.getElementById('fileTags').value);

    const xhr = new XMLHttpRequest();
    const pWrap = document.getElementById('progress-wrap');
    const pBar = document.getElementById('progress-bar');
    
    pWrap.style.display = 'block';
    xhr.upload.onprogress = e => {
        const p = Math.round((e.loaded / e.total) * 100);
        pBar.style.width = p + '%';
        document.getElementById('progress-val').textContent = p + '%';
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            showToast("上传成功", "success");
            fileInput.value = ''; document.getElementById('fileName').value = '';
            loadFiles();
        } else { showToast("上传失败", "error"); }
        setTimeout(() => pWrap.style.display = 'none', 1000);
    };
    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('Authorization', accessPassword);
    xhr.send(formData);
}

function toggleSelect(id) {
    selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    const bar = document.getElementById('batch-bar');
    bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
    document.getElementById('batch-info').textContent = `已选 ${selectedIds.size} 项`;
}

async function batchDelete() {
    if (!confirm("确定执行批量删除？")) return;
    const isPurge = currentTab === 'trash';
    const res = await fetch(`/api/files${isPurge ? '?purge=true' : ''}`, {
        method: 'DELETE',
        headers: { 'Authorization': accessPassword },
        body: JSON.stringify(Array.from(selectedIds))
    });
    if (res.ok) { showToast("操作成功", "success"); selectedIds.clear(); toggleSelect(); loadFiles(); }
}

function showToast(msg, type="info") {
    const t = document.getElementById('toast');
    t.className = `toast show ${type}`;
    t.textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function switchTab(t) { currentTab = t; currentPage = 1; selectedIds.clear(); toggleSelect(); loadFiles(); }
function onFileSelected() { 
    const f = document.getElementById('fileInput').files[0];
    if (f) {
        document.getElementById('file-label').textContent = f.name;
        if(!document.getElementById('fileName').value) document.getElementById('fileName').value = f.name.replace('.pdf','');
    }
}
function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
init();
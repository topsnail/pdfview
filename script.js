let currentTab = 'library';
let currentPage = 1;
const limit = 10;
let selectedIds = new Set();
let accessPassword = localStorage.getItem('pdf_access_token');

// 切换标签
function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    selectedIds.clear();
    document.getElementById('tab-library').className = tab === 'library' ? 'active' : '';
    document.getElementById('tab-trash').className = tab === 'trash' ? 'active' : '';
    updateBatchToolbar();
    loadFiles();
}

// 带进度的上传
async function addFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    const tags = document.getElementById('fileTags').value;
    if (!fileInput.files[0] || !name) return showToast("请填写名称并选择文件", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', tags);
    formData.append('action', 'upload');

    const xhr = new XMLHttpRequest();
    const pContainer = document.getElementById('progress-container');
    const pBar = document.getElementById('progress-bar');
    const pText = document.getElementById('progress-text');

    pContainer.style.display = 'block';
    document.getElementById('addBtn').disabled = true;

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            pBar.style.width = percent + '%';
            pText.textContent = percent + '%';
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            showToast("文件上传成功", "success");
            fileInput.value = '';
            document.getElementById('fileName').value = '';
            loadFiles();
        } else {
            showToast("上传失败: " + xhr.status, "error");
        }
        setTimeout(() => pContainer.style.display = 'none', 1000);
        document.getElementById('addBtn').disabled = false;
    };

    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('Authorization', accessPassword);
    xhr.send(formData);
}

// 加载列表（支持分页）
async function loadFiles() {
    const query = document.getElementById('searchInput').value;
    const url = `/api/files?tab=${currentTab}&page=${currentPage}&limit=${limit}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Authorization': accessPassword } });
    
    if (res.status === 401) return logout();
    const result = await res.json();
    renderList(result.data);
    renderPagination(result.total);
}

function renderList(data) {
    const list = document.getElementById('fileList');
    list.innerHTML = data.map(file => `
        <li class="file-card">
            <input type="checkbox" class="file-checkbox" ${selectedIds.has(file.id) ? 'checked' : ''} 
                   onchange="toggleSelect('${file.id}')">
            <div class="file-info">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title">
                    <i class="far fa-file-pdf" style="color:#ef4444"></i> ${file.name}
                </a>
                <div class="tag-container">
                    ${(file.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    <span style="font-size:10px; color:#94a3b8; margin-left:10px">${file.date}</span>
                </div>
            </div>
            <div class="file-actions">
                ${currentTab === 'library' 
                    ? `<button onclick="deleteSingle('${file.id}')" class="btn-icon btn-del"><i class="fas fa-trash"></i></button>`
                    : `<button onclick="restoreSingle('${file.id}')" class="btn-icon" style="color:var(--success)"><i class="fas fa-undo"></i></button>
                       <button onclick="purgeSingle('${file.id}')" class="btn-icon btn-del"><i class="fas fa-times-circle"></i></button>`
                }
            </div>
        </li>
    `).join('');
}

// 批量逻辑
function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateBatchToolbar();
}

function updateBatchToolbar() {
    const toolbar = document.getElementById('batch-toolbar');
    const count = document.getElementById('batch-count');
    if (selectedIds.size > 0) {
        toolbar.style.display = 'flex';
        count.textContent = `已选 ${selectedIds.size} 项`;
    } else {
        toolbar.style.display = 'none';
    }
}

async function batchDelete() {
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个文件吗？`)) return;
    const isPurge = currentTab === 'trash';
    const url = `/api/files${isPurge ? '?purge=true' : ''}`;
    
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': accessPassword, 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(selectedIds))
    });

    if (res.ok) {
        showToast("批量操作完成", "success");
        selectedIds.clear();
        updateBatchToolbar();
        loadFiles();
    }
}

// 分页渲染
function renderPagination(total) {
    const totalPages = Math.ceil(total / limit);
    const container = document.getElementById('pagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                 onclick="changePage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

function changePage(p) { currentPage = p; loadFiles(); }

function showToast(msg, type = "info") {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// 初始启动
window.onload = () => {
    if (accessPassword) {
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    } else {
        document.getElementById('login-container').style.display = 'flex';
    }
};

async function handleLogin() {
    const pw = document.getElementById('pw-input').value;
    accessPassword = pw;
    localStorage.setItem('pdf_access_token', pw);
    location.reload();
}

function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
function updateSelectedFileName() {
    const file = document.getElementById('fileInput').files[0];
    if (file) document.getElementById('fileName').value = file.name.replace('.pdf', '');
}
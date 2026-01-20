let currentTab = 'library', selectedIds = new Set();
let accessPassword = localStorage.getItem('pdf_access_token');

function init() {
    if (!accessPassword) {
        document.getElementById('login-container').style.display = 'block';
    } else {
        document.getElementById('main-content').style.display = 'block';
        loadFiles();
    }
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const name = document.getElementById('fileName').value;
    if (!fileInput.files[0] || !name) return showToast("请填写完整", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('tags', document.getElementById('fileTags').value);

    const xhr = new XMLHttpRequest();
    const pWrap = document.getElementById('progress-wrap');
    pWrap.style.display = 'block';

    xhr.upload.onprogress = e => {
        const p = Math.round((e.loaded / e.total) * 100);
        document.getElementById('progress-bar').style.width = p + '%';
        document.getElementById('progress-val').textContent = p + '%';
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            showToast("上传成功", "success");
            loadFiles();
            ["fileName", "fileTags", "fileInput"].forEach(id => document.getElementById(id).value = '');
            document.getElementById('file-label').textContent = "选择 PDF 文件";
        } else { showToast("上传失败", "error"); }
        setTimeout(() => pWrap.style.display = 'none', 1000);
    };
    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('Authorization', accessPassword);
    xhr.send(formData);
}

async function loadFiles() {
    const q = document.getElementById('searchInput').value;
    const res = await fetch(`/api/files?tab=${currentTab}&q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': accessPassword }
    });
    if (res.status === 401) return logout();
    const data = await res.json();
    renderList(data);
}

function formatFileSize(bytes) {
    // 确保bytes是数字类型
    const size = Number(bytes) || 0;
    if (size === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderList(data) {
    const list = document.getElementById('fileList');
    list.innerHTML = data.map(file => `
        <li class="file-card">
            <input type="checkbox" onchange="toggleSelect('${file.id}')" ${selectedIds.has(file.id) ? 'checked' : ''}>
            <div class="file-info">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title">${file.name}</a>
                <div style="font-size:11px; color:#94a3b8">📅 ${file.date} | 📦 ${file.size ? formatFileSize(file.size) : '未知大小'} | 🏷️ ${file.tags.map(tag => `<span class="tag-item" onclick="searchByTag('${tag}')" style="cursor: pointer; color: var(--primary); text-decoration: underline; margin-right: 4px;">${tag}</span>`).join(', ')}</div>
            </div>
            ${currentTab === 'library' 
                ? `<button onclick="deleteSingle('${file.id}')" class="btn-icon"><i class="fas fa-trash"></i></button>`
                : `<button onclick="restoreSingle('${file.id}')" class="btn-icon"><i class="fas fa-undo"></i></button>`}
        </li>
    `).join('');
}

function searchByTag(tag) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = `#${tag}`;
    loadFiles();
    showToast(`搜索标签: ${tag}`, "success");
}

// 缩短后的 Toast
function showToast(msg, type = "success") {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    // 1500ms 后消失
    setTimeout(() => t.classList.remove('show'), 1500); 
}

// 确认框功能
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    modal.style.display = 'flex';
    
    // 清除之前的事件监听器
    confirmOk.onclick = null;
    confirmCancel.onclick = null;
    
    // 添加新的事件监听器
    confirmOk.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    
    confirmCancel.onclick = () => {
        modal.style.display = 'none';
    };
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function onFileSelected() {
    const file = document.getElementById('fileInput').files[0];
    if (file) {
        document.getElementById('file-label').textContent = file.name;
        if (!document.getElementById('fileName').value) 
            document.getElementById('fileName').value = file.name.replace('.pdf', '');
    }
}

function toggleSelect(id) {
    // 只有当id存在时才操作集合
    if (id !== undefined) {
        selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    }
    document.getElementById('batch-bar').style.display = selectedIds.size > 0 ? 'flex' : 'none';
    document.getElementById('batch-count').textContent = `已选 ${selectedIds.size} 项`;
}

async function batchDelete() {
    showConfirm(
        "批量删除",
        "确定执行批量删除？",
        async () => {
            const isPurge = currentTab === 'trash';
            const res = await fetch(`/api/files${isPurge ? '?purge=true' : ''}`, {
                method: 'DELETE',
                headers: { 'Authorization': accessPassword },
                body: JSON.stringify(Array.from(selectedIds))
            });
            if (res.ok) { showToast("操作成功"); selectedIds.clear(); toggleSelect(); loadFiles(); }
        }
    );
}

function switchTab(t) { currentTab = t; selectedIds.clear(); toggleSelect(); loadFiles(); 
    document.getElementById('tab-library').className = t === 'library' ? 'active' : '';
    document.getElementById('tab-trash').className = t === 'trash' ? 'active' : '';
}
function handleLogin() {
    const password = document.getElementById('pw-input').value;
    if (!password) return showToast("请输入密码", "error");
    
    // 本地测试模式：直接设置token
    localStorage.setItem('pdf_access_token', password);
    accessPassword = password;
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    showToast("登录成功", "success");
    loadFiles();
}

async function deleteSingle(id) {
    showConfirm(
        "删除文件",
        "确定删除此文件？",
        async () => {
            const res = await fetch('/api/files', {
                method: 'DELETE',
                headers: { 'Authorization': accessPassword },
                body: JSON.stringify([id])
            });
            if (res.ok) { showToast("删除成功", "success"); loadFiles(); }
        }
    );
}

async function restoreSingle(id) {
    showConfirm(
        "恢复文件",
        "确定恢复此文件？",
        async () => {
            const formData = new FormData();
            formData.append('action', 'restore');
            formData.append('id', id);
            
            const res = await fetch('/api/files', {
                method: 'POST',
                headers: { 'Authorization': accessPassword },
                body: formData
            });
            if (res.ok) { showToast("恢复成功", "success"); loadFiles(); }
        }
    );
}

function cancelBatch() {
    selectedIds.clear();
    toggleSelect();
}

function renderFileList() {
    loadFiles();
}

function logout() { localStorage.removeItem('pdf_access_token'); location.reload(); }
init();
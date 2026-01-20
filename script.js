// R2存储桶配置
const R2_CONFIG = {
    bucketName: 'pdf-storage',
    accountId: '3dda08e3f72e78a125d2e5c79f236eb9',
    accessKey: '62d256a47d38ef5ee51653b3d3c20736',
    secretKey: '0d7ff7af7af34793f23d15cde1867fbdab8176ec881cac6030c0a9c1889de0a3',
    endpoint: 'https://3dda08e3f72e78a125d2e5c79f236eb9.r2.cloudflarestorage.com'
};

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

async function uploadFile() {
    const name = document.getElementById('fileName').value;
    const fileInput = document.getElementById('fileUpload');
    const tags = document.getElementById('fileTags').value;
    const btn = document.getElementById('addBtn');
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (!name || !fileInput.files.length) return showToast("请填写文件名称并选择文件");

    btn.disabled = true;
    progressContainer.style.display = 'block';
    
    const file = fileInput.files[0];
    if (file.type !== 'application/pdf') return showToast("请上传PDF文件");
    if (file.size > 10 * 1024 * 1024) return showToast("文件大小不能超过10MB");

    try {
        // 生成唯一文件名
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const fileUrl = await uploadToR2(file, fileName, (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `上传进度: ${percent}%`;
        });

        const fileData = {
            id: Date.now().toString(),
            name,
            url: fileUrl,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            date: new Date().toLocaleDateString()
        };

        const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify(fileData) });
        if (res && res.ok) {
            showToast("上传成功");
            ["fileName", "fileTags"].forEach(id => document.getElementById(id).value = '');
            fileInput.value = '';
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            loadFiles();
        }
    } catch (error) {
        console.error('上传失败:', error);
        showToast("上传失败，请重试");
        progressContainer.style.display = 'none';
    } finally {
        btn.disabled = false;
    }
}

async function uploadToR2(file, fileName, onProgress) {
    const formData = new FormData();
    formData.append('file', file, fileName);
    
    // 这里需要根据实际的R2上传API进行修改
    // 以下是一个示例实现，实际需要根据R2的API文档进行调整
    const response = await fetch(`${R2_CONFIG.endpoint}/${R2_CONFIG.bucketName}/${fileName}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/pdf',
            'Authorization': `Bearer ${R2_CONFIG.accessKey}`
        },
        body: file,
        onUploadProgress: onProgress
    });
    
    if (!response.ok) {
        throw new Error('上传失败');
    }
    
    return `${R2_CONFIG.endpoint}/${R2_CONFIG.bucketName}/${fileName}`;
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
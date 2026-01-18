const API_URL = '/api/files';
let files = [];

// 1. 修复加载状态逻辑
async function loadFiles() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block'; // 显示加载中
    
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            files = await res.json();
        } else {
            files = JSON.parse(localStorage.getItem('pdf_files') || '[]');
        }
    } catch (e) {
        files = JSON.parse(localStorage.getItem('pdf_files') || '[]');
    } finally {
        // 关键修复：无论成功失败都隐藏加载提示
        loading.style.display = 'none';
        renderFileList();
    }
}

// 2. 添加/更新文件逻辑
async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    if (!name || !url) return showToast("请填写完整信息");

    const newFile = { id: Date.now().toString(), name, url };
    
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(newFile) });
    } catch (e) {
        files.push(newFile);
        localStorage.setItem('pdf_files', JSON.stringify(files));
    }
    
    clearInputs();
    showToast("添加成功！");
    loadFiles();
}

// 3. 编辑文件功能 [新增加]
async function editFile(id) {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const newName = prompt("修改文件名：", file.name);
    if (newName === null) return; // 取消
    const newUrl = prompt("修改 PDF 地址：", file.url);
    if (newUrl === null) return; // 取消

    const updatedFile = { ...file, name: newName, url: newUrl };

    try {
        // 更新逻辑（后端 Worker 需支持根据 ID 更新，或直接重新覆盖列表）
        await fetch(`${API_URL}?id=${id}`, { 
            method: 'POST', // 简化处理：复用 POST 逻辑在 Worker 端处理更新
            body: JSON.stringify(updatedFile) 
        });
    } catch (e) {
        // 本地更新
        const index = files.findIndex(f => f.id === id);
        files[index] = updatedFile;
        localStorage.setItem('pdf_files', JSON.stringify(files));
    }

    showToast("修改成功！");
    renderFileList();
}

// 4. 渲染列表增加编辑按钮
function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = files.map(file => `
        <li>
            <div class="file-info">
                <strong>${file.name}</strong>
            </div>
            <div class="actions">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" class="btn-sm btn-view" target="_blank">查看</a>
                <button onclick="editFile('${file.id}')" class="btn-sm btn-edit">编辑</button>
                <button onclick="shareFile('${file.url}')" class="btn-sm">分享</button>
                <button onclick="deleteFile('${file.id}')" class="btn-sm btn-del">删除</button>
            </div>
        </li>
    `).join('');
}

// 5. Toast 提示函数
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function clearInputs() {
    document.getElementById('fileName').value = '';
    document.getElementById('fileUrl').value = '';
}

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("链接已复制！");
}

async function deleteFile(id) {
    if (!confirm("确定删除吗？")) return;
    try {
        await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    } catch (e) {}
    files = files.filter(f => f.id !== id);
    localStorage.setItem('pdf_files', JSON.stringify(files));
    renderFileList();
    showToast("已删除");
}

loadFiles();

const API_URL = '/api/files';
let files = [];

// 初始化加载
async function loadFiles() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            files = await res.json();
        } else {
            // 后备：从本地存储读取
            files = JSON.parse(localStorage.getItem('pdf_files') || '[]');
        }
        renderFileList();
    } catch (e) {
        files = JSON.parse(localStorage.getItem('pdf_files') || '[]');
        renderFileList();
    }
}

async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    if (!name || !url) return showToast("请填写完整信息");

    const newFile = { id: Date.now().toString(), name, url };
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(newFile)
        });
        if (!res.ok) throw new Error();
    } catch (e) {
        // 本地开发模式
        files.push(newFile);
        localStorage.setItem('pdf_files', JSON.stringify(files));
    }
    
    document.getElementById('fileName').value = '';
    document.getElementById('fileUrl').value = '';
    showToast("添加成功");
    loadFiles();
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

function shareFile(url) {
    const shareUrl = `${window.location.origin}/viewer.html?file=${encodeURIComponent(url)}`;
    navigator.clipboard.writeText(shareUrl);
    showToast("链接已复制到剪贴板");
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = files.map(file => `
        <li>
            <span>${file.name}</span>
            <div class="actions">
                <a href="viewer.html?file=${encodeURIComponent(file.url)}" class="btn-sm btn-view" target="_blank">查看</a>
                <button onclick="shareFile('${file.url}')" class="btn-sm">分享</button>
                <button onclick="deleteFile('${file.id}')" class="btn-sm btn-del">删除</button>
            </div>
        </li>
    `).join('');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

loadFiles();

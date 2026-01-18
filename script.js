// 从 LocalStorage 获取密码，如果没有则提示输入
let accessPassword = localStorage.getItem('pdf_access_token');

async function checkLogin() {
    if (!accessPassword) {
        accessPassword = prompt("请输入管理密码：");
        localStorage.setItem('pdf_access_token', accessPassword);
    }
}

// 修改后的 fetch 包装器
async function apiFetch(url, options = {}) {
    await checkLogin();
    options.headers = {
        ...options.headers,
        'Authorization': accessPassword
    };
    const res = await fetch(url, options);
    if (res.status === 401) {
        alert("密码错误！");
        localStorage.removeItem('pdf_access_token');
        location.reload();
    }
    return res;
}

// 示例：修改后的 addFile 使用 apiFetch
async function addFile() {
    const name = document.getElementById('fileName').value;
    const url = document.getElementById('fileUrl').value;
    if (!name || !url) return;

    const res = await apiFetch('/api/files', {
        method: 'POST',
        body: JSON.stringify({ id: Date.now().toString(), name, url })
    });
    
    if (res.ok) {
        showToast("添加成功");
        loadFiles();
    }
}
// ... 其他 loadFiles, deleteFile 均改为使用 apiFetch ...

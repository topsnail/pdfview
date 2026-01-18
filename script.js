// ... (前面的代码保持不变) ...

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
                    <div class="row">
                        <input type="text" id="edit-name-${file.id}" value="${file.name}" placeholder="名称">
                        <input type="text" id="edit-tags-${file.id}" value="${(file.tags || []).join(', ')}" placeholder="标签">
                    </div>
                    <input type="text" id="edit-url-${file.id}" value="${file.url}" placeholder="链接">
                    <div class="edit-actions">
                        <button onclick="saveEdit('${file.id}')" class="btn-save">保存</button>
                        <button onclick="cancelEdit()" class="btn-cancel">取消</button>
                    </div>
                </div>
            ` : `
                <div class="file-row">
                    <div class="file-info">
                        <a href="viewer.html?file=${encodeURIComponent(file.url)}" target="_blank" class="file-title-link">
                            ${file.name}
                        </a>
                        <div class="tag-container">
                            ${(file.tags || []).map(t => `<span class="tag" onclick="quickSearch('#${t}')">${t}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="actions-inline">
                        <button onclick="startEdit('${file.id}')" class="btn-icon" title="编辑">改</button>
                        <button onclick="deleteFile('${file.id}')" class="btn-icon btn-del" title="删除">删</button>
                        <button onclick="shareFile('${file.url}')" class="btn-icon" title="分享">享</button>
                    </div>
                </div>
                <div class="file-footer">
                    <span class="file-date">${file.date || ''}</span>
                </div>
            `}
        </li>
    `}).join('');
}

// ... (后面的代码保持不变) ...

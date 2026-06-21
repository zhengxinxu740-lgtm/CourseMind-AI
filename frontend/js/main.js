/* ========================================
   课件智析 CourseMind - 前端逻辑
   ======================================== */

// ==========================================
// 1. DOM 元素引用（获取页面上的所有关键元素）
// ==========================================

const uploadZone    = document.getElementById('uploadZone');
const fileInput     = document.getElementById('fileInput');
const fileList      = document.getElementById('fileList');
const btnParse      = document.getElementById('btnParse');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText   = document.getElementById('loadingText');
const chatInput     = document.getElementById('chatInput');
const btnSend       = document.getElementById('btnSend');
const chatMessages  = document.getElementById('chatMessages');

// 存储已选文件
let selectedFiles = [];

// 存储上传后服务器返回的文件名（用于后续解析和AI分析）
let uploadedFileNames = [];

// 存储当前解析的文件名（用于AI分析时指定课件）
let currentParsedFile = null;

// ==========================================
// 2. 文件上传功能
// ==========================================

// 点击上传区域 → 打开文件选择框
uploadZone.addEventListener('click', function() {
    fileInput.click();
});

// 文件选择框：选中文件后
fileInput.addEventListener('change', function() {
    addFiles(fileInput.files);
    fileInput.value = ''; // 清空 input，允许重复选同一个文件
});

// 拖拽文件到上传区域
uploadZone.addEventListener('dragover', function(e) {
    e.preventDefault();           // 阻止浏览器默认行为
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', function() {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
});

// 将文件加入列表
function addFiles(fileListObj) {
    for (let file of fileListObj) {
        // 只接受 PDF 和 PPT
        if (!file.name.match(/\.(pdf|ppt|pptx)$/i)) {
            alert('仅支持 PDF 和 PPT 文件：' + file.name);
            continue;
        }
        // 避免重复添加
        if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            continue;
        }
        selectedFiles.push(file);
    }
    renderFileList();
}

// 渲染文件列表到页面
function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach(function(file, index) {
        let div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span class="file-name" title="${file.name}">📄 ${file.name}</span>
            <span class="file-remove" data-index="${index}">×</span>
        `;
        fileList.appendChild(div);
    });

    // 绑定删除按钮
    fileList.querySelectorAll('.file-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            let i = parseInt(this.getAttribute('data-index'));
            selectedFiles.splice(i, 1);
            renderFileList();
        });
    });

    // 有文件时启用"解析课件"按钮
    btnParse.disabled = (selectedFiles.length === 0);
}

// ==========================================
// 3. 模块导航切换（点击时触发 AI 懒加载）
// ==========================================

let currentModule = 'summary';

document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        // 切换导航按钮的 active 状态
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换内容模块的显示
        let moduleName = btn.getAttribute('data-module');
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        document.getElementById('module-' + moduleName).classList.add('active');

        currentModule = moduleName;

        // 点击模块时触发 AI 懒加载
        loadAIModule(moduleName);
    });
});

// ==========================================
// 4. 解析课件（点击按钮 → 发送到后端）
// ==========================================

btnParse.addEventListener('click', function() {
    if (selectedFiles.length === 0) return;
    parseCourseware();
});

function parseCourseware() {
    if (selectedFiles.length === 0) return;

    showLoading('正在上传课件...');

    let formData = new FormData();
    selectedFiles.forEach(function(file) {
        formData.append('files', file);
    });

    // === 第一步：上传文件 ===
    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(function(response) {
        if (!response.ok) throw new Error('上传失败，HTTP ' + response.status);
        return response.json();
    })
    .then(function(data) {
        console.log('上传成功：', data);

        // 记录服务器返回的实际文件名（可能被加了时间戳）
        uploadedFileNames = data.uploaded.map(function(f) {
            return f.saved_name;
        });

        if (uploadedFileNames.length === 0) {
            throw new Error('没有成功上传的文件');
        }

        updateStatus('loading', '上传完成，开始解析...');
        loadingText.textContent = '正在提取课件中的文字内容...';

        // === 第二步：解析指定的课件 ===
        return fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: uploadedFileNames })
        });
    })
    .then(function(response) {
        if (!response.ok) throw new Error('解析失败，HTTP ' + response.status);
        return response.json();
    })
    .then(function(data) {
        hideLoading();
        updateStatus('ready', '解析完成');
        console.log('解析结果：', data);

        if (data.results && data.results.length > 0) {
            // 记录当前解析的文件名
            currentParsedFile = data.results[0].file;
            // 显示解析和 AI 结果
            displayParseResult(data);
        } else {
            alert('解析结果为空，请检查文件是否有效');
        }
    })
    .catch(function(error) {
        hideLoading();
        updateStatus('error', '操作失败');
        alert('课件处理失败：' + error.message
            + '\n\n🔧 请确认：'
            + '\n1. 后端服务已启动（python backend\\app.py）'
            + '\n2. 访问地址是 http://localhost:5000');
        console.error('处理错误：', error);
    });
}

// 显示解析结果到各个模块，并调用 AI 生成内容
function displayParseResult(data) {
    if (!data || !data.results || data.results.length === 0) {
        alert('解析结果为空，请检查文件是否有效');
        return;
    }

    // 取第一个文件的解析结果
    let result = data.results[0];
    let text = result.text || '';
    currentParsedFile = result.file;

    // === 模块1: AI课程总结 → 先显示文本预览，然后调用 AI ===
    let overview = document.getElementById('summary-overview');
    overview.innerHTML = ''
        + '<p style="color:#34c759;font-weight:600;margin-bottom:8px;">'
        + '   ✅ 解析完成！文件：' + escapeHtml(result.file)
        + ' | 类型：' + result.type.toUpperCase()
        + (result.pages ? ' | 共 ' + result.pages + ' 页' : '')
        + ' | 文字量：' + (result.text_length || text.length) + ' 字符'
        + '</p>'
        + '<p style="color:#6e6e73;margin-bottom:8px;">⏳ AI 正在生成课程总结...</p>';

    let keypoints = document.getElementById('summary-keypoints');
    keypoints.innerHTML = '<p style="color:#6e6e73;">⏳ 等待 AI 生成...</p>';

    let relations = document.getElementById('summary-relations');
    relations.innerHTML = '<p style="color:#6e6e73;">⏳ 等待 AI 生成...</p>';

    // 其他模块提示
    document.getElementById('exam-content').innerHTML =
        '<p style="color:#6e6e73;">⏳ 点击左侧「考试重点」加载 AI 分析结果</p>';
    document.getElementById('framework-content').innerHTML =
        '<p style="color:#6e6e73;">⏳ 点击左侧「知识框架」加载 AI 分析结果</p>';
    document.getElementById('mindmap-content').innerHTML =
        '<p style="color:#6e6e73;">⏳ 点击左侧「思维导图」加载 AI 分析结果</p>';
    document.getElementById('quiz-content').innerHTML =
        '<p style="color:#6e6e73;">⏳ 点击左侧「练习题」加载 AI 分析结果</p>';

    // === 启用聊天 ===
    chatInput.disabled = false;
    btnSend.disabled = false;

    // 显示系统消息
    let chatMsgs = document.getElementById('chatMessages');
    let sysMsg = document.createElement('div');
    sysMsg.className = 'chat-msg system';
    sysMsg.innerHTML = '<p>📄 <b>' + escapeHtml(result.file) + '</b> 已解析完成！'
        + '共提取 <b>' + (result.text_length || text.length) + '</b> 个字符。</p>'
        + '<p>你可以向我提问课件中的任何内容。</p>';
    chatMsgs.appendChild(sysMsg);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    // === 调用 AI 课程总结 ===
    callAISummary(result.file);
}

// 调用 AI 课程总结
function callAISummary(filename) {
    fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        if (data.error) throw new Error(data.error);

        let overview = document.getElementById('summary-overview');
        let keypoints = document.getElementById('summary-keypoints');
        let relations = document.getElementById('summary-relations');

        overview.innerHTML = '<div style="white-space:pre-wrap;line-height:1.8;">'
            + markdownToHtml(data.overview) + '</div>';

        keypoints.innerHTML = '<div style="white-space:pre-wrap;line-height:1.8;">'
            + markdownToHtml(data.key_points) + '</div>';

        relations.innerHTML = '<div style="white-space:pre-wrap;line-height:1.8;">'
            + markdownToHtml(data.relations) + '</div>';
    })
    .catch(function(err) {
        console.error('AI总结错误：', err);
        document.getElementById('summary-overview').innerHTML =
            '<p style="color:#ff3b30;">❌ AI 总结失败：' + escapeHtml(err.message)
            + '<br><small>请确认 DeepSeek API 服务已启动（默认 http://localhost:11434）</small></p>';
    });
}

// 加载 AI 模块内容（懒加载）
let _aiLoaded = {};  // 记录哪些模块已加载

function loadAIModule(moduleName) {
    if (_aiLoaded[moduleName]) return;  // 已加载，不重复请求
    if (!currentParsedFile) return;

    let container = null;
    let apiUrl = '';
    let loadingText = '';

    switch (moduleName) {
        case 'exam':
            container = document.getElementById('exam-content');
            apiUrl = '/api/ai/exam';
            loadingText = '⭐ AI 正在提炼考试重点...';
            break;
        case 'framework':
            container = document.getElementById('framework-content');
            apiUrl = '/api/ai/framework';
            loadingText = '🌳 AI 正在生成知识框架...';
            break;
        case 'mindmap':
            container = document.getElementById('mindmap-content');
            apiUrl = '/api/ai/mindmap';
            loadingText = '🧩 AI 正在生成思维导图...';
            break;
        case 'quiz':
            container = document.getElementById('quiz-content');
            apiUrl = '/api/ai/quiz';
            loadingText = '📝 AI 正在生成练习题...';
            break;
        default:
            return;
    }

    container.innerHTML = '<p style="color:#6e6e73;">' + loadingText + '</p>';
    _aiLoaded[moduleName] = true;

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: currentParsedFile })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        if (data.error) throw new Error(data.error);
        container.innerHTML = '<div style="white-space:pre-wrap;line-height:1.8;">'
            + markdownToHtml(data.content) + '</div>';
    })
    .catch(function(err) {
        console.error('AI模块错误：', err);
        container.innerHTML = '<p style="color:#ff3b30;">❌ AI 分析失败：'
            + escapeHtml(err.message)
            + '<br><small>请确认 DeepSeek API 服务已启动</small></p>';
    });
}

// ==========================================
// 5. 状态指示
// ==========================================

function updateStatus(state, text) {
    statusText.textContent = text;
    statusDot.className = 'status-dot';
    if (state === 'loading') {
        statusDot.classList.add('loading');
    } else if (state === 'error') {
        statusDot.classList.add('error');
    }
}

// ==========================================
// 6. 加载动画
// ==========================================

function showLoading(text) {
    loadingText.textContent = text || '正在处理...';
    loadingOverlay.hidden = false;
    updateStatus('loading', '处理中...');
}

function hideLoading() {
    loadingOverlay.hidden = true;
    updateStatus('ready', '就绪');
}

// ==========================================
// 7. AI 问答（聊天功能）
// ==========================================

btnSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    let question = chatInput.value.trim();
    if (!question) return;

    // 显示用户消息
    addChatMessage('user', question);
    chatInput.value = '';

    // 显示"思考中"
    let thinkingMsg = addChatMessage('assistant', '🤔 AI 思考中...');

    // 发送到后端，携带当前课件文件名
    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: question,
            filename: currentParsedFile
        })
    })
    .then(function(response) {
        if (!response.ok) throw new Error('请求失败');
        return response.json();
    })
    .then(function(data) {
        // 替换"思考中"为实际回答
        let answer = data.answer || '（AI 未返回内容）';
        thinkingMsg.innerHTML = '<div style="white-space:pre-wrap;">'
            + markdownToHtml(answer) + '</div>';
    })
    .catch(function(error) {
        thinkingMsg.innerHTML = '<p>❌ ' + escapeHtml('请求失败：' + error.message
            + '<br><small>请确认后端和 DeepSeek API 均正常运行</small>') + '</p>';
        console.error('聊天错误：', error);
    });
}

function addChatMessage(role, text) {
    let div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.innerHTML = '<p>' + escapeHtml(text) + '</p>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// ==========================================
// 8. 思维导图导出按钮（界面占位，后续实现）
// ==========================================

document.getElementById('btnExportImage').addEventListener('click', function() {
    alert('导出图片功能将在后续步骤实现');
});

document.getElementById('btnExportMD').addEventListener('click', function() {
    alert('导出 Markdown 功能将在后续步骤实现');
});

// ==========================================
// 9. 工具函数
// ==========================================

// 防止 XSS（把 HTML 特殊字符转义）
function escapeHtml(text) {
    let div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 简易 Markdown → HTML 转换
function markdownToHtml(md) {
    if (!md) return '';
    let html = escapeHtml(md);

    // 标题
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 6px;font-size:15px;">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:17px;color:#1d1d1f;">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 style="margin:20px 0 10px;font-size:20px;color:#1d1d1f;">$1</h2>');

    // 加粗和斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');

    // 星级符号
    html = html.replace(/★/g, '<span style="color:#ff9500;">★</span>');
    html = html.replace(/☆/g, '<span style="color:#aeaeb2;">☆</span>');

    // 分隔线
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e8e8ed;margin:16px 0;">');

    // 无序列表
    html = html.replace(/^- (.+)$/gm, '<li style="margin-left:20px;">$1</li>');
    html = html.replace(/^  - (.+)$/gm, '<li style="margin-left:40px;">$1</li>');
    html = html.replace(/^    - (.+)$/gm, '<li style="margin-left:60px;">$1</li>');

    // 有序列表（数字 + 点 + 空格）
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;">$1. $2</li>');

    // 代码块
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#f5f5f7;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;">$1</pre>');

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f5f5f7;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>');

    // 换行
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ==========================================
// 10. 初始化日志
// ==========================================

console.log('🧠 课件智析 CourseMind - 前端已就绪');
console.log('📂 项目路径：C:/Users/Administrator/Desktop/course-mind');
console.log('🌐 打开 index.html 即可预览界面');

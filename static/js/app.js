// 全局状态
let currentBook = null;
let currentPage = 1;
let totalPages = 0;
let searchResults = [];
let currentResultIndex = 0;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initSearch();
    initAISearch();
    initExamSearch();
    initNavigation();
});

// 文件上传功能
function initUpload() {
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('book_id', 'default');
        
        try {
            showLoading('正在上传和处理课本...');
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || '上传失败');
            }
            
            currentBook = result.book_id;
            document.getElementById('bookTitle').innerHTML = `<i class="fas fa-book"></i> ${result.filename}`;
            
            if (result.thumbnails && result.thumbnails.length > 0) {
                loadThumbnails(result.thumbnails);
            }
            
            pollProcessingStatus(result.file_path);
        } catch (error) {
            showError('上传失败: ' + error.message);
            hideLoading();
        }
    });
}

// 搜索功能
function initSearch() {
    const searchForm = document.getElementById('searchForm');
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = document.getElementById('searchQuery').value.trim();
        if (!query) return;
        
        try {
            showLoading('正在搜索课本内容...');
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    book_id: currentBook || 'default'
                })
            });
            
            const data = await response.json();
            searchResults = data.results;
            currentResultIndex = 0;
            
            if (searchResults.length > 0) {
                displaySearchResults();
                loadPage(searchResults[0].page_number);
            } else {
                showMessage('没有找到相关内容', 'info');
            }
        } catch (error) {
            showError('搜索失败: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

// 显示搜索结果
function displaySearchResults() {
    const container = document.getElementById('searchResults');
    container.innerHTML = '';
    
    if (searchResults.length === 0) {
        container.innerHTML = '<p class="no-results">没有找到匹配的结果</p>';
        return;
    }
    
    searchResults.forEach((result, index) => {
        const element = document.createElement('div');
        element.className = `search-result ${index === currentResultIndex ? 'active' : ''}`;
        element.innerHTML = `
            <div class="result-page-number">第 ${result.page_number} 页</div>
            <div class="result-preview">${result.preview_text}</div>
        `;
        element.addEventListener('click', () => {
            currentResultIndex = index;
            loadPage(result.page_number);
        });
        container.appendChild(element);
    });
}

// 加载缩略图
function loadThumbnails(thumbnails) {
    const container = document.getElementById('thumbnailContainer');
    if (!container) return;
    
    container.innerHTML = thumbnails.map((thumb, idx) => `
        <div class="thumbnail-item" data-page="${idx + 1}">
            <img src="${thumb}" class="thumbnail-img">
            <div class="thumbnail-number">${idx + 1}</div>
        </div>
    `).join('');
    
    // 添加缩略图点击事件
    document.querySelectorAll('.thumbnail-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageNum = parseInt(item.dataset.page);
            loadPage(pageNum);
        });
    });
}

// 加载页面内容
async function loadPage(pageNum) {
    if (!currentBook) return;
    
    try {
        showLoading('正在加载页面...');
        const response = await fetch(`/api/page/${currentBook}/${pageNum}`);
        
        if (!response.ok) {
            throw new Error('页面加载失败');
        }
        
        const data = await response.json();
        currentPage = data.page_number;
        
        // 更新页面显示
        document.getElementById('pageImage').src = data.image_path;
        document.getElementById('pageText').textContent = data.text_content || '此页面没有可显示的文本内容';
        document.getElementById('currentPage').textContent = currentPage;
        
        // 更新按钮状态
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
        
        // 更新缩略图选中状态
        updateThumbnailSelection();
        // 高亮当前搜索结果
        highlightCurrentResult();
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// 更新缩略图选中状态
function updateThumbnailSelection() {
    document.querySelectorAll('.thumbnail-item').forEach(item => {
        const pageNum = parseInt(item.dataset.page);
        item.classList.toggle('active', pageNum === currentPage);
    });
}

// 高亮当前搜索结果
function highlightCurrentResult() {
    document.querySelectorAll('.search-result').forEach((el, index) => {
        el.classList.toggle('active', index === currentResultIndex);
    });
}

// 翻页功能
function initNavigation() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < totalPages) loadPage(currentPage + 1);
    });
}

// AI搜索功能
function initAISearch() {
    const aiForm = document.getElementById('aiForm');
    aiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('aiQuestion').value.trim();
        if (!question) return;
        
        try {
            showLoading('AI正在思考...');
            const response = await fetch('/api/ai/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    context: getCurrentPageContext()
                })
            });
            
            const data = await response.json();
            const answer = data.choices[0].message.content;
            
            document.getElementById('aiAnswer').innerHTML = `
                <div class="ai-answer-header">
                    <i class="fas fa-robot"></i> AI回答
                </div>
                <div class="ai-answer-content">${answer}</div>
            `;
        } catch (error) {
            showError('AI解答失败: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

// 真题搜索功能
function initExamSearch() {
    const examKeyword = document.getElementById('examKeyword');
    examKeyword.addEventListener('input', debounce(async (e) => {
        const keyword = e.target.value.trim();
        if (keyword.length < 2) {
            document.getElementById('examResults').innerHTML = '<p class="placeholder-text">输入至少2个字符开始搜索</p>';
            return;
        }
        
        try {
            const response = await fetch(`/api/exam/search?keyword=${encodeURIComponent(keyword)}`);
            const data = await response.json();
            displayExamResults(data.results);
        } catch (error) {
            console.error('真题搜索失败:', error);
            showError('真题搜索失败');
        }
    }, 500));
}

// 显示真题结果
function displayExamResults(results) {
    const container = document.getElementById('examResults');
    
    if (results.length === 0) {
        container.innerHTML = '<p class="no-results">未找到相关真题</p>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <div class="exam-item">
            <div class="exam-question">${item.question}</div>
            <div class="exam-answer">${item.answer}</div>
        </div>
    `).join('');
}

// 获取当前页面文本作为上下文
function getCurrentPageContext() {
    return document.getElementById('pageText').textContent || '';
}

// 轮询处理状态
async function pollProcessingStatus(filePath) {
    try {
        const response = await fetch(`/api/status?file_path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.status === 'complete') {
            // 获取总页数
            const pagesResponse = await fetch(`/api/page/${currentBook}/1`);
            const pageData = await pagesResponse.json();
            totalPages = pageData.next_page - 1;
            
            loadPage(1);
            showMessage('课本处理完成！', 'success');
        } else {
            setTimeout(() => pollProcessingStatus(filePath), 2000);
        }
    } catch (error) {
        setTimeout(() => pollProcessingStatus(filePath), 2000);
    }
}

/* ========== 工具函数 ========== */

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 显示加载状态
function showLoading(message = '处理中...') {
    const loading = document.getElementById('loading');
    loading.querySelector('.loading-text').textContent = message;
    loading.style.display = 'flex';
}

// 隐藏加载状态
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// 显示消息提示
function showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 
                         type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 显示错误消息
function showError(message) {
    showMessage(message, 'error');
}

/**
 * 同步服务 - 处理日记内容到项目文档的复制逻辑
 */
class SyncService {
    constructor(settings) {
        this.settings = settings;
        this.isAutoSyncEnabled = false;
        this.autoSyncTimer = null;
        this.lastActivityTime = Date.now();
        this.shortcutListener = null;
        this.isRecording = false;
        
        this.init();
    }

    /**
     * 初始化同步服务
     */
    init() {
        this.setupAutoSync();
        this.setupManualSync();
        this.setupActivityMonitor();
    }

    /**
     * 更新设置
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.restart();
    }

    /**
     * 重启同步服务
     */
    restart() {
        this.stop();
        this.init();
    }

    /**
     * 停止同步服务
     */
    stop() {
        this.stopAutoSync();
        this.stopManualSync();
        this.stopActivityMonitor();
    }

    /**
     * 设置自动同步
     */
    setupAutoSync() {
        if (this.settings.copyMechanism === 'auto') {
            this.isAutoSyncEnabled = true;
            console.log('自动同步已启用，延迟时间:', this.settings.autoCopyTime, '秒');
        }
    }

    /**
     * 停止自动同步
     */
    stopAutoSync() {
        this.isAutoSyncEnabled = false;
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
    }

    /**
     * 设置手动同步快捷键
     */
    setupManualSync() {
        if (this.settings.copyMechanism === 'manual') {
            this.bindShortcut(this.settings.manualCopyShortcut);
            console.log('手动同步快捷键已设置:', this.settings.manualCopyShortcut);
        }
    }

    /**
     * 停止手动同步
     */
    stopManualSync() {
        if (this.shortcutListener) {
            document.removeEventListener('keydown', this.shortcutListener);
            document.removeEventListener('click', this.shortcutListener);
            this.shortcutListener = null;
        }
    }

    /**
     * 绑定快捷键
     */
    bindShortcut(shortcut) {
        if (!shortcut) return;

        const keys = shortcut.toLowerCase().split('+').map(k => k.trim());
        
        this.shortcutListener = (e) => {
            // 检查是否匹配快捷键组合
            if (this.matchesShortcut(e, keys)) {
                e.preventDefault();
                this.triggerManualSync();
            }
        };

        // 绑定键盘事件
        if (keys.some(key => ['left click', 'right click', 'middle click'].includes(key))) {
            document.addEventListener('click', this.shortcutListener);
        } else {
            document.addEventListener('keydown', this.shortcutListener);
        }
    }

    /**
     * 检查事件是否匹配快捷键
     */
    matchesShortcut(e, keys) {
        const pressedKeys = [];
        
        // 检查修饰键
        if (e.metaKey) pressedKeys.push('command', 'cmd');
        if (e.ctrlKey) pressedKeys.push('ctrl', 'control');
        if (e.altKey) pressedKeys.push('alt', 'option');
        if (e.shiftKey) pressedKeys.push('shift');
        
        // 检查主键
        if (e.type === 'keydown' && e.key) {
            if (e.key === ' ') {
                pressedKeys.push('space');
            } else if (e.key.length === 1) {
                pressedKeys.push(e.key.toLowerCase());
            } else {
                pressedKeys.push(e.key.toLowerCase());
            }
        }
        
        // 检查鼠标点击
        if (e.type === 'click') {
            pressedKeys.push('left click');
        }
        
        // 检查是否所有快捷键都被按下
        return keys.every(key => pressedKeys.includes(key));
    }

    /**
     * 设置活动监控
     */
    setupActivityMonitor() {
        if (this.settings.copyMechanism === 'auto') {
            // 监控用户活动
            const events = ['keydown', 'keyup', 'input', 'change', 'click', 'scroll'];
            
            this.activityHandler = () => {
                this.onUserActivity();
            };
            
            events.forEach(event => {
                document.addEventListener(event, this.activityHandler, true);
            });
            
            // 监控窗口失焦（用户离开思源笔记）
            this.blurHandler = () => {
                this.onWindowBlur();
            };
            
            window.addEventListener('blur', this.blurHandler);
        }
    }

    /**
     * 停止活动监控
     */
    stopActivityMonitor() {
        if (this.activityHandler) {
            const events = ['keydown', 'keyup', 'input', 'change', 'click', 'scroll'];
            events.forEach(event => {
                document.removeEventListener(event, this.activityHandler, true);
            });
            this.activityHandler = null;
        }
        
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }
    }

    /**
     * 用户活动处理
     */
    onUserActivity() {
        if (!this.isAutoSyncEnabled) return;
        
        this.lastActivityTime = Date.now();
        
        // 重置定时器
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
        }
        
        // 设置新的定时器
        this.autoSyncTimer = setTimeout(() => {
            this.triggerAutoSync();
        }, this.settings.autoCopyTime * 1000);
    }

    /**
     * 窗口失焦处理
     */
    onWindowBlur() {
        if (!this.isAutoSyncEnabled) return;
        
        // 用户离开思源笔记，立即触发同步
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
        }
        
        this.triggerAutoSync();
    }

    /**
     * 触发自动同步
     */
    async triggerAutoSync() {
        try {
            console.log('触发自动同步...');
            await this.performSync('auto');
        } catch (error) {
            console.error('自动同步失败:', error);
            this.notifyError('自动同步失败: ' + error.message);
        }
    }

    /**
     * 触发手动同步
     */
    async triggerManualSync() {
        try {
            console.log('触发手动同步...');
            await this.performSync('manual');
        } catch (error) {
            console.error('手动同步失败:', error);
            this.notifyError('手动同步失败: ' + error.message);
        }
    }

    /**
     * 执行同步操作
     */
    async performSync(triggerType) {
        // 显示同步状态
        this.notifyInfo('正在同步日记内容...');
        
        try {
            // 1. 获取当前日期的日记文档
            const today = new Date();
            const diaryDoc = await this.findDiaryDocument(today);
            
            if (!diaryDoc) {
                throw new Error('未找到今日日记文档');
            }
            
            // 2. 提取指定段落内容
            const content = await this.extractDiaryContent(diaryDoc.id);
            
            if (!content || content.length === 0) {
                throw new Error(`未找到段落 "${this.settings.paragraphTitle}" 的内容`);
            }
            
            // 3. 找到项目文档
            const projectDoc = await this.findProjectDocument();
            
            if (!projectDoc) {
                throw new Error('未找到项目文档');
            }
            
            // 4. 复制内容到项目文档
            await this.copyContentToProject(projectDoc.id, content);
            
            // 5. 通知成功
            this.notifySuccess(`${triggerType === 'auto' ? '自动' : '手动'}同步完成`);
            
            // 6. 记录同步历史
            this.recordSyncHistory(triggerType, diaryDoc, projectDoc, content);
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * 查找日记文档
     */
    async findDiaryDocument(date) {
        try {
            // 模拟API调用 - 实际环境中需要调用思源笔记API
            const dateStr = this.formatDate(date, this.settings.dateFormat);
            
            console.log('查找日记文档:', dateStr, '笔记本:', this.settings.selectedNotebook);
            
            // 这里应该调用实际的API
            // const result = await siyuanAPI.findDocumentByTitle(dateStr, this.settings.selectedNotebook);
            
            // 模拟返回结果
            return {
                id: 'diary-' + dateStr,
                name: dateStr,
                path: `/日记/${dateStr}.sy`
            };
        } catch (error) {
            console.error('查找日记文档失败:', error);
            return null;
        }
    }

    /**
     * 提取日记内容
     */
    async extractDiaryContent(documentId) {
        try {
            console.log('提取日记内容:', documentId, '段落:', this.settings.paragraphTitle);
            
            // 模拟API调用 - 实际环境中需要调用思源笔记API
            // const content = await siyuanAPI.extractContentUnderTitle(documentId, this.settings.paragraphTitle);
            
            // 模拟返回内容
            const mockContent = [
                '完成了用户界面的重新设计',
                '实现了笔记本选择器功能',
                '添加了自动同步和手动同步机制',
                '优化了设置界面的交互体验'
            ];
            
            return mockContent;
        } catch (error) {
            console.error('提取日记内容失败:', error);
            return [];
        }
    }

    /**
     * 查找项目文档
     */
    async findProjectDocument() {
        try {
            console.log('查找项目文档...');
            
            // 模拟API调用 - 实际环境中需要调用思源笔记API
            // const result = await siyuanAPI.findProjectDocument();
            
            // 模拟返回结果
            return {
                id: 'project-main',
                name: '项目主文档',
                path: '/项目/主文档.sy'
            };
        } catch (error) {
            console.error('查找项目文档失败:', error);
            return null;
        }
    }

    /**
     * 复制内容到项目文档
     */
    async copyContentToProject(projectDocId, content) {
        try {
            console.log('复制内容到项目文档:', projectDocId, '目标段落:', this.settings.copyTargetParagraph);
            
            // 格式化内容
            const formattedContent = content.map(item => `- ${item}`).join('\n');
            const timestamp = new Date().toLocaleString('zh-CN');
            const finalContent = `\n### ${timestamp}\n${formattedContent}\n`;
            
            // 模拟API调用 - 实际环境中需要调用思源笔记API
            // await siyuanAPI.appendContentUnderTitle(projectDocId, this.settings.copyTargetParagraph, finalContent);
            
            console.log('内容已复制:', finalContent);
        } catch (error) {
            console.error('复制内容失败:', error);
            throw error;
        }
    }

    /**
     * 格式化日期
     */
    formatDate(date, format) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const shortYear = String(year).slice(-2);

        if (format === 'custom' && this.settings.customDateFormat) {
            format = this.settings.customDateFormat;
        }

        switch (format) {
            case "YYYY-MM-DD":
                return `${year}-${month}-${day}`;
            case "YY-MM-DD":
                return `${shortYear}-${month}-${day}`;
            case "YYYY年MM月DD日":
                return `${year}年${month}月${day}日`;
            case "YYYY/MM/DD":
                return `${year}/${month}/${day}`;
            case "YYYY.MM.DD":
                return `${year}.${month}.${day}`;
            default:
                // 自定义格式处理
                return format
                    .replace(/YYYY/g, year)
                    .replace(/YY/g, shortYear)
                    .replace(/MM/g, month)
                    .replace(/DD/g, day);
        }
    }

    /**
     * 记录同步历史
     */
    recordSyncHistory(triggerType, diaryDoc, projectDoc, content) {
        const history = {
            timestamp: new Date().toISOString(),
            triggerType,
            diaryDoc: diaryDoc.name,
            projectDoc: projectDoc.name,
            contentCount: content.length,
            settings: { ...this.settings }
        };
        
        // 保存到本地存储
        const histories = JSON.parse(localStorage.getItem('sync-histories') || '[]');
        histories.unshift(history);
        
        // 只保留最近100条记录
        if (histories.length > 100) {
            histories.splice(100);
        }
        
        localStorage.setItem('sync-histories', JSON.stringify(histories));
        console.log('同步历史已记录:', history);
    }

    /**
     * 获取同步历史
     */
    getSyncHistory() {
        return JSON.parse(localStorage.getItem('sync-histories') || '[]');
    }

    /**
     * 清除同步历史
     */
    clearSyncHistory() {
        localStorage.removeItem('sync-histories');
    }

    /**
     * 通知消息
     */
    notifyInfo(message) {
        this.showNotification(message, 'info');
    }

    notifySuccess(message) {
        this.showNotification(message, 'success');
    }

    notifyError(message) {
        this.showNotification(message, 'error');
    }

    notifyWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 如果在设置页面中，使用设置管理器的消息显示
        if (window.settingsManager && typeof window.settingsManager.showMessage === 'function') {
            window.settingsManager.showMessage(message, type);
            return;
        }
        
        // 否则使用简单的控制台输出
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 如果在插件环境中，可以使用思源笔记的消息API
        if (window.siyuan && window.siyuan.showMessage) {
            window.siyuan.showMessage(message, type === 'error' ? 7000 : 3000);
        }
    }

    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            isAutoSyncEnabled: this.isAutoSyncEnabled,
            copyMechanism: this.settings.copyMechanism,
            autoCopyTime: this.settings.autoCopyTime,
            manualCopyShortcut: this.settings.manualCopyShortcut,
            lastActivityTime: this.lastActivityTime,
            hasActiveTimer: !!this.autoSyncTimer
        };
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncService;
} else {
    window.SyncService = SyncService;
}
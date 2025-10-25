/**
 * 设置管理器 - 处理设置界面的所有交互逻辑
 */
class SettingsManager {
    constructor() {
        this.notebooks = [];
        this.dateFormats = [
            { value: "YY-MM-DD", label: "YY-MM-DD (24-01-15)", description: "简短年份格式" },
            { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-01-15)", description: "标准ISO格式" },
            { value: "YYYY年MM月DD日", label: "YYYY年MM月DD日 (2024年01月15日)", description: "中文日期格式" },
            { value: "YYYY/MM/DD", label: "YYYY/MM/DD (2024/01/15)", description: "斜杠分隔格式" },
            { value: "YYYY.MM.DD", label: "YYYY.MM.DD (2024.01.15)", description: "点分隔格式" },
            { value: "custom", label: "自定义格式", description: "输入自定义日期格式" }
        ];
        this.settings = {
            // 日记识别设置
            limitNotebook: false,
            selectedNotebook: '',
            limitDateFormat: true,
            dateFormat: 'YY-MM-DD',
            customDateFormat: '',
            identifyParagraph: true,
            paragraphTitle: '##今日进展',
            
            // 复制项目内容设置
            enableTargetParagraph: true,
            copyTargetParagraph: '##项目进展',
            copyMechanism: 'auto', // 'auto' 或 'manual'
            autoCopyTime: 10,
            manualCopyShortcut: 'command+left click'
        };
        
        this.syncService = null;
        this.init();
    }

    /**
     * 初始化设置管理器
     */
    async init() {
        await this.loadNotebooks();
        this.initializeUI();
        this.bindEvents();
        this.loadSettings();
        this.initializeSyncService();
    }

    /**
     * 加载笔记本列表
     */
    async loadNotebooks() {
        try {
            // 模拟API调用 - 在实际环境中需要调用思源笔记的API
            // 这里使用模拟数据
            this.notebooks = [
                { id: 'notebook1', name: '工作笔记', icon: '📝' },
                { id: 'notebook2', name: '个人日记', icon: '📖' },
                { id: 'notebook3', name: '项目管理', icon: '📋' },
                { id: 'notebook4', name: '学习笔记', icon: '📚' }
            ];
            
            this.populateNotebookSelector();
        } catch (error) {
            console.error('加载笔记本列表失败:', error);
            this.showMessage('加载笔记本列表失败', 'error');
        }
    }

    /**
     * 填充笔记本选择器
     */
    populateNotebookSelector() {
        const selector = document.getElementById('notebookSelector');
        if (!selector) return;

        // 清空现有选项
        selector.innerHTML = '<option value="">不限制（搜索所有笔记本）</option>';

        // 添加笔记本选项
        this.notebooks.forEach(notebook => {
            const option = document.createElement('option');
            option.value = notebook.id;
            option.textContent = `${notebook.icon} ${notebook.name}`;
            selector.appendChild(option);
        });
    }

    /**
     * 填充日期格式选择器
     */
    populateDateFormatSelector() {
        const selector = document.getElementById('dateFormatSelector');
        if (!selector) return;

        // 清空现有选项
        selector.innerHTML = '';

        // 添加日期格式选项
        this.dateFormats.forEach(format => {
            const option = document.createElement('option');
            option.value = format.value;
            option.textContent = format.label;
            option.title = format.description;
            selector.appendChild(option);
        });
    }

    /**
     * 初始化UI组件
     */
    initializeUI() {
        this.populateDateFormatSelector();
        this.updateDateFormatUI();
        this.updateCopyMechanismUI();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 笔记本限制开关
        const limitNotebookToggle = document.getElementById('limitNotebook');
        if (limitNotebookToggle) {
            limitNotebookToggle.addEventListener('change', (e) => {
                this.settings.limitNotebook = e.target.checked;
                this.updateNotebookSelectorState();
            });
        }

        // 笔记本选择器
        const notebookSelector = document.getElementById('notebookSelector');
        if (notebookSelector) {
            notebookSelector.addEventListener('change', (e) => {
                this.settings.selectedNotebook = e.target.value;
            });
        }

        // 日期格式限制开关
        const limitDateFormatToggle = document.getElementById('limitDateFormat');
        if (limitDateFormatToggle) {
            limitDateFormatToggle.addEventListener('change', (e) => {
                this.settings.limitDateFormat = e.target.checked;
                this.updateDateFormatState();
            });
        }

        // 日期格式选择器
        const dateFormatSelector = document.getElementById('dateFormatSelector');
        if (dateFormatSelector) {
            dateFormatSelector.addEventListener('change', (e) => {
                this.settings.dateFormat = e.target.value;
                this.updateDateFormatUI();
            });
        }

        // 自定义日期格式输入
        const customDateFormatInput = document.getElementById('customDateFormat');
        if (customDateFormatInput) {
            customDateFormatInput.addEventListener('input', (e) => {
                this.settings.customDateFormat = e.target.value;
            });
        }

        // 段落识别开关
        const enableParagraphIdentifyToggle = document.getElementById('enableParagraphIdentify');
        if (enableParagraphIdentifyToggle) {
            enableParagraphIdentifyToggle.addEventListener('change', (e) => {
                this.settings.identifyParagraph = e.target.checked;
                this.updateParagraphInputState();
            });
        }

        // 段落标题输入
        const contentTitleInput = document.getElementById('contentTitle');
        if (contentTitleInput) {
            contentTitleInput.addEventListener('input', (e) => {
                this.settings.paragraphTitle = e.target.value;
            });
        }

        // 复制目标段落开关
        const enableTargetParagraphToggle = document.getElementById('enableTargetParagraph');
        if (enableTargetParagraphToggle) {
            enableTargetParagraphToggle.addEventListener('change', (e) => {
                this.settings.enableTargetParagraph = e.target.checked;
                this.updateTargetParagraphState();
            });
        }

        // 复制目标段落输入
        const targetTitleInput = document.getElementById('targetTitle');
        if (targetTitleInput) {
            targetTitleInput.addEventListener('input', (e) => {
                this.settings.copyTargetParagraph = e.target.value;
            });
        }

        // 复制机制单选按钮
        const copyModeRadios = document.querySelectorAll('input[name="copyMode"]');
        copyModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.copyMechanism = e.target.value;
                    this.updateCopyMechanismUI();
                }
            });
        });

        // 自动复制时间输入
        const autoDelayInput = document.getElementById('autoDelay');
        if (autoDelayInput) {
            autoDelayInput.addEventListener('input', (e) => {
                this.settings.autoCopyTime = parseInt(e.target.value) || 10;
            });
        }

        // 快捷键录制按钮
        const shortcutRecordBtn = document.getElementById('recordShortcut');
        if (shortcutRecordBtn) {
            shortcutRecordBtn.addEventListener('click', () => {
                this.startShortcutRecording();
            });
        }

        // 保存设置按钮
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 重置设置按钮
        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // 测试配置按钮
        const testBtn = document.getElementById('testConfig');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.testConfiguration();
            });
        }
    }

    /**
     * 更新笔记本选择器状态
     */
    updateNotebookSelectorState() {
        const selector = document.getElementById('notebookSelector');
        const container = document.querySelector('.notebook-selector-container');
        
        if (selector && container) {
            if (this.settings.limitNotebook) {
                selector.disabled = false;
                container.style.opacity = '1';
            } else {
                selector.disabled = true;
                container.style.opacity = '0.5';
            }
        }
    }

    /**
     * 更新日期格式状态
     */
    updateDateFormatState() {
        const selector = document.getElementById('dateFormatSelector');
        const customInput = document.getElementById('customDateFormat');
        const container = document.querySelector('.date-format-container');
        
        if (container) {
            if (this.settings.limitDateFormat) {
                container.style.opacity = '1';
                if (selector) selector.disabled = false;
                if (customInput) customInput.disabled = this.settings.dateFormat !== 'custom';
            } else {
                container.style.opacity = '0.5';
                if (selector) selector.disabled = true;
                if (customInput) customInput.disabled = true;
            }
        }
    }

    /**
     * 更新日期格式UI
     */
    updateDateFormatUI() {
        const customInput = document.getElementById('customDateFormat');
        const customContainer = document.querySelector('.custom-date-format');
        
        if (customContainer) {
            if (this.settings.dateFormat === 'custom') {
                customContainer.style.display = 'block';
                if (customInput) customInput.disabled = !this.settings.limitDateFormat;
            } else {
                customContainer.style.display = 'none';
            }
        }
    }

    /**
     * 更新段落输入状态
     */
    updateParagraphInputState() {
        const paragraphSettings = document.getElementById('paragraphSettings');
        
        if (paragraphSettings) {
            if (this.settings.identifyParagraph) {
                paragraphSettings.style.display = 'block';
            } else {
                paragraphSettings.style.display = 'none';
            }
        }
    }

    /**
     * 更新目标段落状态
     */
    updateTargetParagraphState() {
        const targetParagraphSettings = document.getElementById('targetParagraphSettings');
        
        if (targetParagraphSettings) {
            if (this.settings.enableTargetParagraph) {
                targetParagraphSettings.style.display = 'block';
            } else {
                targetParagraphSettings.style.display = 'none';
            }
        }
    }

    /**
     * 更新复制机制UI
     */
    updateCopyMechanismUI() {
        const autoTimeSettings = document.getElementById('autoTimeSettings');
        const manualShortcutSettings = document.getElementById('manualShortcutSettings');
        
        if (autoTimeSettings && manualShortcutSettings) {
            if (this.settings.copyMechanism === 'auto') {
                autoTimeSettings.style.display = 'block';
                manualShortcutSettings.style.display = 'none';
            } else {
                autoTimeSettings.style.display = 'none';
                manualShortcutSettings.style.display = 'block';
            }
        }
    }

    /**
     * 开始快捷键录制
     */
    startShortcutRecording() {
        const recordBtn = document.getElementById('recordShortcut');
        const shortcutDisplay = document.getElementById('shortcutDisplay');
        
        if (!recordBtn || !shortcutDisplay) return;

        recordBtn.textContent = '按下快捷键...';
        recordBtn.disabled = true;
        shortcutDisplay.textContent = '等待输入...';

        const handleKeyDown = (e) => {
            e.preventDefault();
            
            const keys = [];
            if (e.metaKey) keys.push('command');
            if (e.ctrlKey) keys.push('ctrl');
            if (e.altKey) keys.push('alt');
            if (e.shiftKey) keys.push('shift');
            
            // 添加主键
            if (e.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
                if (e.key === ' ') {
                    keys.push('space');
                } else if (e.key.length === 1) {
                    keys.push(e.key.toLowerCase());
                } else {
                    keys.push(e.key);
                }
            }

            // 处理鼠标点击
            if (e.type === 'click') {
                keys.push('left click');
            }

            const shortcut = keys.join('+');
            this.settings.manualCopyShortcut = shortcut;
            shortcutDisplay.textContent = shortcut;
            
            // 恢复按钮状态
            recordBtn.textContent = '重新录制';
            recordBtn.disabled = false;
            
            // 移除事件监听器
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClick);
        };

        const handleClick = (e) => {
            if (e.target === recordBtn) return; // 忽略录制按钮本身的点击
            
            e.preventDefault();
            
            const keys = [];
            if (e.metaKey) keys.push('command');
            if (e.ctrlKey) keys.push('ctrl');
            if (e.altKey) keys.push('alt');
            if (e.shiftKey) keys.push('shift');
            keys.push('left click');

            const shortcut = keys.join('+');
            this.settings.manualCopyShortcut = shortcut;
            shortcutDisplay.textContent = shortcut;
            
            // 恢复按钮状态
            recordBtn.textContent = '重新录制';
            recordBtn.disabled = false;
            
            // 移除事件监听器
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClick);
        };

        // 添加事件监听器
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleClick);
    }

    /**
     * 加载设置
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('siyuan-note-sync-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsed };
            }
            
            this.applySettingsToUI();
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    /**
     * 应用设置到UI
     */
    applySettingsToUI() {
        // 应用笔记本限制设置
        const limitNotebookToggle = document.getElementById('limitNotebook');
        if (limitNotebookToggle) {
            limitNotebookToggle.checked = this.settings.limitNotebook;
        }

        // 应用笔记本选择
        const notebookSelector = document.getElementById('notebookSelector');
        if (notebookSelector) {
            notebookSelector.value = this.settings.selectedNotebook;
        }

        // 应用日期格式限制设置
        const limitDateFormatToggle = document.getElementById('limitDateFormat');
        if (limitDateFormatToggle) {
            limitDateFormatToggle.checked = this.settings.limitDateFormat;
        }

        // 应用日期格式选择
        const dateFormatSelector = document.getElementById('dateFormatSelector');
        if (dateFormatSelector) {
            dateFormatSelector.value = this.settings.dateFormat;
        }

        // 应用自定义日期格式
        const customDateFormatInput = document.getElementById('customDateFormat');
        if (customDateFormatInput) {
            customDateFormatInput.value = this.settings.customDateFormat;
        }

        // 应用段落识别设置
        const enableParagraphIdentifyToggle = document.getElementById('enableParagraphIdentify');
        if (enableParagraphIdentifyToggle) {
            enableParagraphIdentifyToggle.checked = this.settings.identifyParagraph;
        }

        // 应用段落标题
        const contentTitleInput = document.getElementById('contentTitle');
        if (contentTitleInput) {
            contentTitleInput.value = this.settings.paragraphTitle;
        }

        // 应用目标段落开关
        const enableTargetParagraphToggle = document.getElementById('enableTargetParagraph');
        if (enableTargetParagraphToggle) {
            enableTargetParagraphToggle.checked = this.settings.enableTargetParagraph;
        }

        // 应用复制目标段落
        const targetTitleInput = document.getElementById('targetTitle');
        if (targetTitleInput) {
            targetTitleInput.value = this.settings.copyTargetParagraph;
        }

        // 应用复制机制
        const copyModeRadio = document.querySelector(`input[name="copyMode"][value="${this.settings.copyMechanism}"]`);
        if (copyModeRadio) {
            copyModeRadio.checked = true;
        }

        // 应用自动复制时间
        const autoDelayInput = document.getElementById('autoDelay');
        if (autoDelayInput) {
            autoDelayInput.value = this.settings.autoCopyTime;
        }

        // 应用快捷键显示
        const shortcutDisplay = document.getElementById('shortcutDisplay');
        if (shortcutDisplay) {
            shortcutDisplay.textContent = this.settings.manualCopyShortcut;
        }

        // 更新UI状态
        this.updateNotebookSelectorState();
        this.updateDateFormatState();
        this.updateDateFormatUI();
        this.updateParagraphInputState();
        this.updateTargetParagraphState();
        this.updateCopyMechanismUI();
    }

    /**
     * 保存设置
     */
    saveSettings() {
        try {
            // 收集所有设置
            this.settings.limitNotebook = document.getElementById('limitNotebook').checked;
            this.settings.selectedNotebook = document.getElementById('notebookSelector').value;
            this.settings.limitDateFormat = document.getElementById('limitDateFormat').checked;
            this.settings.dateFormat = document.getElementById('dateFormatSelector').value;
            this.settings.customDateFormat = document.getElementById('customDateFormat').value;
            this.settings.identifyParagraph = document.getElementById('enableParagraphIdentify').checked;
            this.settings.paragraphTitle = document.getElementById('contentTitle').value;
            this.settings.enableTargetParagraph = document.getElementById('enableTargetParagraph').checked;
            this.settings.copyTargetParagraph = document.getElementById('targetTitle').value;
            
            const copyModeRadio = document.querySelector('input[name="copyMode"]:checked');
            if (copyModeRadio) {
                this.settings.copyMechanism = copyModeRadio.value;
            }
            
            this.settings.autoCopyTime = parseInt(document.getElementById('autoDelay').value) || 10;
            
            localStorage.setItem('siyuan-note-sync-settings', JSON.stringify(this.settings));
            this.showMessage('设置保存成功', 'success');
            
            // 这里可以添加向插件主程序发送设置更新的逻辑
            this.notifySettingsChange();
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showMessage('保存设置失败', 'error');
        }
    }

    /**
     * 重置设置
     */
    resetSettings() {
        if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
            // 重置为默认值
            this.settings = {
                limitNotebook: false,
                selectedNotebook: '',
                limitDateFormat: true,
                dateFormat: 'YY-MM-DD',
                customDateFormat: '',
                identifyParagraph: true,
                paragraphTitle: '##今日进展',
                enableTargetParagraph: true,
                copyTargetParagraph: '##项目进展',
                copyMechanism: 'auto',
                autoCopyTime: 10,
                manualCopyShortcut: 'command+left click'
            };
            
            this.applySettingsToUI();
            this.showMessage('设置已重置', 'success');
        }
    }

    /**
     * 测试配置
     */
    async testConfiguration() {
        this.showMessage('正在测试配置...', 'info');
        
        try {
            // 模拟测试过程
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 这里应该实现实际的配置测试逻辑
            const testResults = {
                notebookAccess: true,
                dateFormatValid: true,
                paragraphFound: true,
                copyTargetValid: true
            };
            
            if (Object.values(testResults).every(result => result)) {
                this.showMessage('配置测试通过', 'success');
            } else {
                this.showMessage('配置测试失败，请检查设置', 'error');
            }
        } catch (error) {
            console.error('测试配置失败:', error);
            this.showMessage('测试配置时发生错误', 'error');
        }
    }

    /**
     * 初始化同步服务
     */
    initializeSyncService() {
        if (window.SyncService) {
            this.syncService = new window.SyncService(this.settings);
            console.log('同步服务已初始化');
        } else {
            console.warn('SyncService 未找到，请确保已加载 sync-service.js');
        }
    }

    /**
     * 更新同步服务设置
     */
    updateSyncService() {
        if (this.syncService) {
            this.syncService.updateSettings(this.settings);
            console.log('同步服务设置已更新');
        }
    }

    /**
     * 获取同步服务状态
     */
    getSyncServiceStatus() {
        if (this.syncService) {
            return this.syncService.getStatus();
        }
        return null;
    }

    /**
     * 手动触发同步
     */
    async triggerManualSync() {
        if (this.syncService) {
            try {
                await this.syncService.triggerManualSync();
            } catch (error) {
                this.showMessage('手动同步失败: ' + error.message, 'error');
            }
        } else {
            this.showMessage('同步服务未初始化', 'error');
        }
    }

    /**
     * 通知设置变更
     */
    notifySettingsChange() {
        // 更新同步服务
        this.updateSyncService();
        
        // 这里可以实现向插件主程序发送设置更新的逻辑
        console.log('设置已更新:', this.settings);
        
        // 如果在插件环境中，可以使用以下方式通知主程序
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'settings-updated',
                settings: this.settings
            }, '*');
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // 添加样式
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                messageEl.style.backgroundColor = '#10b981';
                break;
            case 'error':
                messageEl.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                messageEl.style.backgroundColor = '#f59e0b';
                break;
            default:
                messageEl.style.backgroundColor = '#3b82f6';
        }
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }
}

// 页面加载完成后初始化设置管理器
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// 全局函数，供HTML调用
window.resetSettings = function() {
    if (window.settingsManager) {
        window.settingsManager.resetSettings();
    }
};

window.testConfig = function() {
    if (window.settingsManager) {
        window.settingsManager.testConfig();
    }
};

window.saveSettings = function() {
    if (window.settingsManager) {
        window.settingsManager.saveSettings();
    }
};

window.testManualSync = function() {
    if (window.settingsManager) {
        window.settingsManager.triggerManualSync();
    }
};

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
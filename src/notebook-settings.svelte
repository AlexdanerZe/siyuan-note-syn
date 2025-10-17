<script lang="ts">
    import { showMessage } from "siyuan";
    import { NotebookService, type NotebookInfo, type DateFormatConfig } from "./notebook-service";
    import { onMount } from "svelte";

    export let plugin: any;
    export let config: any;

    // 笔记本相关状态
    let notebooks: NotebookInfo[] = [];
    let notebookService: NotebookService;
    let dateFormats: DateFormatConfig[] = [];

    // 配置状态
    let selectedNotebookId = config.selectedNotebookId || "";
    let selectedNotebookName = config.selectedNotebookName || "";
    let dateFormat = config.dateFormat || "YYYY-MM-DD";
    let contentTitle = config.contentTitle || "今日进展";
    let onlyLeafDocuments = config.onlyLeafDocuments || false;
    let enableNotebookLimitation = config.enableNotebookLimitation || false;

    // UI状态
    let activeTab = "notebook";
    let isLoading = false;

    onMount(async () => {
        // 初始化笔记本服务
        notebookService = new NotebookService({
            selectedNotebookId,
            selectedNotebookName,
            dateFormat,
            contentTitle,
            onlyLeafDocuments
        });

        // 获取笔记本列表
        try {
            isLoading = true;
            notebooks = await notebookService.getNotebooks();
            dateFormats = notebookService.getSupportedDateFormats();
        } catch (error) {
            console.error("获取笔记本列表失败:", error);
            showMessage("获取笔记本列表失败", 3000);
        } finally {
            isLoading = false;
        }
    });

    // 保存配置
    async function saveConfig() {
        try {
            isLoading = true;
            
            // 更新配置对象
            config.selectedNotebookId = selectedNotebookId;
            config.selectedNotebookName = selectedNotebookName;
            config.dateFormat = dateFormat;
            config.contentTitle = contentTitle;
            config.onlyLeafDocuments = onlyLeafDocuments;
            config.enableNotebookLimitation = enableNotebookLimitation;

            // 更新笔记本服务配置
            if (notebookService) {
                notebookService.updateConfig(config);
            }

            // 保存配置到插件
            if (plugin && plugin.saveData) {
                await plugin.saveData("sync-config", config);
            }

            showMessage("设置已保存", 2000);
        } catch (error) {
            console.error("保存配置失败:", error);
            showMessage("保存配置失败", 3000);
        } finally {
            isLoading = false;
        }
    }

    // 测试配置
    async function testConfig() {
        try {
            isLoading = true;
            showMessage("正在测试配置...", 2000);
            
            // 这里可以添加测试逻辑
            if (notebookService) {
                const testResult = await notebookService.getNotebooks();
                showMessage(`测试成功！找到 ${testResult.length} 个笔记本`, 2000);
            }
        } catch (error) {
            console.error("测试配置失败:", error);
            showMessage("测试配置失败", 3000);
        } finally {
            isLoading = false;
        }
    }

    // 重置配置
    function resetConfig() {
        selectedNotebookId = "";
        selectedNotebookName = "";
        dateFormat = "YYYY-MM-DD";
        contentTitle = "今日进展";
        onlyLeafDocuments = false;
        enableNotebookLimitation = false;
        showMessage("配置已重置", 2000);
    }

    // 笔记本选择变化
    function onNotebookChange() {
        const selectedNotebook = notebooks.find(nb => nb.id === selectedNotebookId);
        selectedNotebookName = selectedNotebook ? selectedNotebook.name : "";
    }
</script>

<div class="settings-container">
    <div class="settings-header">
        <h2>📚 项目进展同步设置</h2>
        <p>配置笔记本限制、日期格式和内容提取功能</p>
    </div>

    <!-- 标签页导航 -->
    <div class="tab-nav">
        <button 
            class="tab-button" 
            class:active={activeTab === "notebook"}
            on:click={() => activeTab = "notebook"}
        >
            📚 笔记本设置
        </button>
        <button 
            class="tab-button" 
            class:active={activeTab === "date"}
            on:click={() => activeTab = "date"}
        >
            📅 日期格式
        </button>
        <button 
            class="tab-button" 
            class:active={activeTab === "content"}
            on:click={() => activeTab = "content"}
        >
            🔍 内容提取
        </button>
    </div>

    <!-- 设置内容 -->
    <div class="settings-content">
        {#if isLoading}
            <div class="loading">正在加载...</div>
        {:else}
            <!-- 笔记本设置 -->
            {#if activeTab === "notebook"}
                <div class="setting-group">
                    <h3>📚 笔记本限制设置</h3>
                    <p class="description">选择特定笔记本进行同步，或留空使用路径匹配</p>
                    
                    <div class="form-item">
                        <label>
                            <input 
                                type="checkbox" 
                                bind:checked={enableNotebookLimitation}
                                class="form-checkbox"
                            />
                            启用笔记本限制功能
                        </label>
                    </div>

                    <div class="form-item">
                        <label for="notebook-select">选择笔记本：</label>
                        <select 
                            id="notebook-select" 
                            bind:value={selectedNotebookId}
                            on:change={onNotebookChange}
                            class="form-control"
                            disabled={!enableNotebookLimitation}
                        >
                            <option value="">不限制（使用路径匹配）</option>
                            {#each notebooks as notebook}
                                <option value={notebook.id}>{notebook.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="form-item">
                        <label>
                            <input 
                                type="checkbox" 
                                bind:checked={onlyLeafDocuments}
                                class="form-checkbox"
                                disabled={!enableNotebookLimitation}
                            />
                            仅搜索叶子文档（没有子文档的文档）
                        </label>
                    </div>

                    {#if selectedNotebookName}
                        <div class="info-box">
                            <strong>已选择：</strong> {selectedNotebookName}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- 日期格式设置 -->
            {#if activeTab === "date"}
                <div class="setting-group">
                    <h3>📅 日期格式设置</h3>
                    <p class="description">选择日期格式，用于识别和生成日记文档</p>
                    
                    <div class="form-item">
                        <label for="date-format">日期格式：</label>
                        <select 
                            id="date-format" 
                            bind:value={dateFormat}
                            class="form-control"
                        >
                            {#each dateFormats as format}
                                <option value={format.format}>{format.name} - {format.example}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="info-box">
                        <strong>当前格式预览：</strong> {dateFormat}
                        <br>
                        <strong>示例：</strong> {new Date().toISOString().split('T')[0].replace(/-/g, dateFormat.includes('MM') ? '-' : '')}
                    </div>
                </div>
            {/if}

            <!-- 内容提取设置 -->
            {#if activeTab === "content"}
                <div class="setting-group">
                    <h3>🔍 内容提取设置</h3>
                    <p class="description">配置要提取的内容标题和规则</p>
                    
                    <div class="form-item">
                        <label for="content-title">内容标题：</label>
                        <input 
                            id="content-title" 
                            type="text" 
                            bind:value={contentTitle}
                            placeholder="例如：今日进展、工作总结"
                            class="form-control"
                        />
                    </div>

                    <div class="info-box">
                        <strong>说明：</strong> 系统将搜索包含此标题的内容块进行提取
                    </div>
                </div>
            {/if}
        {/if}
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
        <button 
            class="btn btn-primary" 
            on:click={saveConfig}
            disabled={isLoading}
        >
            💾 保存设置
        </button>
        <button 
            class="btn btn-secondary" 
            on:click={testConfig}
            disabled={isLoading}
        >
            🧪 测试配置
        </button>
        <button 
            class="btn btn-warning" 
            on:click={resetConfig}
            disabled={isLoading}
        >
            🔄 重置配置
        </button>
    </div>
</div>

<style>
    .settings-container {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .settings-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e0e0e0;
    }

    .settings-header h2 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 24px;
    }

    .settings-header p {
        margin: 0;
        color: #666;
        font-size: 14px;
    }

    .tab-nav {
        display: flex;
        margin-bottom: 20px;
        border-bottom: 1px solid #e0e0e0;
    }

    .tab-button {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 14px;
        color: #666;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
    }

    .tab-button:hover {
        background-color: #f5f5f5;
        color: #333;
    }

    .tab-button.active {
        color: #007acc;
        border-bottom-color: #007acc;
        background-color: #f8f9fa;
    }

    .settings-content {
        min-height: 300px;
        padding: 20px 0;
    }

    .setting-group {
        margin-bottom: 30px;
    }

    .setting-group h3 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 18px;
    }

    .description {
        margin: 0 0 20px 0;
        color: #666;
        font-size: 14px;
        line-height: 1.4;
    }

    .form-item {
        margin-bottom: 15px;
    }

    .form-item label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    }

    .form-control {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.2s;
    }

    .form-control:focus {
        outline: none;
        border-color: #007acc;
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
    }

    .form-checkbox {
        margin-right: 8px;
    }

    .info-box {
        padding: 12px;
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        font-size: 14px;
        color: #495057;
        margin-top: 10px;
    }

    .loading {
        text-align: center;
        padding: 40px;
        color: #666;
        font-size: 16px;
    }

    .action-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
        margin-top: 30px;
    }

    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        min-width: 120px;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background-color: #007acc;
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #005a9e;
    }

    .btn-secondary {
        background-color: #6c757d;
        color: white;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #545b62;
    }

    .btn-warning {
        background-color: #ffc107;
        color: #212529;
    }

    .btn-warning:hover:not(:disabled) {
        background-color: #e0a800;
    }
</style>
<script lang="ts">
    import { showMessage } from "siyuan";
    import { NotebookService, type NotebookInfo, type DateFormatConfig } from "./notebook-service";
    import { onMount } from "svelte";

    export let plugin: any;
    export let config: any;
    export let syncService: any;
    
    // 调试：打印传入的配置
    console.log("🔍 [调试] notebook-settings.svelte 接收到的配置:", config);
    console.log("🔍 [调试] enableNotebookLimitation 原始值:", config.enableNotebookLimitation);
    console.log("🔍 [调试] selectedNotebookId 原始值:", config.selectedNotebookId);

    // 笔记本相关状态
    let notebooks: NotebookInfo[] = [];
    let notebookService: NotebookService;
    let dateFormats: DateFormatConfig[] = [];

    // 配置状态
    let selectedNotebookId = config.selectedNotebookId ?? "";
    let selectedNotebookName = config.selectedNotebookName ?? "";
    let dateFormat = config.dateFormat ?? "YYYY-MM-DD";
    let customDateFormat = config.customDateFormat ?? "";
    let contentTitle = config.contentTitle ?? "今日进展";
    let onlyLeafDocuments = config.onlyLeafDocuments ?? false;
    let enableNotebookLimitation = config.enableNotebookLimitation ?? false;
    let limitDateFormat = config.limitDateFormat ?? false;
    
    // 合并后的内容提取设置
    let enableContentExtraction = config.enableContentExtraction ?? false;
    
    // 识别标题提取设置
    let enableTitleExtraction = config.enableTitleExtraction ?? false;
    let titleExtractionPattern = config.titleExtractionPattern ?? "";
    let titleExtractionType = config.titleExtractionType ?? "h1";
    
    // 复制目标标题设置
    let enableTargetTitle = config.enableTargetTitle ?? true; // 默认启用
    let targetTitlePattern = config.targetTitlePattern ?? "## ";
    let targetTitleType = config.targetTitleType ?? "h2"; // 默认二级标题
    let targetTitleContent = config.targetTitleContent ?? "项目进展"; // 默认目标段落
    
    // 预设的识别类型选项
    const recognitionTypes = [
        { value: "h1", label: "# 一级标题", pattern: "# " },
        { value: "h2", label: "## 二级标题", pattern: "## " },
        { value: "h3", label: "### 三级标题", pattern: "### " },
        { value: "h4", label: "#### 四级标题", pattern: "#### " },
        { value: "h5", label: "##### 五级标题", pattern: "##### " },
        { value: "h6", label: "###### 六级标题", pattern: "###### " },
        { value: "ul", label: "- 无序列表", pattern: "- " },
        { value: "ul_star", label: "* 无序列表", pattern: "* " },
        { value: "ul_plus", label: "+ 无序列表", pattern: "+ " },
        { value: "ol", label: "1. 有序列表", pattern: "1. " },
        { value: "custom", label: "自定义模式", pattern: "" }
    ];
    
    // 复制机制设置 - 支持并存
    let enableManualCopy = config.enableManualCopy ?? true;
    let enableAutoCopy = config.enableAutoCopy ?? true; // 默认启用自动复制
    let autoCopyTime = config.autoCopyTime ?? 10; // 默认10秒
    let manualCopyHotkey = config.manualCopyHotkey ?? "Cmd+Shift+C"; // 默认快捷键

    // UI状态
    let activeTab = "recognition";
    let isLoading = false;
    
    // 快捷键映射状态
    let isRecordingHotkey = false;
    let recordedKeys = [];
    let hotkeyInputRef;

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

    // 键盘事件处理函数
    function startRecordingHotkey() {
        isRecordingHotkey = true;
        recordedKeys = [];
        if (hotkeyInputRef) {
            hotkeyInputRef.focus();
        }
    }

    function stopRecordingHotkey() {
        isRecordingHotkey = false;
        if (recordedKeys.length > 0) {
            manualCopyHotkey = formatHotkey(recordedKeys);
        }
        recordedKeys = [];
    }

    function handleHotkeyKeyDown(event) {
        if (!isRecordingHotkey) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const key = event.key;
        const modifiers = [];
        
        if (event.ctrlKey || event.metaKey) modifiers.push(event.ctrlKey ? 'Ctrl' : 'Cmd');
        if (event.altKey) modifiers.push('Alt');
        if (event.shiftKey) modifiers.push('Shift');
        
        // 忽略单独的修饰键
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
            return;
        }
        
        recordedKeys = [...modifiers, key.toUpperCase()];
        manualCopyHotkey = formatHotkey(recordedKeys);
        stopRecordingHotkey();
    }

    function formatHotkey(keys) {
        return keys.join('+');
    }

    function clearHotkey() {
        manualCopyHotkey = "";
        recordedKeys = [];
    }

    // 保存配置
    async function saveConfig() {
        try {
            isLoading = true;
            
            // 调试：打印保存前的值
            console.log("🔍 [调试] 保存配置前的值:");
            console.log("  - enableNotebookLimitation:", enableNotebookLimitation);
            console.log("  - selectedNotebookId:", selectedNotebookId);
            console.log("  - selectedNotebookName:", selectedNotebookName);
            
            // 更新配置对象
            config.selectedNotebookId = selectedNotebookId;
            config.selectedNotebookName = selectedNotebookName;
            config.dateFormat = dateFormat;
            config.customDateFormat = customDateFormat;
            config.contentTitle = contentTitle;
            config.onlyLeafDocuments = onlyLeafDocuments;
            config.enableNotebookLimitation = enableNotebookLimitation;
            config.limitDateFormat = limitDateFormat;
            config.enableContentExtraction = enableContentExtraction;
            config.enableTitleExtraction = enableTitleExtraction;
            config.titleExtractionPattern = titleExtractionPattern;
            config.titleExtractionType = titleExtractionType;
            config.enableTargetTitle = enableTargetTitle;
            config.targetTitlePattern = targetTitlePattern;
            config.targetTitleType = targetTitleType;
            config.targetTitleContent = targetTitleContent;
            config.enableManualCopy = enableManualCopy;
            config.enableAutoCopy = enableAutoCopy;
            config.autoCopyTime = autoCopyTime;
            config.manualCopyHotkey = manualCopyHotkey;

            // 更新笔记本服务配置
            if (notebookService) {
                notebookService.updateConfig(config);
            }

            // 更新同步服务配置
            if (syncService) {
                syncService.updateConfig(config);
                console.log("🔍 [调试] 已更新 SyncService 配置");
            }

            // 保存配置到插件
            if (plugin && plugin.saveData) {
                await plugin.saveData("sync-config", config);
                console.log("🔍 [调试] 配置已保存到插件:", config);
                console.log("🔍 [调试] 保存的 enableNotebookLimitation:", config.enableNotebookLimitation);
                console.log("🔍 [调试] 保存的 selectedNotebookId:", config.selectedNotebookId);
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
        customDateFormat = "";
        contentTitle = "今日进展";
        onlyLeafDocuments = false;
        enableNotebookLimitation = false;
        limitDateFormat = false;
        enableContentExtraction = false;
        enableTitleExtraction = false;
        titleExtractionPattern = "";
        titleExtractionType = "h1";
        enableTargetTitle = true; // 默认启用
        targetTitlePattern = "## ";
        targetTitleType = "h2"; // 默认二级标题
        targetTitleContent = "项目进展"; // 默认目标段落
        enableManualCopy = true;
        enableAutoCopy = true; // 默认启用自动复制
        autoCopyTime = 10; // 默认10秒
        manualCopyHotkey = "Cmd+Shift+C"; // 默认快捷键
        showMessage("配置已重置", 2000);
    }

    // 笔记本选择变化
    function onNotebookChange() {
        const selectedNotebook = notebooks.find(nb => nb.id === selectedNotebookId);
        selectedNotebookName = selectedNotebook ? selectedNotebook.name : "";
    }

    // 处理标题识别类型变化
    function onTitleExtractionTypeChange() {
        const selectedType = recognitionTypes.find(type => type.value === titleExtractionType);
        if (selectedType && selectedType.value !== "custom") {
            titleExtractionPattern = selectedType.pattern;
        } else if (selectedType && selectedType.value === "custom") {
            titleExtractionPattern = "";
        }
    }

    // 处理目标标题类型变化
    function onTargetTitleTypeChange() {
        const selectedType = recognitionTypes.find(type => type.value === targetTitleType);
        if (selectedType && selectedType.value !== "custom") {
            targetTitlePattern = selectedType.pattern;
        } else if (selectedType && selectedType.value === "custom") {
            targetTitlePattern = "";
        }
    }

    // 根据识别类型获取目标内容的输入提示
    function getTargetContentPlaceholder(type) {
        switch (type) {
            case 'h1':
                return "例如：项目总结、年度报告、重要公告";
            case 'h2':
                return "例如：阶段总结、月度报告、部门通知";
            case 'h3':
                return "例如：周报、小组会议、项目进展";
            case 'h4':
            case 'h5':
            case 'h6':
                return "例如：日报、任务记录、细节说明";
            case 'ul':
            case 'ul_star':
            case 'ul_plus':
                return "例如：待办事项、重要提醒、关键任务";
            case 'ol':
                return "例如：操作步骤、优先级任务、流程清单";
            case 'custom':
                return "例如：重要事项、待办任务、关键信息";
            default:
                return "输入要识别的目标内容";
        }
    }
</script>

<div class="settings-container">
    <div class="settings-header">
        <h2>📚 项目进展同步设置</h2>
        <p>配置识别设置（笔记本限制、日期格式、标题提取）和复制设置（目标标题、复制机制）</p>
    </div>

    <!-- 标签页导航 -->
    <div class="tab-nav">
        <button 
            class="tab-button" 
            class:active={activeTab === "recognition"}
            on:click={() => activeTab = "recognition"}
        >
            🔍 识别设置
        </button>
        <button 
            class="tab-button" 
            class:active={activeTab === "copy"}
            on:click={() => activeTab = "copy"}
        >
            📋 复制设置
        </button>
    </div>

    <!-- 设置内容 -->
    <div class="settings-content">
        {#if isLoading}
            <div class="loading">正在加载...</div>
        {:else}
            <!-- 识别设置 -->
            {#if activeTab === "recognition"}
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

                <!-- 日期格式设置 -->
                <div class="setting-group">
                    <h3>📅 日期格式设置</h3>
                    <p class="description">选择日期格式，用于识别和生成日记文档</p>
                    
                    <div class="form-item">
                        <label>
                            <input 
                                type="checkbox" 
                                bind:checked={limitDateFormat}
                                class="form-checkbox"
                            />
                            启用日期格式限制
                        </label>
                    </div>

                    <div class="form-item">
                        <label for="date-format">日期格式：</label>
                        <select 
                            id="date-format" 
                            bind:value={dateFormat}
                            class="form-control"
                            disabled={!limitDateFormat}
                        >
                            <option value="YY-MM-DD">YY-MM-DD (24-01-15)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</option>
                            <option value="MM-DD-YYYY">MM-DD-YYYY (01-15-2024)</option>
                            <option value="DD-MM-YYYY">DD-MM-YYYY (15-01-2024)</option>
                            <option value="YYYY/MM/DD">YYYY/MM/DD (2024/01/15)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</option>
                            <option value="custom">自定义格式</option>
                        </select>
                    </div>

                    {#if dateFormat === "custom"}
                        <div class="form-item">
                            <label for="custom-date-format">自定义日期格式：</label>
                            <input 
                                id="custom-date-format" 
                                type="text" 
                                bind:value={customDateFormat}
                                placeholder="例如：YYYY年MM月DD日"
                                class="form-control"
                                disabled={!limitDateFormat}
                            />
                        </div>
                    {/if}

                    <div class="info-box">
                        <strong>当前格式：</strong> {dateFormat === "custom" ? customDateFormat : dateFormat}
                        <br>
                        <strong>说明：</strong> {limitDateFormat ? "已启用日期格式限制，只会匹配指定格式的文档" : "未启用限制，将匹配所有日期格式"}
                    </div>
                </div>

                <!-- 标题提取设置 -->
                <div class="setting-group">
                    <h3>🔍 标题提取设置</h3>
                    <p class="description">配置标题提取功能，包括内容提取和标题识别</p>
                    
                    <div class="form-item">
                        <label>
                            <input 
                                type="checkbox" 
                                bind:checked={enableContentExtraction}
                                class="form-checkbox"
                            />
                            启用内容提取功能
                        </label>
                    </div>

                    <div class="form-item">
                        <label for="content-title">提取标题：</label>
                        <input 
                            id="content-title" 
                            type="text" 
                            bind:value={contentTitle}
                            placeholder="例如：今日进展"
                            class="form-control"
                            disabled={!enableContentExtraction}
                        />
                    </div>



                    <!-- 识别标题提取设置 -->
                    <div class="form-item">
                        <label>
                            <input 
                                type="checkbox" 
                                bind:checked={enableTitleExtraction}
                                class="form-checkbox"
                            />
                            启用识别标题提取功能
                        </label>
                    </div>

                    {#if enableTitleExtraction}
                        <div class="form-item">
                            <label for="title-extraction-type">识别类型：</label>
                            <select 
                                id="title-extraction-type" 
                                bind:value={titleExtractionType}
                                on:change={onTitleExtractionTypeChange}
                                class="form-control"
                            >
                                {#each recognitionTypes as type}
                                    <option value={type.value}>{type.label}</option>
                                {/each}
                            </select>
                        </div>

                        {#if titleExtractionType === "custom"}
                            <div class="form-item">
                                <label for="title-extraction-pattern">自定义模式：</label>
                                <input 
                                    id="title-extraction-pattern" 
                                    type="text" 
                                    bind:value={titleExtractionPattern}
                                    placeholder="例如：# 标题、## 子标题、### 小标题"
                                    class="form-control"
                                />
                            </div>
                        {/if}
                    {/if}



                    <div class="info-box">
                        <strong>说明：</strong> 
                        {#if enableContentExtraction}
                            系统将搜索包含"{contentTitle}"标题的内容块进行提取
                            {#if enableTitleExtraction}，同时识别指定模式的标题{/if}
                        {:else}
                            内容提取功能已禁用
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- 复制设置标签页 -->



             <!-- 复制设置 -->
             {#if activeTab === "copy"}
                 <!-- 复制目标标题设置 -->
                 <div class="setting-group">
                     <h3>🎯 复制目标标题设置</h3>
                     <p class="description">配置目标标题的识别和复制功能</p>
                     
                     <div class="form-item">
                         <label>
                             <input 
                                 type="checkbox" 
                                 bind:checked={enableTargetTitle}
                                 class="form-checkbox"
                             />
                             启用复制目标标题功能
                         </label>
                     </div>

                     {#if enableTargetTitle}
                         <div class="form-item">
                             <label for="target-title-type">识别类型：</label>
                             <select 
                                 id="target-title-type" 
                                 bind:value={targetTitleType}
                                 on:change={onTargetTitleTypeChange}
                                 class="form-control"
                             >
                                 {#each recognitionTypes as type}
                                     <option value={type.value}>{type.label}</option>
                                 {/each}
                             </select>
                         </div>

                         <div class="form-item">
                             <label for="target-title-content">目标内容：</label>
                             <input 
                                 id="target-title-content" 
                                 type="text" 
                                 bind:value={targetTitleContent}
                                 placeholder={getTargetContentPlaceholder(targetTitleType)}
                                 class="form-control"
                             />
                         </div>

                         {#if targetTitleType === 'custom'}
                             <div class="form-item">
                                 <label for="target-title-pattern">自定义模式：</label>
                                 <input 
                                     id="target-title-pattern" 
                                     type="text" 
                                     bind:value={targetTitlePattern}
                                     placeholder="例如：^重要.*|.*关键.*$"
                                     class="form-control"
                                 />
                             </div>
                         {/if}
                     {/if}

                     <div class="info-box">
                         <strong>说明：</strong> 
                         {#if enableTargetTitle}
                             {#if targetTitleType === 'custom'}
                                 系统将识别并复制匹配"{targetTitlePattern}"模式的标题内容
                             {:else}
                                 系统将识别并复制{recognitionTypes.find(t => t.value === targetTitleType)?.label}格式的标题内容
                             {/if}
                             {#if targetTitleContent}
                                 ，目标内容包含："{targetTitleContent}"
                             {/if}
                         {:else}
                             复制目标标题功能已禁用
                         {/if}
                     </div>
                 </div>

                 <!-- 复制机制设置 -->
                 <div class="setting-group">
                     <h3>📋 复制机制设置</h3>
                     <p class="description">配置手动和自动复制功能，两种模式可以并存使用</p>
                     
                     <div class="form-item">
                         <label>
                             <input 
                                 type="checkbox" 
                                 bind:checked={enableManualCopy}
                                 class="form-checkbox"
                             />
                             启用手动复制功能
                         </label>
                     </div>

                     {#if enableManualCopy}
                         <div class="form-item">
                             <label for="manual-copy-hotkey">手动复制快捷键：</label>
                             <div class="hotkey-input-container">
                                 <input 
                                     bind:this={hotkeyInputRef}
                                     id="manual-copy-hotkey" 
                                     type="text" 
                                     bind:value={manualCopyHotkey}
                                     placeholder={isRecordingHotkey ? "请按下快捷键组合..." : "点击录制按钮设置快捷键"}
                                     class="form-control hotkey-input"
                                     readonly
                                     on:keydown={handleHotkeyKeyDown}
                                     on:blur={stopRecordingHotkey}
                                 />
                                 <div class="hotkey-buttons">
                                     <button 
                                         type="button"
                                         class="btn btn-secondary btn-sm"
                                         on:click={startRecordingHotkey}
                                         disabled={isRecordingHotkey}
                                     >
                                         {isRecordingHotkey ? "录制中..." : "录制"}
                                     </button>
                                     <button 
                                         type="button"
                                         class="btn btn-secondary btn-sm"
                                         on:click={clearHotkey}
                                         disabled={isRecordingHotkey}
                                     >
                                         清除
                                     </button>
                                 </div>
                             </div>
                             <small class="form-text">
                                 支持 Ctrl/Cmd + Alt + Shift + 字母/数字/功能键组合
                             </small>
                         </div>
                     {/if}

                     <div class="form-item">
                         <label>
                             <input 
                                 type="checkbox" 
                                 bind:checked={enableAutoCopy}
                                 class="form-checkbox"
                             />
                             启用自动复制功能
                         </label>
                     </div>

                     {#if enableAutoCopy}
                         <div class="form-item">
                             <label for="auto-copy-time">自动复制时间间隔（秒）：</label>
                             <input 
                                 id="auto-copy-time" 
                                 type="number" 
                                 bind:value={autoCopyTime}
                                 min="1"
                                 max="3600"
                                 class="form-control"
                             />
                         </div>
                     {/if}

                     <div class="info-box">
                         <strong>当前配置：</strong>
                         <br>
                         {#if enableManualCopy}
                             ✅ 手动复制已启用 - 快捷键：{manualCopyHotkey}
                             <br>
                         {/if}
                         {#if enableAutoCopy}
                             ✅ 自动复制已启用 - 间隔：{autoCopyTime} 秒
                             <br>
                         {/if}
                         {#if !enableManualCopy && !enableAutoCopy}
                             ⚠️ 所有复制功能均已禁用
                             <br>
                         {/if}
                         <strong>说明：</strong> 手动和自动复制功能可以同时启用，提供更灵活的使用方式
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

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    }

    .radio-label {
        display: flex;
        align-items: center;
        font-weight: normal;
        margin-bottom: 0;
    }

    .form-radio {
        margin-right: 8px;
    }

    textarea.form-control {
        resize: vertical;
        min-height: 80px;
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

    /* 快捷键输入组件样式 */
    .hotkey-input-container {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .hotkey-input {
        flex: 1;
        background-color: #f8f9fa;
        cursor: pointer;
    }

    .hotkey-input:focus {
        background-color: #fff3cd;
        border-color: #ffc107;
    }

    .hotkey-buttons {
        display: flex;
        gap: 4px;
    }

    .btn-sm {
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 3px;
    }

    .form-text {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #6c757d;
    }
</style>
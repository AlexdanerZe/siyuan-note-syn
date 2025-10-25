import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData,
    Custom,
    exitSiYuan,
    getModelByDockType,
    getAllEditor,
    Files,
    platformUtils,
    openSetting,
    openAttributePanel,
    saveLayout
} from "siyuan";
import "./index.scss";
import { IMenuItem } from "siyuan/types";

import HelloExample from "@/hello.svelte";
import SettingExample from "@/setting-example.svelte";
import NotebookSettings from "@/notebook-settings.svelte";

import { SettingUtils } from "./libs/setting-utils";
import { svelteDialog } from "./libs/dialog";
import { SyncService, SyncConfig } from "./sync-service";
import { logger } from "./libs/logger";

const STORAGE_NAME = "sync-config";
const TAB_TYPE = "custom_tab";
const DOCK_TYPE = "dock_tab";

export default class DailyProgressSyncPlugin extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private settingUtils: SettingUtils;
    private syncService: SyncService;
    private autoSyncTimer: NodeJS.Timeout | null = null;
    private lastEditTime: number = 0;


    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push("|");
        toolbar.push({
            name: "insert-smail-emoji",
            icon: "iconEmoji",
            hotkey: "⇧⌘I",
            tipPosition: "n",
            tip: this.i18n.insertEmoji,
            click(protyle: Protyle) {
                protyle.insert("😊");
            }
        });
        return toolbar;
    }

    async onload() {
        logger.info("开始加载每日进展同步插件");
        logger.logState("插件国际化数据", this.i18n);

        try {
            const frontEnd = getFrontend();
            this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
            logger.info(`检测到前端环境: ${frontEnd}, 移动端: ${this.isMobile}`);

            // 初始化配置
            logger.debug("检查插件数据存储", { 
                hasStorage: !!this.data,
                hasConfig: !!this.data[STORAGE_NAME],
                currentData: this.data[STORAGE_NAME]
            });

            if (!this.data[STORAGE_NAME]) {
                logger.warn("未找到配置数据，使用默认配置");
                this.data[STORAGE_NAME] = {
                    diaryPath: "/daily note",
                    projectPath: "/projects",
                    progressSection: "今日进展",
                    autoSyncEnabled: true,
                    autoSyncDelay: 10000, // 10秒
                    useTemplatePattern: false,
                    dateFormat: "YYYY-MM-DD",        // 默认日期格式
                    contentTitle: "今日进展",         // 默认提取标题
                    onlyLeafDocuments: false,
                    enableNotebookLimitation: true,   // 默认启用笔记本限定
                    selectedNotebookId: "",
                    selectedNotebookName: "",
                    // 复制设置默认值
                    enableTargetTitle: true,          // 默认启用复制目标标题
                    targetTitleType: "h2",           // 默认二级标题
                    targetTitlePattern: "## ",       // 默认二级标题模式
                    targetTitleContent: "项目进展",   // 默认目标段落
                    enableManualCopy: true,          // 默认启用手动复制
                    enableAutoCopy: true,            // 默认启用自动复制
                    autoCopyTime: 10,                // 默认10秒
                    manualCopyHotkey: "Cmd+Shift+C", // 默认快捷键
                    // 识别设置默认值
                    enableContentExtraction: false,   // 默认不启用内容提取
                    enableTitleExtraction: false,    // 默认不启用标题提取
                    titleExtractionType: "h1",       // 默认一级标题
                    titleExtractionPattern: "# "     // 默认一级标题模式
                };
                // 保存默认配置到存储
                await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
                logger.info("默认配置已设置并保存", this.data[STORAGE_NAME]);
            } else {
                // 确保现有配置有默认值，并修复可能的错误配置
                this.data[STORAGE_NAME].dateFormat = this.data[STORAGE_NAME].dateFormat || "YYYY-MM-DD";
                
                // 修复错误的 contentTitle 值（如 "今日进展313"）
                const currentContentTitle = this.data[STORAGE_NAME].contentTitle;
                if (!currentContentTitle || currentContentTitle.includes("313") || currentContentTitle === "项目进度") {
                    console.log(`🔧 [修复] 检测到错误的 contentTitle: "${currentContentTitle}"，重置为默认值`);
                    this.data[STORAGE_NAME].contentTitle = "今日进展";
                    // 保存修复后的配置
                    await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
                } else {
                    this.data[STORAGE_NAME].contentTitle = currentContentTitle;
                }
                
                // 确保复制设置有默认值
                this.data[STORAGE_NAME].enableTargetTitle = this.data[STORAGE_NAME].enableTargetTitle ?? true;
                this.data[STORAGE_NAME].targetTitleType = this.data[STORAGE_NAME].targetTitleType || "h2";
                this.data[STORAGE_NAME].targetTitlePattern = this.data[STORAGE_NAME].targetTitlePattern || "## ";
                this.data[STORAGE_NAME].targetTitleContent = this.data[STORAGE_NAME].targetTitleContent || "项目进展";
                this.data[STORAGE_NAME].enableManualCopy = this.data[STORAGE_NAME].enableManualCopy ?? true;
                this.data[STORAGE_NAME].enableAutoCopy = this.data[STORAGE_NAME].enableAutoCopy ?? true;
                this.data[STORAGE_NAME].autoCopyTime = this.data[STORAGE_NAME].autoCopyTime || 10;
                this.data[STORAGE_NAME].manualCopyHotkey = this.data[STORAGE_NAME].manualCopyHotkey || "Cmd+Shift+C";
                
                // 确保识别设置有默认值
                this.data[STORAGE_NAME].enableContentExtraction = this.data[STORAGE_NAME].enableContentExtraction ?? false;
                this.data[STORAGE_NAME].enableTitleExtraction = this.data[STORAGE_NAME].enableTitleExtraction ?? false;
                this.data[STORAGE_NAME].titleExtractionType = this.data[STORAGE_NAME].titleExtractionType || "h1";
                this.data[STORAGE_NAME].titleExtractionPattern = this.data[STORAGE_NAME].titleExtractionPattern || "# ";
                
                logger.info("加载现有配置", this.data[STORAGE_NAME]);
            }

            // 初始化同步服务
            logger.debug("开始初始化同步服务");
            const config: SyncConfig = {
                diaryPath: this.data[STORAGE_NAME].diaryPath,
                projectPath: this.data[STORAGE_NAME].projectPath,
                progressSection: this.data[STORAGE_NAME].progressSection,
                autoSyncEnabled: this.data[STORAGE_NAME].autoSyncEnabled,
                autoSyncDelay: this.data[STORAGE_NAME].autoSyncDelay / 1000, // 转换为秒
                useTemplatePattern: this.data[STORAGE_NAME].useTemplatePattern ?? false,
                dateFormat: this.data[STORAGE_NAME].dateFormat ?? "YYYY-MM-DD",
                contentTitle: this.data[STORAGE_NAME].contentTitle ?? "今日进展",
                onlyLeafDocuments: this.data[STORAGE_NAME].onlyLeafDocuments ?? false,
                enableNotebookLimitation: this.data[STORAGE_NAME].enableNotebookLimitation ?? false,
                selectedNotebookId: this.data[STORAGE_NAME].selectedNotebookId ?? "",
                selectedNotebookName: this.data[STORAGE_NAME].selectedNotebookName ?? "",
                // 内容提取和识别配置
                enableContentExtraction: this.data[STORAGE_NAME].enableContentExtraction ?? false,
                enableTitleExtraction: this.data[STORAGE_NAME].enableTitleExtraction ?? false,
                titleExtractionType: this.data[STORAGE_NAME].titleExtractionType ?? "h1",
                titleExtractionPattern: this.data[STORAGE_NAME].titleExtractionPattern ?? "# ",
                // 复制目标配置
                enableTargetTitle: this.data[STORAGE_NAME].enableTargetTitle ?? true,
                targetTitleType: this.data[STORAGE_NAME].targetTitleType ?? "h2",
                targetTitlePattern: this.data[STORAGE_NAME].targetTitlePattern ?? "## ",
                targetTitleContent: this.data[STORAGE_NAME].targetTitleContent ?? "项目进展",
                // 复制机制配置
                enableManualCopy: this.data[STORAGE_NAME].enableManualCopy ?? true,
                enableAutoCopy: this.data[STORAGE_NAME].enableAutoCopy ?? true,
                autoCopyTime: this.data[STORAGE_NAME].autoCopyTime ?? 10,
                manualCopyHotkey: this.data[STORAGE_NAME].manualCopyHotkey ?? "Cmd+Shift+C"
            };
            logger.info("同步服务配置", config);
            console.log("🔍 [配置调试] 原始存储数据:", this.data[STORAGE_NAME]);
            console.log("🔍 [配置调试] 最终配置对象:", config);
            console.log("🔍 [配置调试] enableNotebookLimitation:", config.enableNotebookLimitation);
            console.log("🔍 [配置调试] selectedNotebookId:", config.selectedNotebookId);
            
            // 调试：打印完整的存储数据
        console.log("🔍 [调试] 完整的 this.data:", this.data);
        
        this.syncService = new SyncService(config);
            logger.info("同步服务初始化完成");

            // 添加图标
            logger.debug("添加插件图标");
            this.addIcons(`<symbol id="iconSync" viewBox="0 0 32 32">
<path d="M24 12.5c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 6.627 5.373 12 12 12 3.059 0 5.842-1.154 7.961-3.039l-2.961-2.961c-1.321 1.321-3.121 2-5 2-3.866 0-7-3.134-7-7s3.134-7 7-7 7 3.134 7 7h-3l4 4 4-4h-3z"></path>
</symbol>
<symbol id="iconProject" viewBox="0 0 32 32">
<path d="M28 6h-24c-2.2 0-4 1.8-4 4v12c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4v-12c0-2.2-1.8-4-4-4zM28 22h-24v-12h24v12zM6 12h4v2h-4v-2zM6 16h4v2h-4v-2zM12 12h14v2h-14v-2zM12 16h10v2h-10v-2z"></path>
</symbol>`);

            // 添加手动同步命令
            logger.debug("添加手动同步命令");
            this.addCommand({
                langKey: "manualSync",
                hotkey: "⌘←",
                callback: () => {
                    this.manualSync();
                },
            });

            // 添加设置命令
            logger.debug("添加设置命令");
            this.addCommand({
                langKey: "openSettings",
                hotkey: "⇧⌘P",
                callback: () => {
                    this.openSettingsDialog();
                },
            });

            // 添加顶栏按钮
            logger.debug("添加顶栏按钮");
            this.addTopBar({
                icon: "iconSync",
                title: this.i18n.manualSync,
                position: "right",
                callback: () => {
                    this.manualSync();
                }
            });

            // 设置编辑器事件监听
            logger.debug("设置编辑器事件监听");
            this.setupEditorListeners();

            // 初始化设置工具
            logger.debug("初始化设置工具");
            await this.initializeSettings();

            logger.info("每日进展同步插件加载完成");
        } catch (error) {
            logger.error("插件加载失败", error);
            showMessage("插件加载失败，请查看控制台日志", 5000);
            throw error;
        }
    }

    /**
     * 手动同步
     */
    private async manualSync() {
        logger.logMethodEntry("DailyProgressSyncPlugin", "manualSync");
        
        try {
            logger.debug("检查同步服务状态", {
                hasSyncService: !!this.syncService,
                hasData: !!this.data[STORAGE_NAME]
            });

            if (!this.syncService) {
                logger.error("同步服务未初始化");
                showMessage("同步服务未初始化，请重新加载插件", 3000);
                return;
            }

            logger.info("开始手动同步项目进展");
            showMessage("开始同步项目进展...", 3000);
            
            await this.syncService.syncProgress();
            
            logger.info("手动同步完成");
            showMessage("同步完成", 2000);
        } catch (error) {
            logger.error("手动同步失败", error);
            showMessage(`同步失败: ${error.message}`, 5000);
        }
        
        logger.logMethodExit("DailyProgressSyncPlugin", "manualSync");
    }

    /**
     * 设置编辑器事件监听
     */
    private setupEditorListeners() {
        // 监听编辑器焦点变化
        this.eventBus.on("loaded-protyle-dynamic", this.onProtyleLoaded.bind(this));
        this.eventBus.on("destroy-protyle", this.onProtyleDestroy.bind(this));
    }

    /**
     * 编辑器加载时的处理
     */
    private onProtyleLoaded(event: any) {
        const protyle = event.detail.protyle;
        if (!protyle || !protyle.element) return;

        // 添加编辑事件监听
        protyle.element.addEventListener('input', this.onEditorInput.bind(this));
        protyle.element.addEventListener('blur', this.onEditorBlur.bind(this));
    }

    /**
     * 编辑器销毁时的处理
     */
    private onProtyleDestroy(event: any) {
        const protyle = event.detail.protyle;
        if (!protyle || !protyle.element) return;

        // 移除事件监听
        protyle.element.removeEventListener('input', this.onEditorInput.bind(this));
        protyle.element.removeEventListener('blur', this.onEditorBlur.bind(this));
    }

    /**
     * 编辑器输入事件处理
     */
    private onEditorInput() {
        this.lastEditTime = Date.now();
        
        // 清除之前的定时器
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
    }

    /**
     * 编辑器失焦事件处理
     */
    private onEditorBlur() {
        if (!this.data[STORAGE_NAME].autoSyncEnabled) return;

        // 检查当前是否在日记文件中
        if (!this.isInDiaryDocument()) return;

        const delay = this.data[STORAGE_NAME].autoSyncDelay || 10000;
        
        // 设置自动同步定时器
        this.autoSyncTimer = setTimeout(() => {
            this.autoSync();
        }, delay);
    }

    /**
     * 检查当前是否在日记文档中
     */
    private isInDiaryDocument(): boolean {
        try {
            const editors = getAllEditor();
            if (editors.length === 0) return false;

            const currentEditor = editors[0];
            if (!currentEditor || !currentEditor.protyle) return false;

            const docPath = currentEditor.protyle.path;
            const diaryPath = this.data[STORAGE_NAME].diaryPath;
            
            return docPath && docPath.includes(diaryPath);
        } catch (error) {
            console.error("检查日记文档时出错:", error);
            return false;
        }
    }

    /**
     * 自动同步
     */
    private async autoSync() {
        logger.logMethodEntry("DailyProgressSyncPlugin", "autoSync");
        
        try {
            logger.debug("检查自动同步条件", {
                hasSyncService: !!this.syncService,
                hasData: !!this.data[STORAGE_NAME],
                autoSyncEnabled: this.data[STORAGE_NAME]?.autoSyncEnabled
            });

            if (!this.syncService) {
                logger.warn("同步服务未初始化，跳过自动同步");
                return;
            }

            if (!this.data[STORAGE_NAME]?.autoSyncEnabled) {
                logger.debug("自动同步已禁用，跳过同步");
                return;
            }

            logger.info("执行自动同步");
            await this.syncService.syncProgress();
            logger.info("自动同步完成");
        } catch (error) {
            logger.error("自动同步失败", error);
        }
        
        logger.logMethodExit("DailyProgressSyncPlugin", "autoSync");
    }

    /**
     * 打开设置对话框
     */
    private openSettingsDialog() {
        const dialog = new Dialog({
            title: "项目进展同步设置",
            content: `<div id="settingsContainer"></div>`,
            width: "800px",
            height: "600px"
        });

        // 创建设置界面
        const container = dialog.element.querySelector("#settingsContainer");
        if (container) {
            new NotebookSettings({
                target: container,
                props: {
                    plugin: this,
                    config: this.data[STORAGE_NAME],
                    syncService: this.syncService
                }
            });
        }
    }

    /**
     * 初始化设置工具
     */
    private async initializeSettings() {
        logger.logMethodEntry("DailyProgressSyncPlugin", "initializeSettings");
        
        try {
            // 确保配置数据已初始化
            logger.debug("检查配置数据状态", {
                hasData: !!this.data,
                hasConfig: !!this.data[STORAGE_NAME],
                config: this.data[STORAGE_NAME]
            });

            if (!this.data[STORAGE_NAME]) {
                logger.warn("配置数据未初始化，使用默认配置");
                this.data[STORAGE_NAME] = {
                    diaryPath: "/daily note",
                    projectPath: "/projects",
                    progressSection: "今日进展",
                    autoSyncEnabled: true,
                    autoSyncDelay: 10000
                };
                // 保存默认配置到存储
                await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
                logger.info("默认配置已设置并保存", this.data[STORAGE_NAME]);
            }

            logger.debug("开始创建SettingUtils实例");
            this.settingUtils = new SettingUtils({
                plugin: this, 
                name: STORAGE_NAME
            });
            logger.info("SettingUtils实例创建成功");

            // 日记目录路径设置
            logger.debug("添加日记目录路径设置项");
            this.settingUtils.addItem({
                key: "diaryPath",
                value: this.data[STORAGE_NAME].diaryPath || "/daily note",
                type: "textinput",
                title: "日记目录路径",
                description: "设置日记文件所在的目录路径，如：/daily note",
                action: {
                    callback: async () => {
                        logger.debug("日记目录路径设置回调被触发");
                        const value = await this.settingUtils.takeAndSave("diaryPath");
                        if (this.syncService) {
                            this.syncService.updateConfig({ diaryPath: value });
                        }
                        logger.info("日记目录路径已更新", { value });
                    }
                }
            });

            // 项目目录路径设置
            logger.debug("添加项目目录路径设置项");
            this.settingUtils.addItem({
                key: "projectPath",
                value: this.data[STORAGE_NAME].projectPath || "/projects",
                type: "textinput",
                title: "项目目录路径",
                description: "设置项目文件所在的目录路径，如：/projects",
                action: {
                    callback: async () => {
                        logger.debug("项目目录路径设置回调被触发");
                        const value = await this.settingUtils.takeAndSave("projectPath");
                        if (this.syncService) {
                            this.syncService.updateConfig({ projectPath: value });
                        }
                        logger.info("项目目录路径已更新", { value });
                    }
                }
            });

            // 进展章节标题设置
            logger.debug("添加进展章节标题设置项");
            this.settingUtils.addItem({
                key: "progressSection",
                value: this.data[STORAGE_NAME].progressSection || "今日进展",
                type: "textinput",
                title: "进展章节标题",
                description: "设置日记中进展内容的章节标题，如：今日进展",
                action: {
                    callback: async () => {
                        logger.debug("进展章节标题设置回调被触发");
                        const value = await this.settingUtils.takeAndSave("progressSection");
                        if (this.syncService) {
                            this.syncService.updateConfig({ progressSection: value });
                        }
                        logger.info("进展章节标题已更新", { value });
                    }
                }
            });

            // 自动同步开关
            logger.debug("添加自动同步开关设置项");
            this.settingUtils.addItem({
                key: "autoSyncEnabled",
                value: this.data[STORAGE_NAME].autoSyncEnabled !== undefined ? this.data[STORAGE_NAME].autoSyncEnabled : true,
                type: "checkbox",
                title: "启用自动同步",
                description: "编辑焦点离开后自动执行同步",
                action: {
                    callback: async () => {
                        logger.debug("自动同步开关设置回调被触发");
                        const value = await this.settingUtils.takeAndSave("autoSyncEnabled");
                        logger.info("自动同步开关已更新", { value });
                    }
                }
            });

            // 自动同步延迟设置
            logger.debug("添加自动同步延迟设置项");
            this.settingUtils.addItem({
                key: "autoSyncDelay",
                value: this.data[STORAGE_NAME].autoSyncDelay || 10000,
                type: "slider",
                title: "自动同步延迟（毫秒）",
                description: "编辑焦点离开后多长时间执行自动同步",
                slider: {
                    min: 5000,
                    max: 60000,
                    step: 1000
                },
                action: {
                    callback: async () => {
                        logger.debug("自动同步延迟设置回调被触发");
                        const value = await this.settingUtils.takeAndSave("autoSyncDelay");
                        logger.info("自动同步延迟已更新", { value });
                    }
                }
            });

            logger.logMethodExit("DailyProgressSyncPlugin", "initializeSettings", "设置初始化完成");
        } catch (error) {
            logger.error("设置初始化失败", error);
            throw error;
        }
    }

    onLayoutReady() {
        const topBarElement = this.addTopBar({
            icon: "iconFace",
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    // 如果被隐藏，则使用更多按钮
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            }
        });

        // 添加专门的设置按钮
        const settingsBarElement = this.addTopBar({
            icon: "iconSettings",
            title: "项目进展同步设置",
            position: "right",
            callback: () => {
                this.openSettingsDialog();
            }
        });

        const statusIconTemp = document.createElement("template");
        statusIconTemp.innerHTML = `<div class="toolbar__item ariaLabel" aria-label="Remove plugin-sample Data">
    <svg>
        <use xlink:href="#iconTrashcan"></use>
    </svg>
</div>`;
        statusIconTemp.content.firstElementChild.addEventListener("click", () => {
            confirm("⚠️", this.i18n.confirmRemove.replace("${name}", this.name), () => {
                this.removeData(STORAGE_NAME).then(() => {
                    this.data[STORAGE_NAME] = { readonlyText: "Readonly" };
                    showMessage(`[${this.name}]: ${this.i18n.removedData}`);
                });
            });
        });
        this.addStatusBar({
            element: statusIconTemp.content.firstElementChild as HTMLElement,
        });
        // this.loadData(STORAGE_NAME);
        this.settingUtils.load();
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);

        console.log(
            "Official settings value calling example:\n" +
            this.settingUtils.get("InputArea") + "\n" +
            this.settingUtils.get("Slider") + "\n" +
            this.settingUtils.get("Select") + "\n"
        );
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Plugin");
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }

    async updateCards(options: ICardData) {
        options.cards.sort((a: ICard, b: ICard) => {
            if (a.blockID < b.blockID) {
                return -1;
            }
            if (a.blockID > b.blockID) {
                return 1;
            }
            return 0;
        });
        return options;
    }
    /**
     * 打开插件设置面板
     */
    openSetting(): void {
        logger.logMethodEntry("DailyProgressSyncPlugin", "openSetting");
        
        try {
            logger.info("正在打开新的设置界面");
            // 使用新的设置界面而不是旧的SettingUtils
            this.openSettingsDialog();
            logger.info("新设置界面已打开");
        } catch (error) {
            logger.error("打开设置面板失败", error);
            showMessage("打开设置面板失败，请查看控制台日志", 3000);
        }
        
        logger.logMethodExit("DailyProgressSyncPlugin", "openSetting");
    }

    private eventBusPaste(event: any) {
        // 如果需异步处理请调用 preventDefault， 否则会进行默认处理
        event.preventDefault();
        // 如果使用了 preventDefault，必须调用 resolve，否则程序会卡死
        event.detail.resolve({
            textPlain: event.detail.textPlain.trim(),
        });
    }

    private eventBusLog({ detail }: any) {
        console.log(detail);
    }

    private blockIconEvent({ detail }: any) {
        detail.menu.addItem({
            id: "pluginSample_removeSpace",
            iconHTML: "",
            label: this.i18n.removeSpace,
            click: () => {
                const doOperations: IOperation[] = [];
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement) {
                        editElement.textContent = editElement.textContent.replace(/ /g, "");
                        doOperations.push({
                            id: item.dataset.nodeId,
                            data: item.outerHTML,
                            action: "update"
                        });
                    }
                });
                detail.protyle.getInstance().transaction(doOperations);
            }
        });
    }

    private showDialog() {
        const docId = this.getEditor().protyle.block.rootID;
        svelteDialog({
            title: `SiYuan ${Constants.SIYUAN_VERSION}`,
            width: this.isMobile ? "92vw" : "720px",
            constructor: (container: HTMLElement) => {
                return new HelloExample({
                    target: container,
                    props: {
                        app: this.app,
                        blockID: docId
                    }
                });
            }
        });
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("topBarSample", () => {
            console.log(this.i18n.byeMenu);
        });
        menu.addItem({
            icon: "iconSettings",
            label: "Open SiYuan Setting",
            click: () => {
                openSetting(this.app);
            }
        });
        menu.addItem({
            icon: "iconSettings",
            label: "Open Plugin Setting",
            click: () => {
                this.openSetting();
            }
        });
        menu.addItem({
            icon: "iconSettings",
            label: "项目进展同步设置",
            click: () => {
                this.openSettingsDialog();
            }
        });
        menu.addSeparator();
        menu.addItem({
            icon: "iconDrag",
            label: "Open Attribute Panel",
            click: () => {
                openAttributePanel({
                    nodeElement: this.getEditor().protyle.wysiwyg.element.firstElementChild as HTMLElement,
                    protyle: this.getEditor().protyle,
                    focusName: "custom",
                });
            }
        });
        menu.addItem({
            icon: "iconInfo",
            label: "Dialog(open doc first)",
            accelerator: this.commands[0].customHotkey,
            click: () => {
                this.showDialog();
            }
        });
        menu.addItem({
            icon: "iconFocus",
            label: "Select Opened Doc(open doc first)",
            click: () => {
                (getModelByDockType("file") as Files).selectItem(this.getEditor().protyle.notebookId, this.getEditor().protyle.path);
            }
        });
        if (!this.isMobile) {
            menu.addItem({
                icon: "iconFace",
                label: "Open Custom Tab(open doc first)",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        custom: {
                            icon: "iconFace",
                            title: "Custom Tab",
                            data: {
                                // text: platformUtils.isHuawei() ? "Hello, Huawei!" : "This is my custom tab",
                                blockID: this.getEditor().protyle.block.rootID,
                            },
                            id: this.name + TAB_TYPE
                        },
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconImage",
                label: "Open Asset Tab(First open the Chinese help document)",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        asset: {
                            path: "assets/paragraph-20210512165953-ag1nib4.svg"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconFile",
                label: "Open Doc Tab(open doc first)",
                click: async () => {
                    const tab = await openTab({
                        app: this.app,
                        doc: {
                            id: this.getEditor().protyle.block.rootID,
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconSearch",
                label: "Open Search Tab",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        search: {
                            k: "SiYuan"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconRiffCard",
                label: "Open Card Tab",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        card: {
                            type: "all"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconLayout",
                label: "Open Float Layer(open doc first)",
                click: () => {
                    this.addFloatLayer({
                        refDefs: [{ refID: this.getEditor().protyle.block.rootID }],
                        x: window.innerWidth - 768 - 120,
                        y: 32,
                        isBacklink: false
                    });
                }
            });
            menu.addItem({
                icon: "iconOpenWindow",
                label: "Open Doc Window(open doc first)",
                click: () => {
                    openWindow({
                        doc: { id: this.getEditor().protyle.block.rootID }
                    });
                }
            });
        } else {
            menu.addItem({
                icon: "iconFile",
                label: "Open Doc(open doc first)",
                click: () => {
                    openMobileFileById(this.app, this.getEditor().protyle.block.rootID);
                }
            });
        }
        menu.addItem({
            icon: "iconLock",
            label: "Lockscreen",
            click: () => {
                lockScreen(this.app);
            }
        });
        menu.addItem({
            icon: "iconQuit",
            label: "Exit Application",
            click: () => {
                exitSiYuan();
            }
        });
        menu.addItem({
            icon: "iconDownload",
            label: "Save Layout",
            click: () => {
                saveLayout(() => {
                    showMessage("Layout saved");
                });
            }
        });
        menu.addItem({
            icon: "iconScrollHoriz",
            label: "Event Bus",
            type: "submenu",
            submenu: [{
                icon: "iconSelect",
                label: "On ws-main",
                click: () => {
                    this.eventBus.on("ws-main", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off ws-main",
                click: () => {
                    this.eventBus.off("ws-main", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-blockicon",
                click: () => {
                    this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
                }
            }, {
                icon: "iconClose",
                label: "Off click-blockicon",
                click: () => {
                    this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
                }
            }, {
                icon: "iconSelect",
                label: "On click-pdf",
                click: () => {
                    this.eventBus.on("click-pdf", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-pdf",
                click: () => {
                    this.eventBus.off("click-pdf", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-editorcontent",
                click: () => {
                    this.eventBus.on("click-editorcontent", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-editorcontent",
                click: () => {
                    this.eventBus.off("click-editorcontent", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-editortitleicon",
                click: () => {
                    this.eventBus.on("click-editortitleicon", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-editortitleicon",
                click: () => {
                    this.eventBus.off("click-editortitleicon", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-flashcard-action",
                click: () => {
                    this.eventBus.on("click-flashcard-action", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-flashcard-action",
                click: () => {
                    this.eventBus.off("click-flashcard-action", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-noneditableblock",
                click: () => {
                    this.eventBus.on("open-noneditableblock", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-noneditableblock",
                click: () => {
                    this.eventBus.off("open-noneditableblock", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On loaded-protyle-static",
                click: () => {
                    this.eventBus.on("loaded-protyle-static", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off loaded-protyle-static",
                click: () => {
                    this.eventBus.off("loaded-protyle-static", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On loaded-protyle-dynamic",
                click: () => {
                    this.eventBus.on("loaded-protyle-dynamic", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off loaded-protyle-dynamic",
                click: () => {
                    this.eventBus.off("loaded-protyle-dynamic", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On switch-protyle",
                click: () => {
                    this.eventBus.on("switch-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off switch-protyle",
                click: () => {
                    this.eventBus.off("switch-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On destroy-protyle",
                click: () => {
                    this.eventBus.on("destroy-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off destroy-protyle",
                click: () => {
                    this.eventBus.off("destroy-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-doctree",
                click: () => {
                    this.eventBus.on("open-menu-doctree", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-doctree",
                click: () => {
                    this.eventBus.off("open-menu-doctree", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-blockref",
                click: () => {
                    this.eventBus.on("open-menu-blockref", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-blockref",
                click: () => {
                    this.eventBus.off("open-menu-blockref", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-fileannotationref",
                click: () => {
                    this.eventBus.on("open-menu-fileannotationref", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-fileannotationref",
                click: () => {
                    this.eventBus.off("open-menu-fileannotationref", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-tag",
                click: () => {
                    this.eventBus.on("open-menu-tag", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-tag",
                click: () => {
                    this.eventBus.off("open-menu-tag", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-link",
                click: () => {
                    this.eventBus.on("open-menu-link", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-link",
                click: () => {
                    this.eventBus.off("open-menu-link", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-image",
                click: () => {
                    this.eventBus.on("open-menu-image", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-image",
                click: () => {
                    this.eventBus.off("open-menu-image", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-av",
                click: () => {
                    this.eventBus.on("open-menu-av", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-av",
                click: () => {
                    this.eventBus.off("open-menu-av", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-content",
                click: () => {
                    this.eventBus.on("open-menu-content", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-content",
                click: () => {
                    this.eventBus.off("open-menu-content", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-breadcrumbmore",
                click: () => {
                    this.eventBus.on("open-menu-breadcrumbmore", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-breadcrumbmore",
                click: () => {
                    this.eventBus.off("open-menu-breadcrumbmore", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-inbox",
                click: () => {
                    this.eventBus.on("open-menu-inbox", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-inbox",
                click: () => {
                    this.eventBus.off("open-menu-inbox", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On input-search",
                click: () => {
                    this.eventBus.on("input-search", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off input-search",
                click: () => {
                    this.eventBus.off("input-search", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On paste",
                click: () => {
                    this.eventBus.on("paste", this.eventBusPaste);
                }
            }, {
                icon: "iconClose",
                label: "Off paste",
                click: () => {
                    this.eventBus.off("paste", this.eventBusPaste);
                }
            }, {
                icon: "iconSelect",
                label: "On open-siyuan-url-plugin",
                click: () => {
                    this.eventBus.on("open-siyuan-url-plugin", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-siyuan-url-plugin",
                click: () => {
                    this.eventBus.off("open-siyuan-url-plugin", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-siyuan-url-block",
                click: () => {
                    this.eventBus.on("open-siyuan-url-block", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-siyuan-url-block",
                click: () => {
                    this.eventBus.off("open-siyuan-url-block", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On opened-notebook",
                click: () => {
                    this.eventBus.on("opened-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off opened-notebook",
                click: () => {
                    this.eventBus.off("opened-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On closed-notebook",
                click: () => {
                    this.eventBus.on("closed-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off closed-notebook",
                click: () => {
                    this.eventBus.off("closed-notebook", this.eventBusLog);
                }
            }]
        });
        menu.addSeparator();
        menu.addItem({
            icon: "iconSparkles",
            label: this.data[STORAGE_NAME].readonlyText || "Readonly",
            type: "readonly",
        });
        if (this.isMobile) {
            menu.fullscreen();
        } else {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    }

    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("please open doc first");
            return;
        }
        return editors[0];
    }
}

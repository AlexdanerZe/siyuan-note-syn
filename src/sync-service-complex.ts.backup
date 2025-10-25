/**
 * 项目进展同步服务
 * 负责扫描日记文件，提取项目进展内容，并同步到对应项目文档
 */

import { sql, getBlockKramdown, updateBlock, prependBlock, getChildBlocks, pushMsg, exportMdContent, deleteBlock, insertBlock } from "./api";
import { showMessage } from "siyuan";
import { NotebookService, NotebookServiceConfig, DocumentInfo } from "./notebook-service";

export interface SyncConfig {
    diaryPath: string;        // 日记目录路径（支持模板格式）
    projectPath: string;      // 项目文件目录路径
    progressSection: string;  // 进展章节标题，默认"今日进展"
    autoSyncEnabled: boolean; // 是否启用自动同步
    autoSyncDelay: number;    // 自动同步延迟（秒）
    notebookId?: string;      // 指定笔记本ID（可选）
    notebookName?: string;    // 指定笔记本名称（可选）
    useTemplatePattern: boolean; // 是否使用模板路径格式
    // 新增配置项
    selectedNotebookId?: string;  // 选中的笔记本ID
    selectedNotebookName?: string; // 选中的笔记本名称
    dateFormat: string;           // 日期格式，如 "YYYY-MM-DD", "YY-MM-DD"
    contentTitle: string;         // 要挖掘内容的标题
    onlyLeafDocuments: boolean;   // 是否只处理叶子文档
    enableNotebookLimitation: boolean; // 是否启用笔记本限定功能
}

export interface ProgressItem {
    date: string;           // 日记日期
    blockId: string;        // 内容块ID
    content: string;        // 进展内容
    projectRefs: Array<{name: string, id?: string}>;  // 引用的项目信息列表
}

export interface ProjectProgress {
    projectName: string;
    items: ProgressItem[];
}

export class SyncService {
    private config: SyncConfig;
    private hashRecords: Map<string, Set<string>> = new Map(); // projectDocId -> Set<contentHash>
    private dateBlockMapping: Map<string, Map<string, {blockId: string, hash: string}>> = new Map(); // projectDocId -> Map<date, {blockId, hash}>
    private notebookService: NotebookService;

    constructor(config: SyncConfig) {
        this.config = config;
        
        // 初始化NotebookService
        const notebookConfig: NotebookServiceConfig = {
            selectedNotebookId: config.selectedNotebookId,
            selectedNotebookName: config.selectedNotebookName,
            dateFormat: config.dateFormat || "YYYY-MM-DD",
            contentTitle: config.contentTitle || "今日进展",
            onlyLeafDocuments: config.onlyLeafDocuments || false
        };
        this.notebookService = new NotebookService(notebookConfig);
        
        // 环境检测和状态日志
        const isDev = process.env.NODE_ENV === 'development' || 
                     (typeof window !== 'undefined' && (
                         window.location.hostname === 'localhost' || 
                         window.location.port === '3001' ||
                         window.location.href.includes('localhost') ||
                         window.location.href.includes('127.0.0.1')
                     ));
        
        console.log(`SyncService 初始化 - 环境: ${isDev ? '开发' : '生产'}, 笔记本: ${config.notebookName || '默认'}`);
    }

    /**
     * 添加内容哈希到记录中
     */
    private addContentHash(projectDocId: string, contentHash: string): void {
        if (!this.hashRecords.has(projectDocId)) {
            this.hashRecords.set(projectDocId, new Set());
        }
        this.hashRecords.get(projectDocId)!.add(contentHash);
    }

    /**
     * 检查内容哈希是否已存在
     */
    private hasContentHash(projectDocId: string, contentHash: string): boolean {
        const hashes = this.hashRecords.get(projectDocId);
        return hashes ? hashes.has(contentHash) : false;
    }

    /**
     * 添加日期块映射
     */
    private addDateBlockMapping(projectDocId: string, date: string, blockId: string, hash: string): void {
        if (!this.dateBlockMapping.has(projectDocId)) {
            this.dateBlockMapping.set(projectDocId, new Map());
        }
        this.dateBlockMapping.get(projectDocId)!.set(date, {blockId, hash});
    }

    /**
     * 获取日期对应的块信息
     */
    private getDateBlockInfo(projectDocId: string, date: string): {blockId: string, hash: string} | null {
        const dateMap = this.dateBlockMapping.get(projectDocId);
        return dateMap ? dateMap.get(date) || null : null;
    }

    /**
     * 检查日期内容是否需要替换（同一日期但哈希不同）
     */
    private shouldReplaceContent(projectDocId: string, date: string, newHash: string): {shouldReplace: boolean, blockId?: string} {
        const existingInfo = this.getDateBlockInfo(projectDocId, date);
        if (!existingInfo) {
            return {shouldReplace: false}; // 没有现有内容，不需要替换
        }
        
        if (existingInfo.hash !== newHash) {
            return {shouldReplace: true, blockId: existingInfo.blockId}; // 哈希不同，需要替换
        }
        
        return {shouldReplace: false}; // 哈希相同，不需要替换
    }

    /**
     * 检测项目文档中被删除的内容块
     */
    private async detectDeletedBlocks(projectDocId: string): Promise<string[]> {
        console.log(`🔍 [删除检测] 开始检测项目文档 ${projectDocId} 中的删除块`);
        
        const deletedBlockIds: string[] = [];
        const dateMapping = this.dateBlockMapping.get(projectDocId);
        
        if (!dateMapping || dateMapping.size === 0) {
            console.log(`🔍 [删除检测] 项目文档 ${projectDocId} 没有历史记录，跳过删除检测`);
            return deletedBlockIds;
        }

        // 获取项目文档当前的所有块
        const currentBlocks = await getChildBlocks(projectDocId);
        const currentBlockIds = new Set<string>();
        
        // 递归收集所有当前存在的块ID
        const collectBlockIds = async (blocks: any[]) => {
            for (const block of blocks) {
                currentBlockIds.add(block.id);
                if (block.children && block.children.length > 0) {
                    await collectBlockIds(block.children);
                }
                // 也获取子块
                try {
                    const childBlocks = await getChildBlocks(block.id);
                    if (childBlocks && childBlocks.length > 0) {
                        await collectBlockIds(childBlocks);
                    }
                } catch (error) {
                    // 忽略获取子块失败的错误
                }
            }
        };
        
        await collectBlockIds(currentBlocks);
        console.log(`🔍 [删除检测] 当前文档中存在 ${currentBlockIds.size} 个块`);

        // 检查历史记录中的块是否还存在
        for (const [date, blockInfo] of dateMapping) {
            if (!currentBlockIds.has(blockInfo.blockId)) {
                console.log(`🗑️ [删除检测] 发现已删除的块: ${blockInfo.blockId} (日期: ${date})`);
                deletedBlockIds.push(blockInfo.blockId);
            }
        }

        console.log(`🔍 [删除检测] 检测完成，发现 ${deletedBlockIds.length} 个已删除的块`);
        return deletedBlockIds;
    }

    /**
     * 清理已删除块的记录
     */
    private cleanupDeletedBlockRecords(projectDocId: string, deletedBlockIds: string[]): void {
        console.log(`🧹 [记录清理] 开始清理项目文档 ${projectDocId} 中 ${deletedBlockIds.length} 个已删除块的记录`);
        
        const dateMapping = this.dateBlockMapping.get(projectDocId);
        if (!dateMapping) {
            return;
        }

        // 找出需要删除的日期记录
        const datesToRemove: string[] = [];
        for (const [date, blockInfo] of dateMapping) {
            if (deletedBlockIds.includes(blockInfo.blockId)) {
                datesToRemove.push(date);
                console.log(`🧹 [记录清理] 标记删除日期记录: ${date} -> ${blockInfo.blockId}`);
            }
        }

        // 删除日期映射记录
        for (const date of datesToRemove) {
            dateMapping.delete(date);
        }

        // 清理哈希记录（这个比较复杂，因为我们不知道具体的哈希值）
        // 我们可以重新初始化哈希记录来确保一致性
        if (datesToRemove.length > 0) {
            console.log(`🧹 [记录清理] 清理了 ${datesToRemove.length} 个日期记录，将重新初始化哈希记录`);
            // 清空当前项目的哈希记录，让下次同步时重新初始化
            this.hashRecords.delete(projectDocId);
        }
    }

    /**
     * 初始化项目文档的哈希记录
     */
    private async initializeHashRecords(projectDocId: string): Promise<void> {
        try {
            // 获取项目文档的现有内容 - 递归获取所有块
            const topLevelBlocks = await getChildBlocks(projectDocId);
            const allBlocks = await this.getAllBlocksRecursively(topLevelBlocks);
            
            if (!this.hashRecords.has(projectDocId)) {
                this.hashRecords.set(projectDocId, new Set());
            }
            
            if (!this.dateBlockMapping.has(projectDocId)) {
                this.dateBlockMapping.set(projectDocId, new Map());
            }
            
            const hashSet = this.hashRecords.get(projectDocId)!;
            const dateMap = this.dateBlockMapping.get(projectDocId)!;
            
            console.log(`📄 [初始化] 开始处理项目文档 ${projectDocId} 的 ${allBlocks.length} 个块`);
            
            // 解析现有内容并生成哈希 - 处理所有块
            for (const block of allBlocks) {
                try {
                    // 获取块的具体内容
                    const blockDetail = await getBlockKramdown(block.id);
                    if (blockDetail && blockDetail.kramdown) {
                        // 从块内容中提取主要日期
                        const blockDate = this.extractDateFromBlockContent(blockDetail.kramdown);
                        
                        if (blockDate) {
                            // 提取实际内容（去除日期引用部分）
                            const actualContent = this.extractActualContent(blockDetail.kramdown);
                            if (actualContent && actualContent.trim()) {
                                const contentHash = this.generateContentHash(actualContent);
                                hashSet.add(contentHash);
                                
                                // 每个块只对应一个日期，建立日期到块的映射
                                dateMap.set(blockDate, {blockId: block.id, hash: contentHash});
                                
                                console.log(`📅 [初始化映射] 日期: ${blockDate}, 块ID: ${block.id}, 哈希: ${contentHash.substring(0, 8)}...`);
                            }
                        } else {
                            // 如果没有日期信息，仍然记录哈希但不建立日期映射
                            const segments = this.parseProjectDocumentSegments(blockDetail.kramdown);
                            for (const segment of segments) {
                                if (segment.content.trim()) {
                                    const contentHash = this.generateContentHash(segment.content);
                                    hashSet.add(contentHash);
                                }
                            }
                        }
                    }
                } catch (blockError) {
                    console.warn(`获取块 ${block.id} 内容失败:`, blockError);
                }
            }
            
            console.log(`📄 [初始化完成] 项目文档 ${projectDocId} 哈希记录: ${hashSet.size} 条，日期映射: ${dateMap.size} 条`);
        } catch (error) {
            console.error(`初始化项目文档 ${projectDocId} 哈希记录失败:`, error);
        }
    }

    /**
     * 执行完整的同步流程
     */
    async syncProgress(): Promise<void> {
        try {
            const startTime = Date.now();
            const isDev = process.env.NODE_ENV === 'development' || 
                         (typeof window !== 'undefined' && window.location.hostname === 'localhost');
            
            console.log(`=== 开始同步项目进展 (${isDev ? '开发环境' : '生产环境'}) ===`);
            
            // 1. 扫描日记文件，提取进展内容
            const progressItems = await this.extractProgressFromDiaries();
            console.log(`📖 扫描完成: 提取到 ${progressItems.length} 条进展记录`);

            // 2. 按项目分组
            const projectProgressMap = this.groupProgressByProject(progressItems);
            console.log(`📁 分组完成: 涉及 ${projectProgressMap.size} 个项目`);

            // 3. 同步到各项目文档
            for (const [projectName, projectData] of projectProgressMap) {
                await this.syncToProjectDocument(projectName, projectData.items, projectData.docId);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`✅ 同步完成: ${progressItems.length} 条记录, ${projectProgressMap.size} 个项目 (${duration}ms)`);

            pushMsg(`同步完成！处理了 ${progressItems.length} 条进展记录，涉及 ${projectProgressMap.size} 个项目 (耗时: ${duration}ms)`);
        } catch (error) {
            console.error("❌ 同步失败:", error.message);
            pushMsg(`同步失败: ${error.message}`, 5000);
        }
    }

    /**
     * 从日记文件中提取进展内容
     */
    private async extractProgressFromDiaries(): Promise<ProgressItem[]> {
        // 检查是否启用笔记本限定功能
        if (this.config.enableNotebookLimitation && this.config.selectedNotebookId) {
            console.log(`🔍 [新功能] 使用笔记本限定功能，笔记本ID: ${this.config.selectedNotebookId}`);
            return await this.extractProgressFromNotebookLimitation();
        }

        // 使用传统的路径匹配方式
        console.log(`🔍 [传统模式] 使用路径匹配方式提取进展`);
        return await this.extractProgressFromPathMatching();
    }

    /**
     * 从单个文档中提取进展内容
     */
    private async extractProgressFromDocument(docId: string, docPath: string): Promise<ProgressItem[]> {
        console.log(`📄 [调试] 开始解析文档: ${docPath} (ID: ${docId})`);
        const progressItems: ProgressItem[] = [];
        const date = this.extractDateFromPath(docPath);
        
        if (!date) {
            console.log(`📄 [调试] 无法从路径提取日期: ${docPath}`);
            return progressItems;
        }
        console.log(`📄 [调试] 提取到日期: ${date}`);

        // 首先尝试JSON结构提取
        console.log(`📄 [调试] 尝试JSON结构提取...`);
        const jsonItems = await this.extractProgressFromJsonStructure(docId, date);
        console.log(`📄 [调试] JSON结构提取结果: ${jsonItems.length} 个项目`);
        if (jsonItems.length > 0) {
            progressItems.push(...jsonItems);
            // 输出识别结果
            for (const item of jsonItems) {
                for (const projectRef of item.projectRefs) {
                    console.log(`🔍 识别结果: 日记[${docId}] → 项目[${projectRef}] | 内容: "${item.content}"`);
                }
            }
            return progressItems;
        }

        // 方法1：查找传统的"今日进展"标题章节
        console.log(`📄 [调试] 方法1: 查找传统章节标题 "${this.config.progressSection}"`);
        
        // 使用getChildBlocks API获取文档的所有子块
        const allBlocks = await getChildBlocks(docId);
        console.log(`📄 [调试] 获取到 ${allBlocks.length} 个顶级子块`);
        
        // 递归获取所有子块
        const allDocBlocks = await this.getAllBlocksRecursively(allBlocks);
        console.log(`📄 [调试] 递归获取到 ${allDocBlocks.length} 个总块`);
        
        // 过滤出标题块且包含进展章节标题的块
        const progressSections = allDocBlocks.filter(block => 
            block.type === 'h' && 
            block.content && 
            block.content.includes(this.config.progressSection)
        );
        console.log(`📄 [调试] 找到 ${progressSections.length} 个进展章节`);
        
        for (const section of progressSections) {
            console.log(`📄 [调试] 处理章节: ${section.content} (ID: ${section.id})`);
            // 获取该章节下的所有子块
            const childBlocks = await this.getProgressChildBlocks(section.id);
            console.log(`📄 [调试] 章节下有 ${childBlocks.length} 个子块`);
            
            for (const block of childBlocks) {
                // 添加详细的调试信息
                console.log(`📄 [调试] 块ID: ${block.id}, 类型: ${block.type}`);
                console.log(`🔍 [传统方法] 完整块内容:`, JSON.stringify(block, null, 2));
                console.log(`📄 [调试] 原始content: "${block.content}"`);
                console.log(`📄 [调试] kramdown: "${block.kramdown}"`);
                if (block.fullMdContent) {
                    console.log(`📄 [调试] fullMdContent: "${block.fullMdContent}"`);
                }
                
                // 使用智能选择的最佳内容
                const blockContent = block.finalContent || block.content || block.kramdown || '';
                console.log(`📄 [调试] 最终使用内容: "${blockContent}"`);
                console.log(`📄 [调试] 内容长度: ${blockContent.length} 字符`);
                
                // 🔧 修复：从markdown字段提取项目引用，而不是从content字段
                const markdownContent = block.markdown || blockContent;
                console.log(`📄 [调试] 用于引用提取的markdown内容: "${markdownContent}"`);
                const projectRefs = this.extractProjectReferences(markdownContent);
                console.log(`📄 [调试] 提取到项目引用: ${JSON.stringify(projectRefs)}`);
                if (projectRefs.length > 0) {
                    const item = {
                        date,
                        blockId: block.id,
                        content: this.cleanContent(blockContent),
                        projectRefs
                    };
                    progressItems.push(item);
                    console.log(`📄 [调试] 添加进展项: ${JSON.stringify(item)}`);
                    // 输出识别结果
                    for (const projectRef of projectRefs) {
                        console.log(`🔍 识别结果: 日记[${docId}] → 项目[${projectRef.name}] | 内容: "${item.content}"`);
                    }
                }
            }
        }

        // 方法2：查找引用块格式的进展内容
        console.log(`📄 [调试] 方法2: 查找引用块格式的进展内容`);
        
        // 从已获取的所有块中过滤出包含进展章节和引用格式的块
        const refBlocks = allDocBlocks.filter(block => 
            block.content && 
            block.content.includes(this.config.progressSection) && 
            block.content.includes('((')
        );
        console.log(`📄 [调试] 找到 ${refBlocks.length} 个包含进展章节的引用块`);

        for (const refBlock of refBlocks) {
            console.log(`📄 [调试] 处理引用块: ${refBlock.content.substring(0, 100)}... (ID: ${refBlock.id})`);
            
            // 从同一父级下查找其他引用块
            const siblingBlocks = allDocBlocks.filter(block => 
                block.parent_id === refBlock.parent_id && 
                block.content && 
                block.content.includes('((') && 
                block.id !== refBlock.id
            );
            console.log(`📄 [调试] 找到 ${siblingBlocks.length} 个同级引用块`);

            for (const block of siblingBlocks) {
                // 从引用块中提取内容和项目引用
                const extractedContent = this.extractContentFromRefBlock(block.content);
                const projectRefs = this.extractProjectReferences(extractedContent);
                
                // 如果没有明确的项目引用，将内容本身作为项目引用
                if (projectRefs.length === 0 && extractedContent.trim()) {
                    const item = {
                        date,
                        blockId: block.id,
                        content: extractedContent,
                        projectRefs: [{name: extractedContent}] // 将内容本身作为项目名
                    };
                    progressItems.push(item);
                    console.log(`🔍 识别结果: 日记[${docId}] → 项目[${extractedContent}] | 内容: "${extractedContent}"`);
                } else if (projectRefs.length > 0) {
                    const item = {
                        date,
                        blockId: block.id,
                        content: this.cleanContent(extractedContent),
                        projectRefs
                    };
                    progressItems.push(item);
                    // 输出识别结果
                    for (const projectRef of projectRefs) {
                        console.log(`🔍 识别结果: 日记[${docId}] → 项目[${projectRef}] | 内容: "${item.content}"`);
                    }
                }
            }
        }

        // 方法3：直接查找文档中所有的引用块，过滤出可能的进展内容
        if (progressItems.length === 0) {
            console.log(`📄 [调试] 方法3: 前两种方法未找到内容，尝试查找所有引用块`);
            
            // 从已获取的所有块中过滤出引用块，但排除包含进展章节标题的块
            const allRefBlocks = allDocBlocks.filter(block => 
                block.content && 
                block.content.includes('((') && 
                !block.content.includes(this.config.progressSection)
            );
            console.log(`📄 [调试] 找到 ${allRefBlocks.length} 个引用块`);

            for (const block of allRefBlocks) {
                console.log(`📄 [调试] 处理引用块: ${block.content.substring(0, 100)}... (ID: ${block.id})`);
                // 优先尝试混合格式提取：((blockId '项目名')) 进展内容
                const mixedResult = this.extractMixedFormatContent(block.content);
                console.log(`📄 [调试] 混合格式提取结果: ${mixedResult ? JSON.stringify(mixedResult) : 'null'}`);
                if (mixedResult && this.isValidProgressContent(mixedResult.progressContent, block.content)) {
                    const item = {
                        date,
                        blockId: block.id,
                        content: mixedResult.progressContent,
                        projectRefs: [{name: mixedResult.projectName}]
                    };
                    progressItems.push(item);
                    console.log(`📄 [调试] 添加混合格式进展项: ${JSON.stringify(item)}`);
                    console.log(`🔍 识别结果: 日记[${docId}] → 项目[${mixedResult.projectName}] | 内容: "${mixedResult.progressContent}"`);
                } else {
                    // 尝试提取纯引用内容
                    const blockContent = block.finalContent || block.content || '';
                    const extractedContent = this.extractContentFromRefBlock(blockContent);
                    console.log(`📄 [调试] 纯引用内容提取: "${extractedContent}"`);
                    const projectRefs = this.extractProjectReferences(extractedContent);
                    console.log(`📄 [调试] 项目引用提取: ${JSON.stringify(projectRefs)}`);
                    
                    if (projectRefs.length > 0 && this.isValidProgressContent(extractedContent, blockContent)) {
                        const item = {
                            date,
                            blockId: block.id,
                            content: this.cleanContent(extractedContent),
                            projectRefs
                        };
                        progressItems.push(item);
                        console.log(`📄 [调试] 添加纯引用进展项: ${JSON.stringify(item)}`);
                        // 输出识别结果
                        for (const projectRef of projectRefs) {
                            console.log(`🔍 识别结果: 日记[${docId}] → 项目[${projectRef.name}] | 内容: "${item.content}"`);
                        }
                    } else {
                        console.log(`📄 [调试] 块不符合进展内容条件: 项目引用=${projectRefs.length}, 有效性=${this.isValidProgressContent(extractedContent, blockContent)}`);
                    }
                }
            }
        } else {
            console.log(`📄 [调试] 前两种方法已找到 ${progressItems.length} 个进展项，跳过方法3`);
        }

        console.log(`📄 [调试] 文档解析完成，总计找到 ${progressItems.length} 个进展项`);
        
        // 输出所有提取到的进展项的详细信息
        if (progressItems.length > 0) {
            console.log(`📄 [调试] 所有提取到的进展项详情:`);
            progressItems.forEach((item, index) => {
                console.log(`  ${index + 1}. 日期: ${item.date}, 块ID: ${item.blockId}`);
                console.log(`     内容: "${item.content}"`);
                console.log(`     项目引用: ${JSON.stringify(item.projectRefs)}`);
                console.log(`     内容长度: ${item.content.length} 字符`);
                console.log(`     内容哈希: ${this.generateContentHash(this.normalizeContent(item.content))}`);
                console.log(`     标准化内容: "${this.normalizeContent(item.content)}"`);
                console.log(`     日期+内容键: "${item.date}:${this.normalizeContent(item.content)}"`);
                console.log(`     ---`);
            });
        }
        
        return progressItems;
    }

    /**
     * 获取进展章节下的子块
     * 使用思源API的最佳实践：优先使用getChildBlocks，然后使用多重fallback机制
     */
    private async getProgressChildBlocks(sectionId: string): Promise<any[]> {
        console.log(`📄 [调试] 开始获取章节 ${sectionId} 的子块`);
        const allChildren: any[] = [];

        try {
            // 方法1: 使用官方getChildBlocks API获取直接子块
            console.log(`📄 [调试] 方法1: 使用getChildBlocks API获取子块`);
            const directChildren = await getChildBlocks(sectionId);
            
            if (directChildren && directChildren.length > 0) {
                console.log(`📄 [调试] getChildBlocks返回 ${directChildren.length} 个子块`);
                
                // 使用递归方法获取所有子块
                const allBlocks = await this.getAllBlocksRecursively(directChildren);
                console.log(`📄 [调试] 递归获取到 ${allBlocks.length} 个子块`);
                
                for (const child of allBlocks) {
                    const enrichedChild = await this.enrichBlockContent(child);
                    allChildren.push(enrichedChild);
                }
            } else {
                console.log(`📄 [调试] getChildBlocks未返回子块`);
            }
        } catch (error) {
            console.log(`📄 [调试] getChildBlocks出错:`, error);
        }

        console.log(`📄 [调试] 总计获取到 ${allChildren.length} 个子块`);
        return allChildren;
    }

    /**
     * 递归获取所有子块
     */
    private async getAllBlocksRecursively(blocks: any[]): Promise<any[]> {
        const allBlocks: any[] = [];
        
        for (const block of blocks) {
            allBlocks.push(block);
            
            try {
                const childBlocks = await getChildBlocks(block.id);
                if (childBlocks && childBlocks.length > 0) {
                    const nestedBlocks = await this.getAllBlocksRecursively(childBlocks);
                    allBlocks.push(...nestedBlocks);
                }
            } catch (error) {
                console.log(`📄 [调试] 获取块 ${block.id} 的子块失败:`, error);
            }
        }
        
        return allBlocks;
    }

    /**
     * 丰富块内容 - 使用多种API获取完整内容
     */
    private async enrichBlockContent(block: any): Promise<any> {
        console.log(`📄 [调试] 丰富块 ${block.id} 的内容，类型: ${block.type}`);
        
        // 保存原始内容
        const originalContent = block.content || '';
        console.log(`📄 [调试] 原始content: "${originalContent}"`);
        
        // 方法1: 获取kramdown源码
        try {
            const kramdownResult = await getBlockKramdown(block.id);
            console.log(`🔍 [内容获取] kramdown完整结果:`, JSON.stringify(kramdownResult, null, 2));
            if (kramdownResult && kramdownResult.kramdown) {
                block.kramdown = kramdownResult.kramdown;
                console.log(`📄 [调试] kramdown内容: "${kramdownResult.kramdown.substring(0, 100)}..."`);
            }
        } catch (error) {
            console.log(`📄 [调试] 获取kramdown失败:`, error);
        }
        
        // 方法2: 如果content为空或不完整，尝试exportMdContent
        if (!originalContent || originalContent.trim() === '' || originalContent.length < 10) {
            try {
                console.log(`📄 [调试] content为空或过短，尝试exportMdContent`);
                const mdResult = await exportMdContent(block.id);
                console.log(`🔍 [内容获取] exportMdContent完整结果:`, JSON.stringify(mdResult, null, 2));
                if (mdResult && mdResult.content) {
                    block.fullMdContent = mdResult.content;
                    console.log(`📄 [调试] 获取到完整MD内容: "${mdResult.content.substring(0, 200)}..."`);
                }
            } catch (error) {
                console.log(`📄 [调试] exportMdContent失败:`, error);
            }
        }
        
        // 方法3: 确定最终使用的内容
        const finalContent = this.selectBestContent(block);
        block.finalContent = finalContent;
        console.log(`📄 [调试] 最终选择的内容: "${finalContent.substring(0, 100)}..."`);
        
        return block;
    }

    /**
     * 选择最佳内容 - 智能选择最完整的内容
     */
    private selectBestContent(block: any): string {
        const contents = [
            { type: 'fullMdContent', content: block.fullMdContent || '' },
            { type: 'content', content: block.content || '' },
            { type: 'kramdown', content: block.kramdown || '' }
        ];
        
        // 过滤掉空内容和只包含属性的内容
        const validContents = contents.filter(c => {
            const content = c.content.trim();
            return content && 
                   content.length > 0 && 
                   !content.startsWith('{:') && // 排除kramdown属性
                   !content.match(/^{\s*[^}]*\s*}$/); // 排除纯属性块
        });
        
        if (validContents.length === 0) {
            console.log(`📄 [调试] 未找到有效内容，使用原始content`);
            return block.content || '';
        }
        
        // 选择最长的有效内容
        const bestContent = validContents.reduce((best, current) => 
            current.content.length > best.content.length ? current : best
        );
        
        console.log(`📄 [调试] 选择了 ${bestContent.type} 作为最佳内容`);
        return bestContent.content;
    }



    /**
     * 获取列表的所有项目 - 使用官方API
     */
    private async getListItems(listId: string): Promise<any[]> {
        console.log(`📄 [调试] 使用API获取列表 ${listId} 的子项`);
        
        try {
            // 使用官方API获取列表的子块
            const childBlocks = await getChildBlocks(listId);
            console.log(`📄 [调试] 列表子块数量: ${childBlocks ? childBlocks.length : 0}`);
            
            if (!childBlocks || childBlocks.length === 0) {
                return [];
            }
            
            // 过滤出列表项（type = 'i'）
            const listItems = childBlocks.filter(block => block.type === 'i');
            console.log(`📄 [调试] 过滤出 ${listItems.length} 个列表项`);
            
            // 为每个列表项丰富内容
            const enrichedItems = [];
            for (const item of listItems) {
                const enrichedItem = await this.enrichBlockContent(item);
                enrichedItems.push(enrichedItem);
            }
            
            return enrichedItems;
        } catch (error) {
            console.log(`📄 [调试] 获取列表项时出错:`, error);
            return [];
        }
    }

    /**
     * 从引用块中提取内容
     * 处理格式：((blockId 'content')) 或 ((blockId "content"))
     */
    private extractContentFromRefBlock(content: string): string {
        console.log(`[引用块内容提取] 开始提取，原内容: "${content}"`);
        
        // 匹配引用块格式：((blockId 'content')) 或 ((blockId "content"))
        const refPattern = /\(\(([^'"\s]+)\s+['"]([^'"]+)['"]\)\)/g;
        const matches = [];
        let match;
        let matchCount = 0;

        while ((match = refPattern.exec(content)) !== null) {
            matchCount++;
            const blockId = match[1];
            const extractedContent = match[2];
            console.log(`[引用块内容提取] 找到引用块 #${matchCount}: 块ID="${blockId}", 内容="${extractedContent}"`);
            matches.push(extractedContent); // 提取引号内的内容
        }

        console.log(`[引用块内容提取] 共找到 ${matchCount} 个引用块`);
        
        // 如果找到引用块内容，返回第一个；否则返回原内容
        const result = matches.length > 0 ? matches[0] : content;
        
        if (matches.length > 0) {
            console.log(`[引用块内容提取] 使用第一个引用块内容: "${result}"`);
        } else {
            console.log(`[引用块内容提取] 未找到引用块，返回原内容: "${result}"`);
        }
        
        return result;
    }

    /**
     * 从混合格式内容中提取项目名和进展内容
     * 格式：((blockId '项目名')) 进展内容
     */
    private extractMixedFormatContent(content: string): { projectName: string; progressContent: string } | null {
        console.log(`[混合格式提取] 开始分析内容: "${content}"`);
        
        // 匹配混合格式：((blockId '项目名')) 后面跟着进展内容
        // 支持多行内容和各种空白字符
        const mixedPattern = /\(\(([^'"\s]+)\s+['"]([^'"]+)['"]\)\)\s*(.+)/s;
        const match = content.match(mixedPattern);
        
        if (match) {
            const blockId = match[1];
            const projectName = match[2].trim();
            let progressContent = match[3].trim();
            
            console.log(`[混合格式提取] 找到混合格式匹配:`);
            console.log(`[混合格式提取] - 块ID: "${blockId}"`);
            console.log(`[混合格式提取] - 原始项目名: "${match[2]}"`);
            console.log(`[混合格式提取] - 清理后项目名: "${projectName}"`);
            console.log(`[混合格式提取] - 原始进展内容: "${match[3]}"`);
            
            // 清理进展内容：移除多余的空白和换行
            const originalProgressContent = progressContent;
            progressContent = progressContent
                .replace(/\s+/g, ' ')  // 将多个空白字符替换为单个空格
                .replace(/^\s*-\s*/, '')  // 移除开头的列表标记
                .trim();
            
            console.log(`[混合格式提取] - 清理后进展内容: "${progressContent}"`);
            
            // 验证进展内容是否有效
            const isValidLength = progressContent && progressContent.length > 1;
            const isNotOnlyNumbers = !progressContent.match(/^\d+$/);
            const isNotSameAsProject = progressContent !== projectName;
            
            console.log(`[混合格式提取] 内容验证:`);
            console.log(`[混合格式提取] - 长度有效 (>1): ${isValidLength}`);
            console.log(`[混合格式提取] - 非纯数字: ${isNotOnlyNumbers}`);
            console.log(`[混合格式提取] - 与项目名不同: ${isNotSameAsProject}`);
            
            if (isValidLength && isNotOnlyNumbers && isNotSameAsProject) {
                const result = {
                    projectName,
                    progressContent
                };
                console.log(`[混合格式提取] 提取成功:`, result);
                return result;
            } else {
                console.log(`[混合格式提取] 内容验证失败，返回null`);
            }
        } else {
            console.log(`[混合格式提取] 未找到混合格式匹配`);
        }
        
        return null;
    }

    /**
     * 验证内容是否为有效的进展内容
     */
    private isValidProgressContent(extractedContent: string, originalContent: string): boolean {
        console.log(`[内容验证] 开始验证内容有效性:`);
        console.log(`[内容验证] - 提取内容: "${extractedContent}"`);
        console.log(`[内容验证] - 原始内容: "${originalContent}"`);
        
        const trimmed = extractedContent.trim();
        console.log(`[内容验证] - 清理后内容: "${trimmed}"`);
        
        // 基本过滤条件
        if (!trimmed || trimmed.length <= 1) {
            console.log(`[内容验证] ❌ 失败: 内容为空或长度 ≤ 1`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 内容长度检查 (${trimmed.length} > 1)`);
        
        // 过滤纯数字内容
        if (trimmed.match(/^\d+$/)) {
            console.log(`[内容验证] ❌ 失败: 内容为纯数字`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 非纯数字内容`);
        
        // 过滤进展标识符本身
        if (trimmed === this.config.progressSection) {
            console.log(`[内容验证] ❌ 失败: 内容是进展标识符本身 ("${this.config.progressSection}")`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 不是进展标识符`);
        
        // 过滤看起来像blockId的内容（字母数字加连字符的组合）
        const blockIdPattern = /^[a-z0-9-]+$/i;
        if (blockIdPattern.test(trimmed) && trimmed.length > 10) {
            console.log(`[内容验证] ❌ 失败: 内容看起来像blockId (长度${trimmed.length} > 10且匹配模式)`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 不是blockId格式`);
        
        // 确保内容确实是从引用块中提取的（而不是普通文本）
        if (extractedContent === originalContent && !originalContent.includes('((')) {
            console.log(`[内容验证] ❌ 失败: 提取内容与原始内容相同且不包含引用块标记`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 内容来源检查`);
        
        // 过滤空的引用块
        const emptyRefPattern = /\(\([^)]+\s+['"]\s*['"]\)\)/;
        if (emptyRefPattern.test(originalContent)) {
            console.log(`[内容验证] ❌ 失败: 原始内容包含空的引用块`);
            return false;
        }
        console.log(`[内容验证] ✅ 通过: 非空引用块`);
        
        console.log(`[内容验证] ✅ 验证通过: 内容有效`);
        return true;
    }



    /**
     * 从内容中提取项目引用
     */
    private extractProjectReferences(content: string): Array<{name: string, id?: string}> {
        console.log(`[项目引用识别] 开始分析内容: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
        const refs: Array<{name: string, id?: string}> = [];
        
        // 1. 标准的双括号引用 [[项目名]]
        const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
        let match;
        let wikiLinkCount = 0;
        while ((match = wikiLinkPattern.exec(content)) !== null) {
            wikiLinkCount++;
            const refName = match[1].trim();
            if (refName) {
                refs.push({name: refName});
                console.log(`[项目引用识别] 找到双括号引用: "${refName}"`);
            }
        }
        
        // 2. 思源笔记的块引用格式 ((block-id "显示文本")) 或 ((block-id '显示文本'))
        const blockRefPattern = /\(\(([^\s'"]+)\s*['"]([^'"]+)['"]\)\)/g;
        let blockRefCount = 0;
        while ((match = blockRefPattern.exec(content)) !== null) {
            blockRefCount++;
            const blockId = match[1].trim();
            const displayText = match[2].trim();
            if (displayText && blockId) {
                refs.push({name: displayText, id: blockId});
                console.log(`[项目引用识别] 找到块引用: "${displayText}" (ID: ${blockId})`);
            }
        }
        
        // 3. Markdown链接格式 [显示文本](链接)
        const markdownLinkPattern = /\[([^\]]+)\]\([^)]+\)/g;
        let markdownLinkCount = 0;
        while ((match = markdownLinkPattern.exec(content)) !== null) {
            markdownLinkCount++;
            const linkText = match[1].trim();
            if (linkText) {
                refs.push({name: linkText});
                console.log(`[项目引用识别] 找到Markdown链接: "${linkText}"`);
            }
        }

        // 去重（基于名称和ID的组合）
        const uniqueRefs = refs.filter((ref, index, self) => 
            index === self.findIndex(r => r.name === ref.name && r.id === ref.id)
        );
        console.log(`[项目引用识别] 最终项目引用列表: [${uniqueRefs.map(ref => `"${ref.name}"${ref.id ? ` (ID: ${ref.id})` : ''}`).join(', ')}]`);
        
        return uniqueRefs;
    }

    /**
     * 清理内容，移除项目引用标记
     */
    private cleanContent(content: string): string {
        console.log(`[内容清理] 开始清理内容: "${content}"`);
        
        // 移除项目引用的双括号，保留项目名
        const cleanedContent = content.replace(/\[\[([^\]]+)\]\]/g, '$1');
        
        if (cleanedContent !== content) {
            console.log(`[内容清理] 清理完成，原内容: "${content}"`);
            console.log(`[内容清理] 清理完成，新内容: "${cleanedContent}"`);
        } else {
            console.log(`[内容清理] 内容无需清理，保持原样`);
        }
        
        return cleanedContent;
    }

    /**
     * 生成内容哈希用于去重
     */
    private generateContentHash(content: string): string {
        // 规范化内容格式以避免字段顺序导致的重复
        const normalizedContent = this.normalizeContent(content);
        
        // 简单的哈希函数，用于内容去重
        let hash = 0;
        const cleanedContent = normalizedContent.trim().toLowerCase();
        for (let i = 0; i < cleanedContent.length; i++) {
            const char = cleanedContent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }

    /**
     * 解析项目文档中的分段内容
     * 将项目文档中的内容按日期分段，每个分段包含日期和对应的内容
     */
    private parseProjectDocumentSegments(blockContent: string): Array<{date: string, content: string}> {
        const segments: Array<{date: string, content: string}> = [];
        
        // 清理内容，移除日期引用部分，只保留实际内容
        const cleanedContent = this.extractActualContent(blockContent);
        if (!cleanedContent) {
            return segments;
        }
        
        // 尝试从块内容中提取日期引用
        const dateFromContent = this.extractDateFromBlockContent(blockContent);
        if (dateFromContent) {
            // 如果能提取到日期，说明这是一个带日期引用的内容块
            segments.push({
                date: dateFromContent,
                content: cleanedContent
            });
        } else {
            // 如果没有日期引用，尝试解析多段内容
            // 这种情况下，内容可能包含多个日期段，需要进一步解析
            const lines = cleanedContent.split('\n');
            let currentDate = '';
            let currentContent = '';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // 检查是否是日期行（格式如：2025-10-11、2025/10/11等）
                const dateMatch = trimmedLine.match(/^(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
                if (dateMatch) {
                    // 保存之前的段落
                    if (currentDate && currentContent.trim()) {
                        segments.push({
                            date: currentDate,
                            content: currentContent.trim()
                        });
                    }
                    
                    // 开始新的段落
                    currentDate = dateMatch[1].replace(/\//g, '-'); // 统一格式为 YYYY-MM-DD
                    currentContent = trimmedLine.substring(dateMatch[0].length).trim();
                } else {
                    // 累积当前段落的内容
                    if (currentContent) {
                        currentContent += '\n' + trimmedLine;
                    } else {
                        currentContent = trimmedLine;
                    }
                }
            }
            
            // 保存最后一个段落
            if (currentDate && currentContent.trim()) {
                segments.push({
                    date: currentDate,
                    content: currentContent.trim()
                });
            }
            
            // 如果没有找到任何日期段，但有内容，则尝试使用默认处理
            if (segments.length === 0 && cleanedContent.trim()) {
                // 作为无日期的内容段处理，使用空日期标记
                segments.push({
                    date: '',
                    content: cleanedContent
                });
            }
        }
        
        return segments;
    }

    /**
     * 基于本地哈希记录过滤重复内容
     */
    private async filterDuplicateItems(projectDocId: string, progressItems: ProgressItem[]): Promise<ProgressItem[]> {
        try {
            // 初始化项目文档的哈希记录（如果还没有初始化）
            if (!this.hashRecords.has(projectDocId)) {
                await this.initializeHashRecords(projectDocId);
            }

            console.log(`🔍 [哈希记录] 项目文档 ${projectDocId} 已有 ${this.hashRecords.get(projectDocId)?.size || 0} 条哈希记录`);

            // 过滤出新内容
            const newItems = [];
            for (const item of progressItems) {
                // 使用与其他方法相同的内容处理逻辑
                const normalizedContent = this.extractActualContent(item.content);
                const contentHash = this.generateContentHash(normalizedContent);
                
                console.log(`🔍 [检查] ${item.date}: "${item.content.substring(0, 50)}..." (哈希: ${contentHash})`);
                
                // 检查哈希是否已存在
                const isDuplicate = this.hasContentHash(projectDocId, contentHash);
                
                if (!isDuplicate) {
                    newItems.push(item);
                    console.log(`✅ [新内容] ${item.date}: ${item.content.substring(0, 50)}...`);
                } else {
                    console.log(`🔄 [跳过重复] ${item.date}: ${item.content.substring(0, 50)}... (哈希匹配)`);
                }
            }

            console.log(`🔍 [重复检测] 原有 ${progressItems.length} 条，过滤后 ${newItems.length} 条新内容`);
            return newItems;
            
        } catch (error) {
            console.error('❌ 重复检测失败:', error);
            // 如果检测失败，返回所有项目以避免丢失数据
            return progressItems;
        }
    }

    /**
     * 检查内容是否已存在于项目文档中
     * 比较项目文档里已同步内容与每日日记里的内容是否一致
     */
    private async checkIfContentExistsInProject(projectDocId: string, item: ProgressItem): Promise<boolean> {
        try {
            // 直接使用ProgressItem中的content，这是已经提取好的进展内容
            const diaryContent = item.content;
            if (!diaryContent || !diaryContent.trim()) {
                console.log(`⚠️ [重复检测] 日记内容为空: ${item.blockId}`);
                return false;
            }

            // 获取项目文档中的所有内容
            const projectBlocks = await sql(`
                SELECT markdown, content 
                FROM blocks 
                WHERE root_id = '${projectDocId}' AND type = 'p'
                ORDER BY created ASC
            `);

            // 标准化日记内容用于比较
            const normalizedDiaryContent = this.normalizeContent(diaryContent);
            
            // 检查项目文档中是否存在相同的内容
            for (const block of projectBlocks) {
                const blockContent = block.markdown || block.content || '';
                if (blockContent.trim()) {
                    // 提取项目文档中的实际内容（去除日期引用）
                    const actualContent = this.extractActualContent(blockContent);
                    const normalizedProjectContent = this.normalizeContent(actualContent);
                    
                    // 比较标准化后的内容
                    if (normalizedDiaryContent === normalizedProjectContent) {
                        console.log(`✅ [内容匹配] 日记内容已存在于项目文档中`);
                        console.log(`   日记内容: ${diaryContent.substring(0, 100)}...`);
                        console.log(`   项目内容: ${actualContent.substring(0, 100)}...`);
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error(`❌ 检查内容重复失败:`, error);
            return false;
        }
    }

    /**
     * 获取日记中的原始内容
     */
    private async getDiaryOriginalContent(blockId: string, date: string): Promise<string | null> {
        try {
            const query = `
                SELECT markdown, content 
                FROM blocks 
                WHERE id = '${blockId}'
                LIMIT 1
            `;
            
            const blocks = await sql(query);
            if (blocks.length === 0) {
                return null;
            }
            
            const block = blocks[0];
            const content = block.markdown || block.content || '';
            
            // 清理内容，移除项目引用，只保留实际进展内容
            return this.extractActualContent(content);
        } catch (error) {
            console.error(`获取日记原始内容失败 (${blockId}):`, error);
            return null;
        }
    }

    /**
     * 从块内容中提取日期引用
     */
    private extractDateFromBlockContent(blockContent: string): string | null {
        try {
            // 匹配日期引用格式，如 ((20251009120940-y6i11ag "2025-10-11"))
            const dateRefPattern = /\(\([\w-]+\s+"([^"]+)"\)\)/g;
            const matches = blockContent.match(dateRefPattern);
            
            if (matches && matches.length > 0) {
                // 提取第一个日期引用中的日期
                const firstMatch = matches[0];
                const dateMatch = firstMatch.match(/"([^"]+)"/);
                if (dateMatch && dateMatch[1]) {
                    const dateStr = dateMatch[1];
                    // 验证是否为有效的日期格式
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        return dateStr;
                    }
                }
            }
            
            // 如果没有找到日期引用，尝试从内容中提取日期
            const datePattern = /(\d{4}-\d{2}-\d{2})/;
            const dateMatch = blockContent.match(datePattern);
            if (dateMatch) {
                return dateMatch[1];
            }
            
            return null;
        } catch (error) {
            console.error('提取日期引用失败:', error);
            return null;
        }
    }

    /**
     * 从块内容中提取实际内容，移除日期引用等格式
     */
    private extractActualContent(blockContent: string): string {
        // 移除日期引用格式：((docId "date")) 或 ((docId 'date')) 或 【【date】】
        let cleaned = blockContent
            .replace(/\(\([^)]+\s+"[^"]+"\)\)/g, '') // 移除 ((docId "date"))
            .replace(/\(\([^)]+\s+'[^']+'\)\)/g, '') // 移除 ((docId 'date'))
            .replace(/【【[^】]+】】/g, '') // 移除 【【date】】
            .trim();
        
        // 移除开头的换行符和多余空白
        cleaned = cleaned.replace(/^\n+/, '').replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    /**
     * 规范化内容格式，解决字段顺序不同导致的重复问题
     */
    private normalizeContent(content: string): string {
        // 移除思源笔记的属性标记 {: id="xxx" updated="xxx"}
        let normalized = content.replace(/\{:\s*[^}]*\}/g, '').trim();
        
        // 移除多余的空白字符
        normalized = normalized.replace(/\s+/g, ' ');
        
        // 移除行首的列表标记（- 或 * 或数字.）
        normalized = normalized.replace(/^[\s]*[-*][\s]*/, '').replace(/^[\s]*\d+\.[\s]*/, '');
        
        return normalized;
    }

    /**
     * 解析模板路径格式，生成实际的搜索路径模式
     */
    private parseTemplatePath(templatePath: string, targetDate?: Date): string[] {
        if (!this.config.useTemplatePattern) {
            return [templatePath];
        }

        const now = targetDate || new Date();
        const patterns: string[] = [];

        // 支持的日期格式模板
        const dateFormats = {
            "2006/01": (date: Date) => `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`,
            "2006-01": (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            "2006-01-02": (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            "2006/01/02": (date: Date) => `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
            "01-02": (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            "01/02": (date: Date) => `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
        };

        // 解析模板中的日期格式
        let resolvedPath = templatePath;
        const templateRegex = /\{\{now\s*\|\s*date\s+"([^"]+)"\}\}/g;
        let match;

        while ((match = templateRegex.exec(templatePath)) !== null) {
            const format = match[1];
            const formatFunc = dateFormats[format];
            if (formatFunc) {
                const formattedDate = formatFunc(now);
                resolvedPath = resolvedPath.replace(match[0], formattedDate);
            }
        }

        patterns.push(resolvedPath);

        // 如果没有指定目标日期，生成最近几个月的路径模式
        if (!targetDate) {
            for (let i = 1; i <= 3; i++) {
                const pastDate = new Date(now);
                pastDate.setMonth(pastDate.getMonth() - i);
                
                let pastPath = templatePath;
                templateRegex.lastIndex = 0; // 重置正则表达式
                while ((match = templateRegex.exec(templatePath)) !== null) {
                    const format = match[1];
                    const formatFunc = dateFormats[format];
                    if (formatFunc) {
                        const formattedDate = formatFunc(pastDate);
                        pastPath = pastPath.replace(match[0], formattedDate);
                    }
                }
                patterns.push(pastPath);
            }
        }

        return patterns;
    }

    /**
     * 从文档路径中提取日期
     */
    private extractDateFromPath(path: string): string | null {
        // 尝试匹配各种日期格式
        const datePatterns = [
            // 完整日期格式
            {
                pattern: /(\d{4}-\d{2}-\d{2})/,
                handler: (match: RegExpMatchArray) => match[1]
            },
            {
                pattern: /(\d{4}\/\d{2}\/\d{2})/,
                handler: (match: RegExpMatchArray) => match[1].replace(/\//g, '-')
            },
            {
                pattern: /(\d{4}\/\d{1,2}\/\d{1,2})/,
                handler: (match: RegExpMatchArray) => {
                    const parts = match[1].split('/');
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            },
            // 年月格式（从模板路径中提取）
            {
                pattern: /\/(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?/,
                handler: (match: RegExpMatchArray) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3] ? match[3].padStart(2, '0') : '01';
                    return `${year}-${month}-${day}`;
                }
            },
            {
                pattern: /\/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/,
                handler: (match: RegExpMatchArray) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3] ? match[3].padStart(2, '0') : '01';
                    return `${year}-${month}-${day}`;
                }
            },
            // 中文日期格式
            {
                pattern: /(\d{1,2}月\d{1,2}日)/,
                handler: (match: RegExpMatchArray) => {
                    const currentYear = new Date().getFullYear();
                    const monthDay = match[1];
                    const monthMatch = monthDay.match(/(\d{1,2})月(\d{1,2})日/);
                    if (monthMatch) {
                        const month = monthMatch[1].padStart(2, '0');
                        const day = monthMatch[2].padStart(2, '0');
                        return `${currentYear}-${month}-${day}`;
                    }
                    return null;
                }
            },
            // 文件名中的日期格式
            {
                pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
                handler: (match: RegExpMatchArray) => {
                    const year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
        ];

        for (const { pattern, handler } of datePatterns) {
            const match = path.match(pattern);
            if (match) {
                const result = handler(match);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * 按项目分组进展内容
     */
    private groupProgressByProject(progressItems: ProgressItem[]): Map<string, {items: ProgressItem[], docId?: string}> {
        const projectMap = new Map<string, {items: ProgressItem[], docId?: string}>();

        for (const item of progressItems) {
            for (const projectRef of item.projectRefs) {
                const projectKey = projectRef.name;
                if (!projectMap.has(projectKey)) {
                    projectMap.set(projectKey, {items: [], docId: projectRef.id});
                }
                projectMap.get(projectKey)!.items.push(item);
                
                // 如果有文档ID，优先使用
                if (projectRef.id && !projectMap.get(projectKey)!.docId) {
                    projectMap.get(projectKey)!.docId = projectRef.id;
                }
            }
        }

        // 按日期倒序排列每个项目的进展
        for (const [project, data] of projectMap) {
            data.items.sort((a, b) => b.date.localeCompare(a.date));
        }

        return projectMap;
    }

    /**
     * 同步到项目文档
     */
    private async syncToProjectDocument(projectName: string, progressItems: ProgressItem[], docId?: string): Promise<void> {
        try {
            let projectDoc: any;
            
            // 如果有直接的文档ID，优先使用
            if (docId) {
                console.log(`[文档同步] 使用直接文档ID: ${docId} (项目: ${projectName})`);
                projectDoc = { id: docId, content: projectName, hpath: `直接引用/${projectName}` };
            } else {
                // 查找项目文档
                projectDoc = await this.findProjectDocument(projectName);
                if (!projectDoc) {
                    console.log(`❌ 未找到项目文档: ${projectName}`);
                    pushMsg(`未找到项目文档: ${projectName}`, 3000);
                    return;
                }
            }

            // 初始化哈希记录（如果还没有初始化）
            if (!this.hashRecords.has(projectDoc.id)) {
                await this.initializeHashRecords(projectDoc.id);
            }

            // 检测并清理已删除的内容块
            console.log(`🔍 [删除检测] 开始检测项目文档 ${projectName} 中的删除内容`);
            const deletedBlockIds = await this.detectDeletedBlocks(projectDoc.id);
            if (deletedBlockIds.length > 0) {
                console.log(`🗑️ [删除检测] 发现 ${deletedBlockIds.length} 个已删除的块，开始清理记录`);
                this.cleanupDeletedBlockRecords(projectDoc.id, deletedBlockIds);
                console.log(`✅ [删除检测] 已清理删除块的记录，确保同步状态一致`);
            } else {
                console.log(`✅ [删除检测] 未发现删除的内容块`);
            }

            // 使用数据库查询检测重复内容
            const newItems = await this.filterDuplicateItems(projectDoc.id, progressItems);
            
            if (newItems.length === 0) {
                console.log(`📋 项目 ${projectName} 没有新内容需要同步`);
                return;
            }

            // 按时间从远到近排序（因为使用prependBlock，最后插入的会在最上面）
            console.log(`🔍 [排序前] 进展项顺序:`, newItems.map(item => `${item.date}: ${item.content.substring(0, 50)}...`));
            newItems.sort((a, b) => {
                // 将日期字符串转换为Date对象进行比较
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateA.getTime() - dateB.getTime(); // 升序排列，最旧的在前，这样最新的最后插入到顶部
            });
            console.log(`🔍 [排序后] 进展项顺序:`, newItems.map(item => `${item.date}: ${item.content.substring(0, 50)}...`));
            console.log(`🔍 [插入逻辑] 使用prependBlock逐个插入，最后插入的(${newItems[newItems.length-1]?.date})会在文档顶部`);

            // 按排序后的顺序同步
            for (const item of newItems) {
                await this.addProgressToDocument(projectDoc.id, item);
                
                // 输出复制结果
                console.log(`📋 复制结果: 目标项目[${projectDoc.id}|${projectName}] ← 来源日记[${item.date}] | 内容: "${item.content}"`);
            }

            console.log(`✅ 项目 ${projectName} 同步完成，新增 ${newItems.length} 条进展`);
            pushMsg(`项目 ${projectName} 同步完成，新增 ${newItems.length} 条进展`, 3000);
        } catch (error) {
            console.error(`❌ 同步项目 ${projectName} 时发生错误:`, error.message);
            pushMsg(`同步项目 ${projectName} 时发生错误: ${error.message}`, 5000);
        }
    }

    /**
     * 查找项目文档
     */
    private async findProjectDocument(projectName: string): Promise<any | null> {
        // 首先尝试精确匹配 - 使用大小写不敏感的匹配
        let query = `
            SELECT b.id, b.content, b.hpath
            FROM blocks b
            WHERE b.type = 'd'
            AND LOWER(b.hpath) LIKE LOWER('%${this.config.projectPath}%')
            AND (b.content = '${projectName}' OR LOWER(b.hpath) LIKE LOWER('%${projectName}%'))
            LIMIT 1
        `;

        let docs = await sql(query);
        
        if (docs.length === 0) {
            // 尝试模糊匹配 - 使用大小写不敏感的匹配
            query = `
                SELECT b.id, b.content, b.hpath
                FROM blocks b
                WHERE b.type = 'd'
                AND LOWER(b.hpath) LIKE LOWER('%${this.config.projectPath}%')
                AND LOWER(b.content) LIKE LOWER('%${projectName}%')
                LIMIT 1
            `;
            docs = await sql(query);
        }

        if (docs.length > 0) {
            return docs[0];
        } else {
            return null;
        }
    }

    /**
     * 将进展内容添加到项目文档
     */
    private async addProgressToDocument(docId: string, item: ProgressItem): Promise<void> {
        // 尝试从blockId中提取真实的文档ID（如果是真实的块ID）
        let diaryDocId: string | null = null;
        
        // 检查blockId是否是真实的思源笔记块ID（20位数字字符串格式）
        if (item.blockId && /^[0-9]{14}-[a-z0-9]{7}$/.test(item.blockId)) {
            // 如果是真实的块ID，尝试获取其对应的文档
            try {
                const query = `
                    SELECT b.root_id
                    FROM blocks b
                    WHERE b.id = '${item.blockId}'
                    LIMIT 1
                `;
                const result = await sql(query);
                if (result.length > 0) {
                    diaryDocId = result[0].root_id;
                }
            } catch (error) {
                console.warn(`无法从blockId获取文档ID: ${item.blockId}`, error);
            }
        }
        
        // 如果没有从blockId获取到文档ID，尝试通过日期查找日记文档
        if (!diaryDocId) {
            diaryDocId = await this.findDiaryDocumentByDateExact(item.date);
        }
        
        let dateReference: string;
        if (diaryDocId) {
            // 如果找到了日记文档ID，获取其实际日期
            const actualDate = await this.getDocumentDate(diaryDocId);
            const displayDate = actualDate || item.date;
            
            // 创建文档引用，使用实际的日期
            dateReference = `((${diaryDocId} "${displayDate}"))`;
            
            console.log(`📅 [日期引用] 找到日记文档ID: ${diaryDocId}, 实际日期: ${actualDate}, 显示日期: ${displayDate}`);
        } else {
            // 如果没有找到对应的日记文档，直接使用item.date作为普通文本
            dateReference = `【【${item.date}】】`;
            console.log(`📅 [日期引用] 未找到对应日记文档，使用普通文本日期: ${item.date}`);
        }
        
        // 构造进展内容，格式：日期引用 + 换行 + 内容
        const progressContent = `${dateReference}\n${item.content}`;
        
        // 计算内容哈希 - 使用与initializeHashRecords相同的内容处理逻辑
        const normalizedContent = this.extractActualContent(item.content);
        const contentHash = this.generateContentHash(normalizedContent);
        
        // 检查是否需要替换同一日期的内容
        const replaceInfo = this.shouldReplaceContent(docId, item.date, contentHash);
        
        if (replaceInfo.shouldReplace && replaceInfo.blockId) {
            // 精确替换：删除旧块，在相同位置插入新块
            console.log(`🔄 [精确替换] 检测到同一日期 ${item.date} 的内容变化，删除旧块 ${replaceInfo.blockId}`);
            console.log(`🔄 [精确替换] 旧哈希: ${replaceInfo.blockId ? this.getDateBlockInfo(docId, item.date)?.hash : 'unknown'}`);
            console.log(`🔄 [精确替换] 新哈希: ${contentHash}`);
            console.log(`🔄 [精确替换] 新内容: "${progressContent}"`);
            
            try {
                // 1. 获取旧块的位置信息
                const oldBlock = await getBlockKramdown(replaceInfo.blockId);
                console.log(`🔄 [精确替换] 旧块内容: "${oldBlock?.kramdown || 'empty'}"`);
                
                // 2. 获取旧块的父块和前一个兄弟块，用于确定插入位置
                const allBlocks = await getChildBlocks(docId);
                let previousBlockId: string | undefined;
                let parentBlockId: string = docId; // 默认父块是文档本身
                
                // 查找旧块的位置信息
                for (let i = 0; i < allBlocks.length; i++) {
                    if (allBlocks[i].id === replaceInfo.blockId) {
                        // 找到了旧块，记录前一个块的ID（如果存在）
                        if (i > 0) {
                            previousBlockId = allBlocks[i - 1].id;
                        }
                        break;
                    }
                }
                
                console.log(`🔄 [精确替换] 位置信息 - 父块: ${parentBlockId}, 前一块: ${previousBlockId || 'none'}`);
                
                // 3. 删除旧块
                console.log(`🗑️ [精确替换] 删除旧块 ${replaceInfo.blockId}`);
                await deleteBlock(replaceInfo.blockId);
                
                // 4. 在相同位置插入新块
                let insertResult;
                if (previousBlockId) {
                    // 如果有前一个块，在其后插入
                    console.log(`➕ [精确替换] 在块 ${previousBlockId} 后插入新内容`);
                    insertResult = await insertBlock("markdown", progressContent, undefined, previousBlockId, parentBlockId);
                } else {
                    // 如果没有前一个块，在文档开头插入
                    console.log(`➕ [精确替换] 在文档开头插入新内容`);
                    insertResult = await prependBlock("markdown", progressContent, parentBlockId);
                }
                
                // 5. 获取新块ID
                let newBlockId = "unknown-block-id";
                if (insertResult && insertResult.length > 0 && insertResult[0].doOperations && insertResult[0].doOperations.length > 0) {
                    newBlockId = insertResult[0].doOperations[0].id;
                    console.log(`✅ [精确替换] 成功创建新块: ${newBlockId}`);
                } else {
                    console.warn(`⚠️ [精确替换] 无法从插入结果中提取块ID`);
                }
                
                // 6. 更新记录
                this.addContentHash(docId, contentHash);
                this.addDateBlockMapping(docId, item.date, newBlockId, contentHash);
                console.log(`✅ [精确替换] 成功替换日期 ${item.date} 的内容，新块ID: ${newBlockId}`);
                
            } catch (error) {
                console.error(`❌ [精确替换] 替换失败:`, error);
                // 如果替换失败，回退到添加新内容
                console.log(`🔄 [精确替换] 替换失败，回退到添加新内容`);
                const result = await prependBlock("markdown", progressContent, docId);
                
                let newBlockId = "unknown-block-id";
                if (result && result.length > 0 && result[0].doOperations && result[0].doOperations.length > 0) {
                    newBlockId = result[0].doOperations[0].id;
                }
                
                this.addContentHash(docId, contentHash);
                this.addDateBlockMapping(docId, item.date, newBlockId, contentHash);
            }
        } else {
            // 添加新内容到文档最上方
            console.log(`➕ [新增内容] 添加新的进展内容到项目文档，日期: ${item.date}`);
            const result = await prependBlock("markdown", progressContent, docId);
            
            // 从prependBlock的返回结果中提取新创建的块ID
            let newBlockId = "unknown-block-id";
            if (result && result.length > 0 && result[0].doOperations && result[0].doOperations.length > 0) {
                newBlockId = result[0].doOperations[0].id;
                console.log(`✅ [新增内容] 成功获取新创建的块ID: ${newBlockId}`);
            } else {
                console.warn(`⚠️ [新增内容] 无法从prependBlock结果中提取块ID，使用占位符`);
            }
            
            // 保存内容哈希到本地记录
            this.addContentHash(docId, contentHash);
            
            // 添加到日期块映射，使用真实的块ID
            this.addDateBlockMapping(docId, item.date, newBlockId, contentHash);
        }
        
        console.log(`💾 [哈希记录] 已保存内容哈希: ${contentHash} 到项目文档: ${docId}`);
    }

    /**
     * 根据日期查找对应的日记文档ID
     */
    private async findDiaryDocumentByDate(date: string): Promise<string | null> {
        try {
            // 构建可能的日记路径模式
            const searchPaths = this.parseTemplatePath(this.config.diaryPath, new Date(date));
            
            for (const searchPath of searchPaths) {
                // 查询包含该日期的文档
                const query = `
                    SELECT b.id, b.content, b.hpath
                    FROM blocks b
                    WHERE b.type = 'd'
                    AND (
                        LOWER(b.hpath) LIKE LOWER('%${searchPath}%')
                        OR LOWER(b.content) LIKE LOWER('%${date}%')
                        OR b.hpath LIKE '%${date}%'
                    )
                    LIMIT 1
                `;
                
                const docs = await sql(query);
                if (docs.length > 0) {
                    return docs[0].id;
                }
            }
            
            return null;
        } catch (error) {
            console.error(`查找日记文档失败 (${date}):`, error);
            return null;
        }
    }

    /**
     * 精确查找指定日期的日记文档
     */
    private async findDiaryDocumentByDateExact(date: string): Promise<string | null> {
        try {
            // 首先尝试精确匹配路径中包含日期的文档
            const query1 = `
                SELECT b.id, b.hpath
                FROM blocks b
                WHERE b.type = 'd'
                AND b.hpath LIKE '%${date}%'
                ORDER BY LENGTH(b.hpath) ASC
                LIMIT 1
            `;
            
            const docs1 = await sql(query1);
            if (docs1.length > 0) {
                console.log(`📅 [精确查找] 通过路径找到日记文档: ${docs1[0].hpath} -> ${docs1[0].id}`);
                return docs1[0].id;
            }
            
            // 如果路径匹配失败，尝试匹配文档标题
            const query2 = `
                SELECT b.id, b.content
                FROM blocks b
                WHERE b.type = 'd'
                AND b.content LIKE '%${date}%'
                ORDER BY LENGTH(b.content) ASC
                LIMIT 1
            `;
            
            const docs2 = await sql(query2);
            if (docs2.length > 0) {
                console.log(`📅 [精确查找] 通过标题找到日记文档: ${docs2[0].content} -> ${docs2[0].id}`);
                return docs2[0].id;
            }
            
            // 如果还是找不到，尝试解析日期格式进行更灵活的匹配
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            
            // 尝试不同的日期格式
            const dateFormats = [
                `${year}-${month}-${day}`,
                `${year}/${month}/${day}`,
                `${year}.${month}.${day}`,
                `${month}-${day}`,
                `${month}/${day}`
            ];
            
            for (const format of dateFormats) {
                const query3 = `
                    SELECT b.id, b.hpath, b.content
                    FROM blocks b
                    WHERE b.type = 'd'
                    AND (b.hpath LIKE '%${format}%' OR b.content LIKE '%${format}%')
                    ORDER BY LENGTH(b.hpath) ASC
                    LIMIT 1
                `;
                
                const docs3 = await sql(query3);
                if (docs3.length > 0) {
                    console.log(`📅 [精确查找] 通过格式${format}找到日记文档: ${docs3[0].hpath} -> ${docs3[0].id}`);
                    return docs3[0].id;
                }
            }
            
            console.log(`📅 [精确查找] 未找到日期${date}对应的日记文档`);
            return null;
        } catch (error) {
            console.error(`精确查找日记文档失败 (${date}):`, error);
            return null;
        }
    }

    /**
     * 根据文档ID获取正确的日期
     */
    private async getDocumentDate(docId: string): Promise<string | null> {
        try {
            const query = `
                SELECT b.id, b.content, b.hpath, b.created
                FROM blocks b
                WHERE b.id = '${docId}' AND b.type = 'd'
                LIMIT 1
            `;
            
            const docs = await sql(query);
            if (docs.length === 0) {
                return null;
            }
            
            const doc = docs[0];
            
            // 首先尝试从路径中提取日期（日记的展示日期通常在路径中）
            if (doc.hpath) {
                const dateFromPath = this.extractDateFromPath(doc.hpath);
                if (dateFromPath) {
                    console.log(`📅 [日期提取] 从路径提取日期: ${doc.hpath} -> ${dateFromPath}`);
                    return dateFromPath;
                }
            }
            
            // 然后尝试从文档标题中提取日期
            if (doc.content) {
                const dateFromContent = this.extractDateFromPath(doc.content);
                if (dateFromContent) {
                    console.log(`📅 [日期提取] 从内容提取日期: ${doc.content} -> ${dateFromContent}`);
                    return dateFromContent;
                }
            }
            
            // 接着尝试从文档ID前8位提取日期（作为备用）
            const dateFromId = this.extractDateFromDocumentId(docId);
            if (dateFromId) {
                console.log(`📅 [日期提取] 从文档ID提取日期: ${docId} -> ${dateFromId}`);
                return dateFromId;
            }
            
            // 最后使用创建时间
            if (doc.created) {
                const createdDate = new Date(parseInt(doc.created));
                const dateFromCreated = createdDate.toISOString().split('T')[0];
                console.log(`📅 [日期提取] 从创建时间提取日期: ${doc.created} -> ${dateFromCreated}`);
                return dateFromCreated;
            }
            
            return null;
        } catch (error) {
            console.error(`获取文档日期失败 (${docId}):`, error);
            return null;
        }
    }

    /**
     * 从文档ID前8位提取日期
     * 思源笔记的文档ID格式通常是：YYYYMMDDHHMMSS-随机字符
     */
    private extractDateFromDocumentId(docId: string): string | null {
        try {
            if (!docId || docId.length < 8) {
                return null;
            }
            
            // 提取前8位
            const dateStr = docId.substring(0, 8);
            
            // 验证是否为有效的日期格式 YYYYMMDD
            if (!/^\d{8}$/.test(dateStr)) {
                return null;
            }
            
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            
            // 验证日期的有效性
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (date.getFullYear() != parseInt(year) || 
                date.getMonth() != parseInt(month) - 1 || 
                date.getDate() != parseInt(day)) {
                return null;
            }
            
            // 返回 YYYY-MM-DD 格式
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error(`从文档ID提取日期失败 (${docId}):`, error);
            return null;
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<SyncConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 使用直接API提取文档内容（最后的备选方案）
     */
    private async extractProgressDirectly(docId: string, date: string): Promise<ProgressItem[]> {
        const progressItems: ProgressItem[] = [];
        
        try {
            // 首先尝试获取文档的JSON结构数据
            const jsonItems = await this.extractProgressFromJsonStructure(docId, date);
            if (jsonItems.length > 0) {
                progressItems.push(...jsonItems);
                return progressItems;
            }
            
            // 如果JSON结构提取失败，回退到Markdown方式
            const mdResult = await exportMdContent(docId);
            if (!mdResult || !mdResult.content) {
                return progressItems;
            }
            
            const content = mdResult.content;
            
            // 解析Markdown内容，查找项目进展
            const extractedItems = this.parseMarkdownForProgress(content, date, docId);
            progressItems.push(...extractedItems);
            
        } catch (error) {
            console.error(`直接API提取失败:`, error);
        }
        
        return progressItems;
    }

    /**
     * 从JSON结构中提取进展内容（新方法）
     */
    private async extractProgressFromJsonStructure(docId: string, date: string): Promise<ProgressItem[]> {
        const progressItems: ProgressItem[] = [];
        
        try {
            console.log(`🔍 [JSON结构] 开始分析文档结构...`);
            
            // 首先使用getChildBlocks API获取原始JSON结构，保持正确的顺序
            const originalBlocks = await getChildBlocks(docId);
            console.log(`🔍 [JSON结构] 获取到原始JSON结构:`, JSON.stringify(originalBlocks, null, 2));
            
            if (!originalBlocks || originalBlocks.length === 0) {
                console.log(`🔍 [JSON结构] 文档没有子块`);
                return progressItems;
            }
            
            // 扁平化原始结构，保持顺序
            const allBlocks = this.flattenBlocks(originalBlocks);
            console.log(`🔍 [JSON结构] 扁平化后获得 ${allBlocks.length} 个块`);
            
            // 为了获取完整的markdown内容，对每个块进行内容丰富
            for (let i = 0; i < allBlocks.length; i++) {
                const block = allBlocks[i];
                // 转换为扁平化格式，便于后续处理
                const flatBlock = {
                    id: block.ID || block.id,
                    type: this.convertBlockType(block.Type || block.type),
                    subtype: this.convertBlockSubtype(block),
                    content: this.extractAllTextFromBlock(block),
                    markdown: this.extractMarkdownFromBlock(block),
                    parent_id: block.ParentID || block.parent_id || '',
                    root_id: docId
                };
                allBlocks[i] = flatBlock;
            }
            console.log(`🔍 [JSON结构] 共 ${allBlocks.length} 个块`);
            
            // 打印每个块的详细信息
            for (let i = 0; i < allBlocks.length; i++) {
                const block = allBlocks[i];
                console.log(`🔍 [JSON结构] 块 ${i}:`, JSON.stringify(block, null, 2));
            }
            
            // 查找所有包含项目引用的块
            const projectRefBlocks = this.findProjectRefBlocks(allBlocks);
            console.log(`🔍 [JSON结构] 找到 ${projectRefBlocks.length} 个包含项目引用的块`);
            
            // 输出找到的项目引用详情
            for (let i = 0; i < projectRefBlocks.length; i++) {
                const refBlock = projectRefBlocks[i];
                console.log(`🔍 [JSON结构] 块 ${i}: ID=${refBlock.block.ID}, 项目引用数=${refBlock.projectRefs.length}`);
                for (const ref of refBlock.projectRefs) {
                    console.log(`🔍 [JSON结构]   - 项目: "${ref.name}" (ID: ${ref.id}, 位置: ${ref.position})`);
                }
            }
            
            // 为每个项目引用提取内容
            for (let i = 0; i < projectRefBlocks.length; i++) {
                const refBlock = projectRefBlocks[i];
                const nextRefBlock = projectRefBlocks[i + 1];
                
                console.log(`🔍 [JSON结构] 处理第 ${i} 个引用块...`);
                const extractedItems = this.extractContentForProjectRef(
                    refBlock, 
                    nextRefBlock, 
                    allBlocks, 
                    date, 
                    i
                );
                console.log(`🔍 [JSON结构] 从第 ${i} 个引用块提取到 ${extractedItems.length} 个进展项`);
                progressItems.push(...extractedItems);
            }
            
        } catch (error) {
            console.error(`🔍 [JSON结构] 提取失败:`, error);
        }
        
        return progressItems;
    }

    /**
     * 扁平化块结构，保持顺序
     */
    private flattenBlocks(blocks: any[]): any[] {
        const flattened: any[] = [];
        
        const flatten = (blockList: any[]) => {
            for (const block of blockList) {
                flattened.push(block);
                if (block.Children && block.Children.length > 0) {
                    flatten(block.Children);
                }
            }
        };
        
        flatten(blocks);
        return flattened;
    }

    /**
     * 查找所有包含项目引用的块
     */
    private findProjectRefBlocks(blocks: any[]): Array<{block: any, projectRefs: Array<{name: string, id: string, position: number}>}> {
        const refBlocks: Array<{block: any, projectRefs: Array<{name: string, id: string, position: number}>}> = [];
        
        console.log(`🔍 [引用查找] 开始在 ${blocks.length} 个块中查找项目引用...`);
        
        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
            const block = blocks[blockIndex];
            console.log(`🔍 [引用查找] 检查块 ${blockIndex}: id=${block.id}, type=${block.type}`);
            
            const projectRefs: Array<{name: string, id: string, position: number}> = [];
            
            // 从markdown字段中提取块引用
            const markdown = block.markdown || '';
            console.log(`🔍 [引用查找] 块 ${blockIndex} markdown内容: "${markdown}"`);
            
            if (markdown) {
                // 使用正则表达式匹配块引用格式: ((blockId 'text'))
                const blockRefRegex = /\(\(([^'\s]+)\s+'([^']+)'\)\)/g;
                let match;
                let position = 0;
                
                while ((match = blockRefRegex.exec(markdown)) !== null) {
                    const blockId = match[1];
                    const projectName = match[2];
                    
                    console.log(`🔍 [引用查找]   ✅ 找到块引用: 项目名="${projectName}", 块ID="${blockId}"`);
                    
                    if (projectName && blockId) {
                        projectRefs.push({
                            name: projectName,
                            id: blockId,
                            position: position++
                        });
                    }
                }
            }
            
            if (projectRefs.length > 0) {
                console.log(`🔍 [引用查找] 块 ${blockIndex} 包含 ${projectRefs.length} 个项目引用`);
                refBlocks.push({ block, projectRefs });
            }
        }
        
        console.log(`🔍 [引用查找] 总共找到 ${refBlocks.length} 个包含项目引用的块`);
        return refBlocks;
    }

    /**
     * 为项目引用提取内容
     */
    private extractContentForProjectRef(
        currentRefBlock: {block: any, projectRefs: Array<{name: string, id: string, position: number}>},
        nextRefBlock: {block: any, projectRefs: Array<{name: string, id: string, position: number}>} | undefined,
        allBlocks: any[],
        date: string,
        index: number
    ): ProgressItem[] {
        const progressItems: ProgressItem[] = [];
        
        const currentBlock = currentRefBlock.block;
        const currentBlockIndex = allBlocks.indexOf(currentBlock);
        
        // 为当前块中的每个项目引用提取内容
        for (let refIndex = 0; refIndex < currentRefBlock.projectRefs.length; refIndex++) {
            const currentRef = currentRefBlock.projectRefs[refIndex];
            const nextRef = currentRefBlock.projectRefs[refIndex + 1];
            
            console.log(`🔍 [跨块内容提取] 开始为项目引用 "${currentRef.name}" 提取内容`);
            
            // 1. 提取当前块内引用后的内容
            const inlineContent = this.extractInlineContent(currentBlock, currentRef, nextRef);
            console.log(`🔍 [跨块内容提取] 当前块内容: "${inlineContent}"`);
            
            // 2. 提取后续块的内容，直到下一个项目引用或截止信号
            const subsequentContent = this.extractSubsequentContentUntilStop(
                allBlocks, 
                currentBlockIndex, 
                currentRef,
                nextRef,
                nextRefBlock
            );
            console.log(`🔍 [跨块内容提取] 后续块内容: "${subsequentContent}"`);
            
            // 3. 合并内容
            let finalContent = '';
            if (inlineContent.trim()) {
                finalContent = inlineContent.trim();
            }
            if (subsequentContent.trim()) {
                if (finalContent) {
                    finalContent += '\n' + subsequentContent.trim();
                } else {
                    finalContent = subsequentContent.trim();
                }
            }
            
            console.log(`🔍 [跨块内容提取] 项目引用 "${currentRef.name}" 的最终内容: "${finalContent}"`);
            
            // 4. 创建进展项
            if (finalContent && finalContent !== currentRef.name) {
                progressItems.push({
                    date,
                    blockId: currentBlock.id || currentBlock.ID || `${date}_${index}_${refIndex}`,
                    content: finalContent,
                    projectRefs: [{name: currentRef.name, id: currentRef.id}]
                });
            } else {
                // 没有有效内容，使用项目名
                progressItems.push({
                    date,
                    blockId: currentBlock.id || currentBlock.ID || `${date}_${index}_${refIndex}`,
                    content: currentRef.name,
                    projectRefs: [{name: currentRef.name, id: currentRef.id}]
                });
            }
        }
        
        return progressItems;
    }

    /**
     * 提取同一块内的内容
     */
    private extractInlineContent(
        block: any, 
        currentRef: {name: string, id: string, position: number}, 
        nextRef?: {name: string, id: string, position: number}
    ): string {
        const markdown = block.markdown || '';
        console.log(`🔍 [内容提取] 开始提取内容，markdown: "${markdown}"`);
        console.log(`🔍 [内容提取] 当前引用: "${currentRef.name}", 下一个引用: "${nextRef?.name || 'none'}"`);
        
        if (!markdown) {
            console.log(`🔍 [内容提取] markdown为空，返回空字符串`);
            return '';
        }
        
        // 从markdown中提取块引用后的内容
        const blockRefRegex = /\(\(([^'\s]+)\s+'([^']+)'\)\)/g;
        let match;
        const refPositions: Array<{start: number, end: number, name: string}> = [];
        
        // 找到所有块引用的位置
        while ((match = blockRefRegex.exec(markdown)) !== null) {
            refPositions.push({
                start: match.index,
                end: match.index + match[0].length,
                name: match[2]
            });
        }
        
        console.log(`🔍 [内容提取] 找到的引用位置:`, refPositions);
        
        // 找到当前引用的位置
        const currentRefPos = refPositions.find(pos => pos.name === currentRef.name);
        if (!currentRefPos) {
            console.log(`🔍 [内容提取] 未找到当前引用 "${currentRef.name}" 的位置`);
            return '';
        }
        
        console.log(`🔍 [内容提取] 当前引用位置:`, currentRefPos);
        
        // 确定内容提取的起始和结束位置
        const startPos = currentRefPos.end;
        let endPos = markdown.length;
        
        // 如果有下一个引用，以下一个引用的开始位置为结束
        if (nextRef) {
            const nextRefPos = refPositions.find(pos => pos.name === nextRef.name);
            if (nextRefPos) {
                endPos = nextRefPos.start;
                console.log(`🔍 [内容提取] 找到下一个引用位置，结束位置设为: ${endPos}`);
            }
        }
        
        console.log(`🔍 [内容提取] 提取范围: ${startPos} - ${endPos}`);
        
        // 提取内容并清理
        const content = markdown.substring(startPos, endPos).trim();
        console.log(`🔍 [内容提取] 提取到的内容: "${content}"`);
        
        return content;
    }

    /**
     * 提取后续块的内容，直到下一个项目引用或截止信号
     */
    private extractSubsequentContentUntilStop(
        allBlocks: any[], 
        currentBlockIndex: number, 
        currentRef: {name: string, id: string, position: number},
        nextRef?: {name: string, id: string, position: number},
        nextRefBlock?: {block: any, projectRefs: Array<{name: string, id: string, position: number}>}
    ): string {
        const contentParts: string[] = [];
        
        console.log(`🔍 [截止信号检测] 开始提取后续内容，当前块索引: ${currentBlockIndex}`);
        
        // 从下一个块开始遍历
        for (let i = currentBlockIndex + 1; i < allBlocks.length; i++) {
            const block = allBlocks[i];
            
            console.log(`🔍 [截止信号检测] 检查块 ${i}: type="${block.type}", subtype="${block.subtype}", markdown="${block.markdown}"`);
            
            // 检查是否遇到截止信号
            if (this.isStopSignal(block)) {
                console.log(`🔍 [截止信号检测] 遇到截止信号，停止提取`);
                break;
            }
            
            // 检查是否遇到下一个项目引用块
            if (nextRefBlock && block.id === nextRefBlock.block.id) {
                console.log(`🔍 [截止信号检测] 遇到下一个项目引用块，停止提取`);
                break;
            }
            
            // 检查当前块是否包含项目引用
            if (this.blockContainsProjectRef(block)) {
                console.log(`🔍 [截止信号检测] 遇到包含项目引用的块，停止提取`);
                break;
            }
            
            // 提取块内容
            const blockContent = this.extractAllTextFromBlock(block);
            if (blockContent && blockContent.trim()) {
                console.log(`🔍 [截止信号检测] 添加块内容: "${blockContent.trim()}"`);
                contentParts.push(blockContent.trim());
            }
        }
        
        const result = contentParts.join('\n');
        console.log(`🔍 [截止信号检测] 最终后续内容: "${result}"`);
        return result;
    }

    /**
     * 检查是否为截止信号（二级标题"今日思考"）
     */
    private isStopSignal(block: any): boolean {
        // 检查是否为二级标题
        if (block.type === 'h' && block.subtype === 'h2') {
            const content = block.content || block.markdown || '';
            // 检查是否包含"今日思考"
            if (content.includes('今日思考')) {
                return true;
            }
        }
        return false;
    }

    /**
     * 提取后续块的内容
     */
    private extractSubsequentBlocksContent(
        allBlocks: any[], 
        currentBlockIndex: number, 
        nextRefBlock?: any
    ): string {
        let content = '';
        const nextRefBlockIndex = nextRefBlock ? allBlocks.indexOf(nextRefBlock) : allBlocks.length;
        
        console.log(`🔍 [后续内容提取] 当前块索引: ${currentBlockIndex}, 下一个引用块索引: ${nextRefBlockIndex}, 总块数: ${allBlocks.length}`);
        
        // 收集当前块之后到下一个项目引用块之前的所有内容
        for (let i = currentBlockIndex + 1; i < nextRefBlockIndex; i++) {
            const block = allBlocks[i];
            const blockContent = this.extractAllTextFromBlock(block);
            console.log(`🔍 [后续内容提取] 块${i}: id=${block.id}, type=${block.type}, content="${blockContent}"`);
            if (blockContent.trim()) {
                content += (content ? '\n' : '') + blockContent.trim();
            }
        }
        
        console.log(`🔍 [后续内容提取] 最终提取的后续内容: "${content}"`);
        return content;
    }

    /**
     * 从单个块中提取项目进展
     */
    private extractProgressFromBlock(block: any, date: string, index: number): ProgressItem[] {
        const progressItems: ProgressItem[] = [];
        
        if (!block || !block.Children) {
            return progressItems;
        }
        
        // 处理当前块中的项目引用和内容
        const blockItems = this.extractProgressFromSingleBlock(block, date, index);
        progressItems.push(...blockItems);
        
        // 递归处理子块（如列表项）
        if (block.Children) {
            for (let i = 0; i < block.Children.length; i++) {
                const child = block.Children[i];
                if (child.Children && child.Type !== 'NodeTextMark') {
                    const nestedItems = this.extractProgressFromBlock(child, date, index * 100 + i);
                    progressItems.push(...nestedItems);
                }
            }
        }
        
        return progressItems;
    }

    /**
     * 从单个块中提取项目引用和内容
     */
    private extractProgressFromSingleBlock(block: any, date: string, index: number): ProgressItem[] {
        const progressItems: ProgressItem[] = [];
        
        if (!block || !block.Children) {
            return progressItems;
        }
        
        // 查找所有项目文档引用的位置
        const projectRefPositions: Array<{index: number, projectName: string, blockRefId: string}> = [];
        
        for (let i = 0; i < block.Children.length; i++) {
            const child = block.Children[i];
            if (child.Type === 'NodeTextMark' && child.TextMarkType === 'block-ref') {
                const projectName = child.TextMarkTextContent || child.TextMarkBlockRefID;
                if (projectName) {
                    projectRefPositions.push({
                        index: i,
                        projectName: projectName,
                        blockRefId: child.TextMarkBlockRefID
                    });
                    console.log(`找到项目文档引用: ${projectName} (ID: ${child.TextMarkBlockRefID}) 位置: ${i}`);
                }
            }
        }
        
        // 如果没有找到项目引用，直接返回
        if (projectRefPositions.length === 0) {
            return progressItems;
        }
        
        // 为每个项目引用提取对应的内容
        for (let refIndex = 0; refIndex < projectRefPositions.length; refIndex++) {
            const currentRef = projectRefPositions[refIndex];
            const nextRef = projectRefPositions[refIndex + 1];
            
            // 确定内容提取的范围：从当前引用后开始，到下一个引用前结束
            const startIndex = currentRef.index + 1;
            const endIndex = nextRef ? nextRef.index : block.Children.length;
            
            // 提取这个范围内的所有文本内容
            let content = '';
            for (let i = startIndex; i < endIndex; i++) {
                const child = block.Children[i];
                if (child.Type === 'NodeText') {
                    content += child.Data || '';
                }
            }
            
            // 清理和验证内容
            content = content.trim();
            
            if (content) {
                // 有内容，创建进展项
                progressItems.push({
                    date,
                    blockId: block.ID || `${date}_${index}_${refIndex}`,
                    content: content,
                    projectRefs: [{name: currentRef.projectName, id: currentRef.blockRefId}]
                });
                console.log(`提取项目进展 - 项目: ${currentRef.projectName}, 内容: "${content}"`);
            } else {
                // 没有直接内容，需要查找后续的子块内容
                const subsequentContent = this.extractSubsequentContent(block, currentRef.index, nextRef?.index);
                
                if (subsequentContent.trim()) {
                    progressItems.push({
                        date,
                        blockId: block.ID || `${date}_${index}_${refIndex}`,
                        content: subsequentContent.trim(),
                        projectRefs: [{name: currentRef.projectName, id: currentRef.blockRefId}]
                    });
                    console.log(`提取项目进展（含子块） - 项目: ${currentRef.projectName}, 内容: "${subsequentContent.trim()}"`);
                } else {
                    // 完全没有内容，使用项目名作为内容
                    progressItems.push({
                        date,
                        blockId: block.ID || `${date}_${index}_${refIndex}`,
                        content: currentRef.projectName,
                        projectRefs: [{name: currentRef.projectName, id: currentRef.blockRefId}]
                    });
                    console.log(`提取项目引用（无内容） - 项目: ${currentRef.projectName}`);
                }
            }
        }
        
        return progressItems;
    }

    /**
     * 提取项目引用后续的所有内容（包括子块）
     */
    private extractSubsequentContent(block: any, startIndex: number, endIndex?: number): string {
        let content = '';
        
        if (!block || !block.Children) {
            return content;
        }
        
        const actualEndIndex = endIndex || block.Children.length;
        
        // 首先收集同级的文本内容
        for (let i = startIndex + 1; i < actualEndIndex; i++) {
            const child = block.Children[i];
            if (child.Type === 'NodeText') {
                content += child.Data || '';
            } else if (child.Type === 'NodeTextMark' && child.TextMarkType === 'block-ref') {
                // 遇到下一个项目引用，停止
                break;
            }
        }
        
        // 然后收集后续子块的内容（如列表项）
        const subsequentBlocks = this.findSubsequentBlocks(block, startIndex, endIndex);
        for (const subBlock of subsequentBlocks) {
            const subContent = this.extractAllTextFromBlock(subBlock);
            if (subContent.trim()) {
                content += (content ? ' ' : '') + subContent.trim();
            }
        }
        
        return content;
    }

    /**
     * 查找项目引用后的所有子块
     */
    private findSubsequentBlocks(parentBlock: any, startIndex: number, endIndex?: number): any[] {
        const blocks: any[] = [];
        
        if (!parentBlock || !parentBlock.Children) {
            return blocks;
        }
        
        // 查找父块后面的兄弟块
        let currentBlock = parentBlock;
        while (currentBlock && currentBlock.Next) {
            currentBlock = currentBlock.Next;
            
            // 如果遇到下一个项目引用，停止
            if (this.blockContainsProjectRef(currentBlock)) {
                break;
            }
            
            blocks.push(currentBlock);
        }
        
        return blocks;
    }

    /**
     * 检查块是否包含项目引用
     */
    private blockContainsProjectRef(block: any): boolean {
        // 检查扁平化块结构（来自SQL查询）
        const markdown = block.markdown || '';
        const content = block.content || '';
        
        // 检查是否包含块引用格式: ((blockId 'text'))
        const blockRefRegex = /\(\(([^'\s]+)\s+'([^']+)'\)\)/;
        
        if (blockRefRegex.test(markdown) || blockRefRegex.test(content)) {
            return true;
        }
        
        // 检查是否包含双括号引用格式: [[text]]
        const doubleRefRegex = /\[\[([^\]]+)\]\]/;
        if (doubleRefRegex.test(markdown) || doubleRefRegex.test(content)) {
            return true;
        }
        
        // 检查JSON结构（兼容旧格式）
        if (block.Children) {
            for (const child of block.Children) {
                if (child.Type === 'NodeTextMark' && child.TextMarkType === 'block-ref') {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 查找下一个不包含项目引用的内容块
     */
    private findNextContentBlock(allBlocks: any[], currentBlockIndex: number): any | null {
        for (let i = currentBlockIndex + 1; i < allBlocks.length; i++) {
            const block = allBlocks[i];
            
            // 跳过标题块
            if (block.type === 'h' || block.type === 'heading') {
                continue;
            }
            
            // 如果块包含项目引用，停止查找
            if (this.blockContainsProjectRef(block)) {
                break;
            }
            
            // 如果块有内容，返回该块
            const blockContent = this.extractAllTextFromBlock(block);
            if (blockContent && blockContent.trim()) {
                return block;
            }
        }
        
        return null;
    }

    /**
     * 转换块类型
     */
    private convertBlockType(type: string): string {
        const typeMap: {[key: string]: string} = {
            'NodeDocument': 'd',
            'NodeHeading': 'h',
            'NodeParagraph': 'p',
            'NodeList': 'l',
            'NodeListItem': 'i',
            'NodeBlockquote': 'b',
            'NodeSuperBlock': 's',
            'NodeCodeBlock': 'c',
            'NodeTable': 't',
            'NodeThematicBreak': 'tb',
            'NodeMathBlock': 'm',
            'NodeHTMLBlock': 'html'
        };
        return typeMap[type] || type.toLowerCase();
    }

    /**
     * 转换块子类型
     */
    private convertBlockSubtype(block: any): string {
        if (block.Type === 'NodeHeading' || block.type === 'h') {
            const level = block.HeadingLevel || block.subtype?.replace('h', '') || '1';
            return `h${level}`;
        }
        return block.SubType || block.subtype || '';
    }

    /**
     * 从块中提取markdown内容
     */
    private extractMarkdownFromBlock(block: any): string {
        if (block.markdown) {
            return block.markdown;
        }
        
        if (block.Children) {
            let markdown = '';
            for (const child of block.Children) {
                if (child.Type === 'NodeText') {
                    markdown += child.Data || '';
                } else if (child.Type === 'NodeTextMark' && child.TextMarkType === 'block-ref') {
                    markdown += `((${child.TextMarkBlockRefID} '${child.TextMarkTextContent}'))`;
                } else {
                    markdown += this.extractMarkdownFromBlock(child);
                }
            }
            return markdown;
        }
        
        return this.extractAllTextFromBlock(block);
    }

    /**
     * 从块中提取所有文本内容
     */
    private extractAllTextFromBlock(block: any): string {
        if (!block) {
            return '';
        }
        
        // 对于扁平化的块，优先使用 markdown 字段，然后是 content 字段
        if (block.markdown) {
            return block.markdown;
        }
        
        if (block.content) {
            return block.content;
        }
        
        // 兼容旧的 JSON 结构格式
        if (block.Type === 'NodeText') {
            return block.Data || '';
        }
        
        if (block.Children) {
            let content = '';
            for (const child of block.Children) {
                content += this.extractAllTextFromBlock(child);
            }
            return content;
        }
        
        return '';
    }

    /**
     * 解析Markdown内容，提取项目进展
     */
    private parseMarkdownForProgress(content: string, date: string, docId: string): ProgressItem[] {
        const progressItems: ProgressItem[] = [];
        
        // 按行分割内容
        const lines = content.split('\n');
        let inProgressSection = false;
        let currentBlockId = docId; // 使用文档ID作为默认块ID
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检查是否进入进展章节
            if (line.includes(this.config.progressSection)) {
                inProgressSection = true;
                console.log(`找到进展章节: ${line}`);
                continue;
            }
            
            // 如果遇到同级或更高级的标题，退出进展章节
            if (inProgressSection && line.match(/^##[^#]/) && !line.includes(this.config.progressSection)) {
                inProgressSection = false;
                continue;
            }
            
            // 在进展章节中查找内容
            if (inProgressSection && line) {
                // 检查是否是块引用格式
                const blockRefMatch = line.match(/\(\(([^'"\s]+)\s+['"]([^'"]+)['"]\)\)(.*)$/);
                if (blockRefMatch) {
                    const projectName = blockRefMatch[2];
                    const progressContent = blockRefMatch[3].trim();
                    
                    if (progressContent && progressContent !== projectName) {
                        // 混合格式：项目名在引用中，进展内容在后面
                        progressItems.push({
                            date,
                            blockId: currentBlockId + '_' + i, // 生成唯一ID
                            content: progressContent,
                            projectRefs: [{name: projectName}]
                        });
                        console.log(`解析到混合格式 - 项目: ${projectName}, 内容: ${progressContent}`);
                    } else if (projectName) {
                        // 纯引用格式：项目名就是内容
                        progressItems.push({
                            date,
                            blockId: currentBlockId + '_' + i,
                            content: projectName,
                            projectRefs: [{name: projectName}]
                        });
                        console.log(`解析到纯引用格式 - 项目: ${projectName}`);
                    }
                } else if (line.startsWith('-') || line.startsWith('*') || line.startsWith('+')) {
                    // 列表项格式
                    const listContent = line.substring(1).trim();
                    if (listContent && !listContent.includes(this.config.progressSection)) {
                        // 尝试从列表内容中提取项目引用
                        const projectRefs = this.extractProjectReferences(listContent);
                        if (projectRefs.length > 0) {
                            // 有明确的项目引用，直接使用内容
                            progressItems.push({
                                date,
                                blockId: currentBlockId + '_' + i,
                                content: this.cleanContent(listContent),
                                projectRefs
                            });
                            console.log(`解析到列表项（有引用） - 项目: ${projectRefs.map(ref => ref.name).join(', ')}, 内容: ${listContent}`);
                        } else {
                            // 没有项目引用，将内容本身作为项目名
                            progressItems.push({
                                date,
                                blockId: currentBlockId + '_' + i,
                                content: listContent,
                                projectRefs: [{name: listContent}]
                            });
                            console.log(`解析到列表项（无引用） - 内容: ${listContent}`);
                        }
                    }
                } else if (!line.startsWith('#')) {
                    // 普通段落
                    if (this.isValidProgressContent(line, line)) {
                        const projectRefs = this.extractProjectReferences(line);
                        if (projectRefs.length > 0) {
                            progressItems.push({
                                date,
                                blockId: currentBlockId + '_' + i,
                                content: this.cleanContent(line),
                                projectRefs
                            });
                            console.log(`解析到段落（有引用） - 项目: ${projectRefs.map(ref => ref.name).join(', ')}, 内容: ${line}`);
                        } else {
                            progressItems.push({
                                date,
                                blockId: currentBlockId + '_' + i,
                                content: line,
                                projectRefs: [{name: line}]
                            });
                            console.log(`解析到段落（无引用） - 内容: ${line}`);
                        }
                    }
                }
            }
        }
        
        return progressItems;
    }

    /**
     * 清除同步历史
     */
    clearSyncHistory(): void {
        // 基于数据库的重复检测不需要清除内存状态
        console.log('📋 同步历史已清除（基于数据库检测，无需清除内存状态）');
    }

    /**
     * 从日期匹配结果解析日期
     */
    private parseDateFromMatch(match: RegExpMatchArray, format: string): Date {
        const dateStr = match[0];
        
        // 根据格式解析日期
        if (format === 'YYYY-MM-DD') {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day);
        } else if (format === 'YY-MM-DD') {
            const [year, month, day] = dateStr.split('-').map(Number);
            const fullYear = year < 50 ? 2000 + year : 1900 + year; // 假设50年以下为21世纪
            return new Date(fullYear, month - 1, day);
        } else if (format === 'YYYY/MM/DD') {
            const [year, month, day] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        } else if (format === 'MM-DD') {
            const [month, day] = dateStr.split('-').map(Number);
            const currentYear = new Date().getFullYear();
            return new Date(currentYear, month - 1, day);
        } else if (format === 'YYYYMMDD') {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6));
            const day = parseInt(dateStr.substring(6, 8));
            return new Date(year, month - 1, day);
        }
        
        // 默认返回当前日期
        return new Date();
    }

    /**
     * 格式化日期为字符串
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 使用笔记本限定功能提取进展内容
     */
    private async extractProgressFromNotebookLimitation(): Promise<ProgressItem[]> {
        const progressItems: ProgressItem[] = [];
        
        try {
            // 获取指定笔记本的文档
            let documents: DocumentInfo[];
            
            if (this.config.onlyLeafDocuments) {
                console.log(`📄 获取笔记本 ${this.config.selectedNotebookId} 的叶子文档`);
                documents = await this.notebookService.getLeafDocuments(this.config.selectedNotebookId!);
            } else {
                console.log(`📄 获取笔记本 ${this.config.selectedNotebookId} 的所有文档`);
                documents = await this.notebookService.getDocumentsByNotebook(this.config.selectedNotebookId!);
            }
            
            console.log(`📄 找到 ${documents.length} 个文档`);
            
            // 按日期格式过滤文档
            const dateFormatConfig = this.notebookService.getSupportedDateFormats()
                .find(format => format.format === this.config.dateFormat);
            
            if (!dateFormatConfig) {
                console.warn(`⚠️ 不支持的日期格式: ${this.config.dateFormat}`);
                return progressItems;
            }
            
            const diaryDocuments = documents.filter(doc => {
                const hasDateInName = dateFormatConfig.pattern.test(doc.name);
                const hasDateInPath = dateFormatConfig.pattern.test(doc.hpath);
                return hasDateInName || hasDateInPath;
            });
            
            console.log(`📅 按日期格式 ${this.config.dateFormat} 过滤后，找到 ${diaryDocuments.length} 个日记文档`);
            
            // 从每个日记文档中提取内容
            for (const doc of diaryDocuments) {
                console.log(`📖 处理文档: ${doc.name} (${doc.id})`);
                
                // 提取指定标题下的内容
                const contents = await this.notebookService.extractContentUnderTitle(
                    doc.id, 
                    this.config.contentTitle
                );
                
                if (contents.length > 0) {
                    console.log(`📝 从文档 ${doc.name} 提取到 ${contents.length} 条内容`);
                    
                    // 解析日期
                    const dateMatch = doc.name.match(dateFormatConfig.pattern) || 
                                    doc.hpath.match(dateFormatConfig.pattern);
                    
                    if (dateMatch) {
                        const date = this.parseDateFromMatch(dateMatch, dateFormatConfig.format);
                        const dateString = this.formatDate(date);
                        
                        // 为每条内容创建ProgressItem
                        contents.forEach((content, index) => {
                            const projectRefs = this.extractProjectReferences(content);
                            
                            if (projectRefs.length > 0) {
                                progressItems.push({
                                    date: dateString,
                                    blockId: `${doc.id}_${index}`, // 临时ID
                                    content: content,
                                    projectRefs: projectRefs
                                });
                            }
                        });
                    }
                }
            }
            
            console.log(`✅ 笔记本限定模式提取完成，共 ${progressItems.length} 条进展记录`);
            return progressItems;
            
        } catch (error) {
            console.error("❌ 笔记本限定模式提取失败:", error);
            return progressItems;
        }
    }

    /**
     * 使用传统路径匹配方式提取进展内容
     */
    private async extractProgressFromPathMatching(): Promise<ProgressItem[]> {
        const progressItems: ProgressItem[] = [];

        // 获取搜索路径模式
        const pathPatterns = this.parseTemplatePath(this.config.diaryPath);
        console.log(`🔍 [调试] 解析日记路径模板: ${this.config.diaryPath}`);
        console.log(`🔍 [调试] 生成的路径模式: ${JSON.stringify(pathPatterns)}`);

        // 构建查询条件
        let whereConditions = [`b.type = 'd'`];
        console.log(`🔍 [调试] 基础查询条件: 文档类型 = 'd'`);
        
        // 添加笔记本限制条件
        if (this.config.notebookId) {
            whereConditions.push(`b.box = '${this.config.notebookId}'`);
            console.log(`🔍 [调试] 添加笔记本ID限制: ${this.config.notebookId}`);
        }

        // 添加路径匹配条件
        const pathConditions = pathPatterns.map(pattern => 
            `LOWER(b.hpath) LIKE LOWER('%${pattern}%')`
        ).join(' OR ');
        
        if (pathConditions) {
            whereConditions.push(`(${pathConditions})`);
            console.log(`🔍 [调试] 添加路径匹配条件: ${pathConditions}`);
        }

        const diaryQuery = `
            SELECT DISTINCT b.id, b.content, b.created, b.updated, b.hpath, b.box
            FROM blocks b
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY b.created DESC
        `;
        console.log(`🔍 [调试] 执行日记查询SQL: ${diaryQuery}`);

        const diaryDocs = await sql(diaryQuery);
        console.log(`🔍 [调试] 查询到 ${diaryDocs.length} 个日记文档`);
        
        if (diaryDocs.length > 0) {
            console.log(`🔍 [调试] 前3个文档示例:`);
            diaryDocs.slice(0, 3).forEach((doc, index) => {
                console.log(`  ${index + 1}. ID: ${doc.id}, 路径: ${doc.hpath}, 笔记本: ${doc.box}`);
            });
        }

        // 如果指定了笔记本名称但没有ID，尝试通过名称过滤
        let filteredDocs = diaryDocs;
        if (this.config.notebookName && !this.config.notebookId) {
            console.log(`🔍 [调试] 使用笔记本名称过滤: ${this.config.notebookName}`);
            
            // 获取所有笔记本信息进行名称匹配
            const notebookQuery = `
                SELECT DISTINCT b.box
                FROM blocks b
                WHERE b.type = 'd'
            `;
            const allNotebooks = await sql(notebookQuery);
            console.log(`🔍 [调试] 找到 ${allNotebooks.length} 个笔记本: ${allNotebooks.map(n => n.box).join(', ')}`);
            
            // 这里可以进一步实现笔记本名称到ID的映射
            // 暂时使用路径匹配作为替代方案
            filteredDocs = diaryDocs.filter(doc => 
                doc.hpath.toLowerCase().includes(this.config.notebookName.toLowerCase())
            );
            console.log(`🔍 [调试] 按笔记本名称过滤后剩余 ${filteredDocs.length} 个文档`);
        }

        console.log(`🔍 [调试] 开始处理 ${filteredDocs.length} 个文档，提取进展内容`);
        for (const doc of filteredDocs) {
            console.log(`🔍 [调试] 处理文档: ${doc.hpath} (ID: ${doc.id})`);
            const docProgressItems = await this.extractProgressFromDocument(doc.id, doc.hpath);
            console.log(`🔍 [调试] 从文档 ${doc.hpath} 提取到 ${docProgressItems.length} 个进展项`);
            progressItems.push(...docProgressItems);
        }

        console.log(`🔍 [调试] 总计提取到 ${progressItems.length} 个进展项`);
        return progressItems;
    }
}
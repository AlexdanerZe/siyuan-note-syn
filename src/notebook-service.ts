/**
 * 笔记本服务
 * 负责笔记本选择、叶子文档检测、日期格式生成等功能
 */

import { lsNotebooks, sql, getBlockKramdown, getChildBlocks } from "./api";

export interface NotebookInfo {
    id: string;
    name: string;
    icon: string;
    sort: number;
    closed: boolean;
}

export interface DocumentInfo {
    id: string;
    name: string;
    hpath: string;
    path: string;
    box: string;
    isLeaf: boolean;
    created: string;
    updated: string;
}

export interface DateFormatConfig {
    format: string;           // 日期格式，如 "YYYY-MM-DD", "YY-MM-DD"
    pattern: RegExp;          // 匹配正则表达式
    example: string;          // 示例格式
    description: string;      // 格式描述
}

export interface NotebookServiceConfig {
    selectedNotebookId?: string;
    selectedNotebookName?: string;
    dateFormat: string;
    contentTitle: string;     // 要挖掘内容的标题
    onlyLeafDocuments: boolean;
}

export class NotebookService {
    private config: NotebookServiceConfig;
    private supportedDateFormats: DateFormatConfig[] = [
        {
            format: "YYYY-MM-DD",
            pattern: /(\d{4})-(\d{2})-(\d{2})/,
            example: "2024-01-15",
            description: "标准ISO格式 (YYYY-MM-DD)"
        },
        {
            format: "YY-MM-DD", 
            pattern: /(\d{2})-(\d{2})-(\d{2})/,
            example: "24-01-15",
            description: "简短年份格式 (YY-MM-DD)"
        },
        {
            format: "YYYY年MM月DD日",
            pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
            example: "2024年01月15日",
            description: "中文日期格式"
        },
        {
            format: "YYYY/MM/DD",
            pattern: /(\d{4})\/(\d{2})\/(\d{2})/,
            example: "2024/01/15",
            description: "斜杠分隔格式"
        },
        {
            format: "YYYY.MM.DD",
            pattern: /(\d{4})\.(\d{2})\.(\d{2})/,
            example: "2024.01.15",
            description: "点分隔格式"
        }
    ];

    constructor(config: NotebookServiceConfig) {
        this.config = config;
    }

    /**
     * 获取所有笔记本列表
     */
    async getNotebooks(): Promise<NotebookInfo[]> {
        try {
            const result = await lsNotebooks();
            return result.notebooks.map(notebook => ({
                id: notebook.id,
                name: notebook.name,
                icon: notebook.icon,
                sort: notebook.sort,
                closed: notebook.closed
            }));
        } catch (error) {
            console.error("获取笔记本列表失败:", error);
            return [];
        }
    }

    /**
     * 根据笔记本ID获取所有文档
     */
    async getDocumentsByNotebook(notebookId: string): Promise<DocumentInfo[]> {
        try {
            const query = `
                SELECT DISTINCT 
                    b.id, 
                    b.content as name, 
                    b.hpath, 
                    b.path, 
                    b.box,
                    b.created,
                    b.updated
                FROM blocks b
                WHERE b.type = 'd' AND b.box = '${notebookId}'
                ORDER BY b.hpath
            `;
            
            const docs = await sql(query);
            
            // 检测叶子文档
            const documentsWithLeafInfo = await Promise.all(
                docs.map(async (doc) => {
                    const isLeaf = await this.isLeafDocument(doc.id);
                    return {
                        id: doc.id,
                        name: this.extractDocumentName(doc.name || doc.hpath),
                        hpath: doc.hpath,
                        path: doc.path,
                        box: doc.box,
                        isLeaf,
                        created: doc.created,
                        updated: doc.updated
                    };
                })
            );

            return documentsWithLeafInfo;
        } catch (error) {
            console.error("获取笔记本文档失败:", error);
            return [];
        }
    }

    /**
     * 获取指定笔记本的叶子文档
     */
    async getLeafDocuments(notebookId: string): Promise<DocumentInfo[]> {
        const allDocs = await this.getDocumentsByNotebook(notebookId);
        return allDocs.filter(doc => doc.isLeaf);
    }

    /**
     * 检测文档是否为叶子节点（没有子文档）
     */
    private async isLeafDocument(documentId: string): Promise<boolean> {
        try {
            // 首先获取当前文档的路径
            const currentDocQuery = `
                SELECT hpath, path
                FROM blocks
                WHERE id = '${documentId}' AND type = 'd'
            `;
            
            const currentDoc = await sql(currentDocQuery);
            if (!currentDoc || currentDoc.length === 0) {
                return false;
            }
            
            const currentPath = currentDoc[0].hpath;
            
            // 查找是否有子文档（路径以当前文档路径开头且层级更深）
            const childQuery = `
                SELECT COUNT(*) as childCount
                FROM blocks b
                WHERE b.type = 'd' 
                AND b.hpath LIKE '${currentPath}/%'
                AND b.id != '${documentId}'
            `;
            
            const result = await sql(childQuery);
            return result[0]?.childCount === 0;
        } catch (error) {
            console.error("检测叶子文档失败:", error);
            return false;
        }
    }

    /**
     * 根据日期格式生成日记路径
     */
    generateDiaryPath(date: Date, format: string): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const shortYear = String(year).slice(-2);

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
                return `${year}-${month}-${day}`;
        }
    }

    /**
     * 解析日期字符串
     */
    parseDate(dateString: string): Date | null {
        for (const formatConfig of this.supportedDateFormats) {
            const match = dateString.match(formatConfig.pattern);
            if (match) {
                let year: number, month: number, day: number;
                
                switch (formatConfig.format) {
                    case "YYYY-MM-DD":
                    case "YYYY/MM/DD":
                    case "YYYY.MM.DD":
                        year = parseInt(match[1]);
                        month = parseInt(match[2]) - 1; // JavaScript月份从0开始
                        day = parseInt(match[3]);
                        break;
                    case "YY-MM-DD":
                        year = 2000 + parseInt(match[1]); // 假设21世纪
                        month = parseInt(match[2]) - 1;
                        day = parseInt(match[3]);
                        break;
                    case "YYYY年MM月DD日":
                        year = parseInt(match[1]);
                        month = parseInt(match[2]) - 1;
                        day = parseInt(match[3]);
                        break;
                    default:
                        continue;
                }
                
                return new Date(year, month, day);
            }
        }
        return null;
    }

    /**
     * 根据日期和格式查找日记文档
     */
    async findDiaryByDate(date: Date, notebookId?: string): Promise<DocumentInfo | null> {
        const dateString = this.generateDiaryPath(date, this.config.dateFormat);
        
        try {
            let whereConditions = [`b.type = 'd'`];
            
            if (notebookId || this.config.selectedNotebookId) {
                whereConditions.push(`b.box = '${notebookId || this.config.selectedNotebookId}'`);
            }
            
            // 使用多种匹配方式查找日记
            const pathConditions = [
                `b.hpath LIKE '%${dateString}%'`,
                `b.content LIKE '%${dateString}%'`,
                `b.path LIKE '%${dateString}%'`
            ].join(' OR ');
            
            whereConditions.push(`(${pathConditions})`);
            
            const query = `
                SELECT DISTINCT b.id, b.content as name, b.hpath, b.path, b.box, b.created, b.updated
                FROM blocks b
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY b.created DESC
                LIMIT 1
            `;
            
            const result = await sql(query);
            
            if (result.length > 0) {
                const doc = result[0];
                const isLeaf = await this.isLeafDocument(doc.id);
                
                return {
                    id: doc.id,
                    name: this.extractDocumentName(doc.name || doc.hpath),
                    hpath: doc.hpath,
                    path: doc.path,
                    box: doc.box,
                    isLeaf,
                    created: doc.created,
                    updated: doc.updated
                };
            }
            
            return null;
        } catch (error) {
            console.error("查找日记文档失败:", error);
            return null;
        }
    }

    /**
     * 从指定标题下提取内容（使用 API 获取子块，保证顺序正确）
     */
    async extractContentUnderTitle(documentId: string, title: string): Promise<string[]> {
        try {
            console.log(`\n📖 [${title}] 开始提取文档 ${documentId} 的内容`);
            
            // 第一步：查找标题块
            const findTitleQuery = `
                SELECT b.id, b.type, b.subtype, b.content
                FROM blocks b
                WHERE b.root_id = '${documentId}'
                AND b.type = 'h'
                AND b.content LIKE '%${title}%'
                LIMIT 1
            `;
            
            const titleResults = await sql(findTitleQuery);
            if (!titleResults || titleResults.length === 0) {
                console.log(`⚠️  [${title}] 未找到标题块`);
                return [];
            }
            
            const titleBlock = titleResults[0];
            console.log(`✅ [${title}] 找到标题块: id=${titleBlock.id}, type=${titleBlock.subtype}`);
            
            // 第二步：使用 API 获取标题块的子块（API 返回的顺序是正确的文档顺序）
            const contentBlocks = await getChildBlocks(titleBlock.id);
            console.log(`📦 [${title}] 标题块有 ${contentBlocks.length} 个子块`);
            
            if (contentBlocks.length === 0) {
                console.log(`⚠️  [${title}] 标题下没有内容`);
                return [];
            }
            
            // 第三步：获取每个块的完整 kramdown 内容（保持 API 返回的顺序）
            const allContent = [];
            console.log(`📝 [${title}] 提取内容块（按 API 返回的文档顺序）:`);
            
            for (let i = 0; i < contentBlocks.length; i++) {
                const block = contentBlocks[i];
                
                // 使用 getBlockKramdown 获取完整内容（包含引用）
                const blockDetail = await getBlockKramdown(block.id);
                if (blockDetail && blockDetail.kramdown) {
                    const content = blockDetail.kramdown.trim();
                    if (content) {
                        allContent.push(content);
                        // 显示完整内容以便调试
                        const displayContent = content.length > 80 ? content.substring(0, 80) + '...' : content;
                        console.log(`  ${i+1}. [${block.type}] id=${block.id}`);
                        console.log(`      内容: ${displayContent}`);
                    }
                }
            }
            
            // 第四步：合并内容（每个块之间用单个换行分隔，因为 kramdown 内容本身可能包含换行）
            const fullContent = allContent.join('\n');
            console.log(`\n📝 [${title}] 合并后内容长度: ${fullContent.length} 字符`);
            console.log(`📝 [${title}] 完整内容:\n${'─'.repeat(60)}\n${fullContent}\n${'─'.repeat(60)}`);
            
            // 第五步：解析项目引用
            const results = this.parseProjectContentRelations(fullContent);
            console.log(`🎯 [${title}] 解析出 ${results.length} 个项目内容\n`);
            
            return results;
             
        } catch (error) {
            console.error(`❌ [${title}] 提取失败:`, error);
            return [];
        }
    }
    
    /**
     * 改进的项目内容关系解析（优化日志版）
     * 实现：项目引用A后的所有内容归属到A，直到遇到下一个项目引用B/二级标题/空白行无内容时
     */
    private parseProjectContentRelations(content: string): string[] {
        const results: string[] = [];
        const lines = content.split('\n');
        
        let currentProjectContent = '';
        let hasProjectRef = false;
        let emptyLineBuffer: string[] = [];
        let projectCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 遇到二级标题，结束当前项目
            if (trimmedLine.startsWith('## ')) {
                if (hasProjectRef && currentProjectContent.trim()) {
                    results.push(this.preserveOriginalFormat(currentProjectContent));
                    projectCount++;
                }
                currentProjectContent = '';
                hasProjectRef = false;
                emptyLineBuffer = [];
                continue;
            }
            
            // 检查是否是项目引用
            const hasRef = this.containsProjectReference(trimmedLine);
            
            if (hasRef) {
                // 保存前一个项目内容
                if (hasProjectRef && currentProjectContent.trim()) {
                    results.push(this.preserveOriginalFormat(currentProjectContent));
                    projectCount++;
                }
                
                // 开始新的项目内容
                currentProjectContent = line;
                hasProjectRef = true;
                emptyLineBuffer = [];
                
                // 提取项目名称用于日志
                const projectNameMatch = trimmedLine.match(/['"]([^'"]+)['"]/);
                const projectName = projectNameMatch ? projectNameMatch[1] : '未知项目';
                console.log(`  🔗 发现项目引用: ${projectName}`);
            } else if (hasProjectRef) {
                if (!trimmedLine) {
                    emptyLineBuffer.push(line);
                    
                    if (emptyLineBuffer.length >= 2) {
                        const hasFollowingContent = this.hasFollowingNonEmptyContent(lines, i);
                        if (!hasFollowingContent) {
                            results.push(this.preserveOriginalFormat(currentProjectContent));
                            projectCount++;
                            currentProjectContent = '';
                            hasProjectRef = false;
                            emptyLineBuffer = [];
                        }
                    }
                } else {
                    // 累积内容
                    for (const emptyLine of emptyLineBuffer) {
                        currentProjectContent += '\n' + emptyLine;
                    }
                    currentProjectContent += '\n' + line;
                    emptyLineBuffer = [];
                }
            }
        }
        
        // 处理最后一个项目
        if (hasProjectRef && currentProjectContent.trim()) {
            results.push(this.preserveOriginalFormat(currentProjectContent));
            projectCount++;
        }
        
        if (projectCount > 0) {
            console.log(`  ✅ 共解析出 ${projectCount} 个项目引用`);
        }
        
        return results;
    }
    
    /**
     * 向前查看是否有非空内容
     * 用于判断是否应该结束当前项目内容的收集
     */
    private hasFollowingNonEmptyContent(lines: string[], currentIndex: number): boolean {
        for (let i = currentIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                // 如果遇到二级标题或新的项目引用，返回 false
                if (line.startsWith('## ') || this.containsProjectReference(line)) {
                    return false;
                }
                // 有其他非空内容
                return true;
            }
        }
        return false;
    }
    
    /**
     * 保持原始格式，只进行最基本的清理
     */
    private preserveOriginalFormat(content: string): string {
        console.log(`🧹 [格式清理] 原始内容长度: ${content.length}`);
        console.log(`🧹 [格式清理] 原始内容预览: ${content.substring(0, 100)}...`);
        
        // 移除 kramdown 元数据，保持其他格式
        let cleaned = content
            // 移除单独一行的 kramdown 元数据
            .replace(/^\s*\{:\s*[^}]*\}\s*$/gm, '')
            // 移除行内的 kramdown 元数据（更强的匹配）
            .replace(/\{:\s*[^}]*\}/g, '')
            // 移除多余的空行（连续的空行合并为一个）
            .replace(/\n\s*\n\s*\n+/g, '\n\n')
            // 移除开头和结尾的多余空行
            .replace(/^\s*\n+/, '')
            .replace(/\n+\s*$/, '');
        
        console.log(`🧹 [格式清理] 清理后长度: ${cleaned.length}`);
        console.log(`🧹 [格式清理] 清理后预览: ${cleaned.substring(0, 100)}...`);
        
        return cleaned;
    }
    
    /**
     * 改进的项目引用检测
     * 检查文本是否包含项目引用，支持多种格式
     */
    private containsProjectReference(text: string): boolean {
        // 检查各种项目引用格式
        const patterns = [
            /\(\(\d{14}-[a-z0-9]{7}\s+['"][^'"]+['"]\)\)/,  // ((blockId 'name')) - 更严格的格式检查
            /\[\[[^\]]+\]\]/,                                 // [[项目名]]
            /\[([^\]]+)\]\([^)]+\)/                          // [显示文本](链接)
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    /**
     * 获取支持的日期格式列表
     */
    getSupportedDateFormats(): DateFormatConfig[] {
        return this.supportedDateFormats;
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<NotebookServiceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前配置
     */
    getConfig(): NotebookServiceConfig {
        return { ...this.config };
    }

    /**
     * 提取文档名称
     */
    private extractDocumentName(content: string): string {
        if (!content) return "未命名文档";
        
        // 移除HTML标签和多余空白
        const cleaned = content.replace(/<[^>]*>/g, '').trim();
        
        // 取第一行作为文档名
        const firstLine = cleaned.split('\n')[0];
        return firstLine || "未命名文档";
    }

    /**
     * 清理块内容
     */
    private cleanBlockContent(content: string): string {
        if (!content) return "";
        
        let cleaned = content;
        
        // 移除各种 kramdown 元数据格式
        cleaned = cleaned
            // 移除单独一行的元数据 {: id="..." updated="..."}
            .replace(/^\s*\{:\s*[^}]*\}\s*$/gm, '')
            // 移除行内的元数据 {: id="..." updated="..."}
            .replace(/\s*\{:\s*[^}]*\}\s*/g, ' ')
            // 移除HTML标签
            .replace(/<[^>]*>/g, '')
            // 移除模板语法
            .replace(/\{\{[^}]*\}\}/g, '')
            // 处理内部链接，保留显示文本
            .replace(/\[\[([^\]]*)\]\]/g, '$1')
            // 移除多余的空行（连续的换行符）
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // 合并多个空白字符（但保留换行）
            .replace(/[ \t]+/g, ' ')
            // 移除行首行尾的空白
            .replace(/^[ \t]+|[ \t]+$/gm, '')
            .trim();
        
        console.log(`🧹 [内容清理] 原始: "${content.substring(0, 100)}..."`);
        console.log(`🧹 [内容清理] 清理后: "${cleaned.substring(0, 100)}..."`);
        
        return cleaned;
    }
}
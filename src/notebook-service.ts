/**
 * 笔记本服务
 * 负责笔记本选择、叶子文档检测、日期格式生成等功能
 */

import { lsNotebooks, sql } from "./api";

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
     * 从指定标题下提取内容
     */
    async extractContentUnderTitle(documentId: string, title: string): Promise<string[]> {
        try {
            const query = `
                SELECT b.id, b.content, b.type, b.subtype
                FROM blocks b
                WHERE b.root_id = '${documentId}'
                ORDER BY b.created
            `;
            
            const blocks = await sql(query);
            const contents: string[] = [];
            let foundTitle = false;
            let titleLevel = 0;
            
            for (const block of blocks) {
                // 检查是否是标题块
                if (block.type === 'h') {
                    const currentLevel = parseInt(block.subtype?.replace('h', '') || '1');
                    
                    if (block.content.includes(title)) {
                        foundTitle = true;
                        titleLevel = currentLevel;
                        continue;
                    } else if (foundTitle && currentLevel <= titleLevel) {
                        // 遇到同级或更高级标题，停止提取
                        break;
                    }
                }
                
                // 如果找到了目标标题，开始收集内容
                if (foundTitle && block.content && block.content.trim()) {
                    contents.push(this.cleanBlockContent(block.content));
                }
            }
            
            return contents;
        } catch (error) {
            console.error("提取标题下内容失败:", error);
            return [];
        }
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
        
        return content
            .replace(/<[^>]*>/g, '') // 移除HTML标签
            .replace(/\{\{[^}]*\}\}/g, '') // 移除模板语法
            .replace(/\[\[([^\]]*)\]\]/g, '$1') // 处理内部链接
            .replace(/\s+/g, ' ') // 合并多个空白字符
            .trim();
    }
}
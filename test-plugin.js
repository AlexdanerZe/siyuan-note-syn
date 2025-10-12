/**
 * 简单的插件功能测试脚本
 * 用于验证核心逻辑是否正确
 */

// 模拟测试数据
const testData = {
    diaryContent: `
# 2024-01-15 日记

## 今日进展

- 完成了 [[项目A]] 的需求分析文档
- 修复了 [[项目B]] 中的登录bug
- 开始设计 [[项目A]] 的数据库结构

## 其他内容

这是一些其他内容，不应该被同步。
`,
    
    expectedResults: [
        {
            projectName: "项目A",
            items: [
                "完成了 项目A 的需求分析文档",
                "开始设计 项目A 的数据库结构"
            ]
        },
        {
            projectName: "项目B", 
            items: [
                "修复了 项目B 中的登录bug"
            ]
        }
    ]
};

// 测试项目引用提取
function testProjectReferenceExtraction() {
    console.log("测试项目引用提取...");
    
    const content = "完成了 [[项目A]] 的需求分析文档";
    const refPattern = /\[\[([^\]]+)\]\]/g;
    const refs = [];
    let match;
    
    while ((match = refPattern.exec(content)) !== null) {
        refs.push(match[1]);
    }
    
    console.log("提取的项目引用:", refs);
    console.log("期望结果: ['项目A']");
    console.log("测试", refs.length === 1 && refs[0] === "项目A" ? "通过" : "失败");
    console.log("");
}

// 测试内容清理
function testContentCleaning() {
    console.log("测试内容清理...");
    
    const content = "完成了 [[项目A]] 的需求分析文档";
    const cleaned = content.replace(/\[\[([^\]]+)\]\]/g, '$1');
    
    console.log("原始内容:", content);
    console.log("清理后内容:", cleaned);
    console.log("期望结果: '完成了 项目A 的需求分析文档'");
    console.log("测试", cleaned === "完成了 项目A 的需求分析文档" ? "通过" : "失败");
    console.log("");
}

// 测试日期提取
function testDateExtraction() {
    console.log("测试日期提取...");
    
    const paths = [
        "/daily note/2024-01-15.md",
        "/daily note/2024/01/15.md", 
        "/daily note/1月15日.md"
    ];
    
    const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,     // 2024-10-01
        /(\d{4}\/\d{2}\/\d{2})/,   // 2024/10/01
        /(\d{2}月\d{2}日)/,        // 10月01日
        /(\d{1,2}月\d{1,2}日)/     // 1月1日
    ];
    
    paths.forEach(path => {
        let extracted = null;
        for (const pattern of datePatterns) {
            const match = path.match(pattern);
            if (match) {
                extracted = match[1];
                break;
            }
        }
        console.log(`路径: ${path} -> 提取日期: ${extracted}`);
    });
    console.log("");
}

// 测试内容哈希生成
function testContentHashing() {
    console.log("测试内容哈希生成...");
    
    function generateContentHash(content) {
        let hash = 0;
        const cleanedContent = content.trim().toLowerCase();
        for (let i = 0; i < cleanedContent.length; i++) {
            const char = cleanedContent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }
    
    const content1 = "完成了项目A的需求分析文档";
    const content2 = "完成了项目A的需求分析文档"; // 相同内容
    const content3 = "修复了项目B中的登录bug";    // 不同内容
    
    const hash1 = generateContentHash(content1);
    const hash2 = generateContentHash(content2);
    const hash3 = generateContentHash(content3);
    
    console.log(`内容1哈希: ${hash1}`);
    console.log(`内容2哈希: ${hash2}`);
    console.log(`内容3哈希: ${hash3}`);
    console.log("相同内容哈希相等:", hash1 === hash2 ? "通过" : "失败");
    console.log("不同内容哈希不等:", hash1 !== hash3 ? "通过" : "失败");
    console.log("");
}

// 运行所有测试
function runAllTests() {
    console.log("=== 思源笔记每日进展同步插件 - 功能测试 ===\n");
    
    testProjectReferenceExtraction();
    testContentCleaning();
    testDateExtraction();
    testContentHashing();
    
    console.log("=== 测试完成 ===");
    console.log("如果所有测试都通过，说明核心逻辑实现正确。");
    console.log("接下来可以在思源笔记中安装并测试插件的完整功能。");
}

// 执行测试
runAllTests();
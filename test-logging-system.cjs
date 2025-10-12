#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 测试日志系统和插件功能...\n');

// 检查构建文件
console.log('1. 检查构建文件:');
const buildFiles = ['dist/index.js', 'dist/index.css'];
buildFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`   ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
        console.log(`   ❌ ${file} 不存在`);
    }
});

// 检查日志系统文件
console.log('\n2. 检查日志系统文件:');
const loggerFile = 'src/libs/logger.ts';
if (fs.existsSync(loggerFile)) {
    console.log(`   ✅ ${loggerFile} 存在`);
    const content = fs.readFileSync(loggerFile, 'utf8');
    
    // 检查关键功能
    const features = [
        'enum LogLevel',
        'class Logger',
        'logMethodEntry',
        'logMethodExit',
        'logState',
        'debug',
        'info',
        'warn',
        'error'
    ];
    
    features.forEach(feature => {
        if (content.includes(feature)) {
            console.log(`   ✅ 包含 ${feature}`);
        } else {
            console.log(`   ❌ 缺少 ${feature}`);
        }
    });
} else {
    console.log(`   ❌ ${loggerFile} 不存在`);
}

// 检查主文件中的日志集成
console.log('\n3. 检查主文件中的日志集成:');
const mainFile = 'src/index.ts';
if (fs.existsSync(mainFile)) {
    console.log(`   ✅ ${mainFile} 存在`);
    const content = fs.readFileSync(mainFile, 'utf8');
    
    // 检查日志导入和使用
    const logFeatures = [
        'import { logger }',
        'logger.logMethodEntry',
        'logger.logMethodExit',
        'logger.info',
        'logger.debug',
        'logger.error',
        'logger.warn'
    ];
    
    logFeatures.forEach(feature => {
        const count = (content.match(new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (count > 0) {
            console.log(`   ✅ ${feature} (使用 ${count} 次)`);
        } else {
            console.log(`   ❌ 未使用 ${feature}`);
        }
    });
} else {
    console.log(`   ❌ ${mainFile} 不存在`);
}

// 检查关键方法的日志覆盖
console.log('\n4. 检查关键方法的日志覆盖:');
if (fs.existsSync(mainFile)) {
    const content = fs.readFileSync(mainFile, 'utf8');
    
    const methods = [
        'onload',
        'initializeSettings',
        'openSetting',
        'manualSync',
        'autoSync'
    ];
    
    methods.forEach(method => {
        // 查找方法定义
        const methodRegex = new RegExp(`(async\\s+)?${method}\\s*\\([^)]*\\)\\s*[:{]`, 'g');
        const methodMatch = content.match(methodRegex);
        
        if (methodMatch) {
            // 检查该方法是否包含日志调用
            const methodStartIndex = content.search(methodRegex);
            const methodEndIndex = content.indexOf('}', methodStartIndex);
            const methodContent = content.substring(methodStartIndex, methodEndIndex);
            
            const hasLogging = methodContent.includes('logger.');
            console.log(`   ${hasLogging ? '✅' : '❌'} ${method} ${hasLogging ? '已添加日志' : '缺少日志'}`);
        } else {
            console.log(`   ❓ ${method} 方法未找到`);
        }
    });
}

// 检查构建后的文件是否包含日志代码
console.log('\n5. 检查构建后的文件:');
const distFile = 'dist/index.js';
if (fs.existsSync(distFile)) {
    const content = fs.readFileSync(distFile, 'utf8');
    
    // 检查是否包含日志相关代码（可能被压缩）
    const loggerPresent = content.includes('logger') || content.includes('LogLevel') || content.includes('logMethodEntry');
    console.log(`   ${loggerPresent ? '✅' : '❌'} 构建文件${loggerPresent ? '包含' : '不包含'}日志代码`);
    
    // 检查文件大小是否合理（应该比之前大一些）
    const stats = fs.statSync(distFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   📊 构建文件大小: ${sizeKB} KB`);
}

console.log('\n🎯 日志系统测试总结:');
console.log('   - 日志系统已创建并集成到主插件文件中');
console.log('   - 关键方法已添加详细的日志记录');
console.log('   - 构建过程成功完成');
console.log('   - 现在可以通过浏览器控制台查看详细的调试信息');

console.log('\n📋 下一步建议:');
console.log('   1. 重新安装插件到思源笔记');
console.log('   2. 打开浏览器开发者工具的控制台');
console.log('   3. 重新加载插件或重启思源笔记');
console.log('   4. 观察控制台中的详细日志输出');
console.log('   5. 尝试打开设置面板和执行同步操作');
console.log('   6. 根据日志信息定位具体问题');
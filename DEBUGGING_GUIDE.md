# 插件调试指南

## 📋 概述

本指南将帮助您使用新添加的日志系统来调试 Daily Progress Sync 插件的问题。

## 🔧 日志系统功能

### 日志级别
- **DEBUG**: 详细的调试信息
- **INFO**: 一般信息
- **WARN**: 警告信息  
- **ERROR**: 错误信息

### 日志功能
- **方法入口/出口跟踪**: 自动记录方法的进入和退出
- **状态记录**: 记录对象和变量的状态
- **错误捕获**: 详细的错误信息和堆栈跟踪
- **日志历史**: 保存最近的日志记录

## 🚀 如何使用调试功能

### 1. 重新安装插件

1. 将 `dist` 文件夹中的内容复制到思源笔记的插件目录
2. 或者将生成的 zip 文件解压到插件目录
3. 重启思源笔记或重新加载插件

### 2. 打开开发者工具

1. 在思源笔记中按 `F12` 或右键选择"检查元素"
2. 切换到 "Console" (控制台) 标签页
3. 确保日志级别设置为显示所有消息

### 3. 观察日志输出

插件加载时，您应该看到类似以下的日志：

```
[INFO] 插件开始加载
[DEBUG] 检查前端环境: desktop
[DEBUG] 初始化配置数据状态: {...}
[INFO] 同步服务初始化完成
[INFO] 设置面板初始化完成
[INFO] 插件加载完成
```

### 4. 测试关键功能

#### 测试设置面板
1. 点击插件的设置按钮
2. 观察控制台输出：
   ```
   [DEBUG] DailyProgressSyncPlugin.openSetting - 方法入口
   [DEBUG] 检查设置工具状态: {hasSettingUtils: true, hasSetting: true}
   [INFO] 正在打开设置面板
   [INFO] 设置面板已打开
   [DEBUG] DailyProgressSyncPlugin.openSetting - 方法出口
   ```

#### 测试手动同步
1. 点击手动同步按钮
2. 观察控制台输出：
   ```
   [DEBUG] DailyProgressSyncPlugin.manualSync - 方法入口
   [DEBUG] 检查同步服务状态: {hasSyncService: true, hasData: true}
   [INFO] 开始手动同步项目进展
   [INFO] 手动同步完成
   [DEBUG] DailyProgressSyncPlugin.manualSync - 方法出口
   ```

## 🔍 常见问题诊断

### 问题 1: 插件无法加载

**查看日志**:
- 检查是否有 `[ERROR] 插件加载失败` 消息
- 查看具体的错误信息和堆栈跟踪

**可能原因**:
- 配置数据初始化失败
- 依赖服务初始化失败
- 权限问题

### 问题 2: 设置面板无法打开

**查看日志**:
```
[ERROR] 设置工具未初始化
[ERROR] Setting对象不可用
```

**解决方案**:
- 检查 `initializeSettings` 方法的日志
- 确认 `SettingUtils` 是否正确初始化

### 问题 3: 同步功能不工作

**查看日志**:
```
[ERROR] 同步服务未初始化
[WARN] 同步服务未初始化，跳过自动同步
```

**解决方案**:
- 检查 `SyncService` 初始化日志
- 验证配置参数是否正确

### 问题 4: 自动同步不触发

**查看日志**:
```
[DEBUG] 自动同步已禁用，跳过同步
[DEBUG] 检查自动同步条件: {autoSyncEnabled: false}
```

**解决方案**:
- 检查设置中的自动同步开关
- 验证编辑器事件监听是否正常

## 🛠️ 高级调试技巧

### 1. 导出日志历史

在控制台中运行：
```javascript
// 获取日志历史
console.log(window.pluginLogger?.getLogHistory());

// 导出日志到文件
window.pluginLogger?.exportLogs();
```

### 2. 动态调整日志级别

```javascript
// 设置为DEBUG级别查看更多信息
window.pluginLogger?.setLogLevel('DEBUG');

// 设置为ERROR级别只看错误
window.pluginLogger?.setLogLevel('ERROR');
```

### 3. 清除日志历史

```javascript
window.pluginLogger?.clearLogs();
```

## 📊 日志分析

### 正常启动流程
1. `[INFO] 插件开始加载`
2. `[DEBUG] 检查前端环境`
3. `[DEBUG] 初始化配置数据状态`
4. `[INFO] 同步服务初始化完成`
5. `[INFO] 设置面板初始化完成`
6. `[INFO] 插件加载完成`

### 设置面板正常流程
1. `[DEBUG] DailyProgressSyncPlugin.openSetting - 方法入口`
2. `[DEBUG] 检查设置工具状态`
3. `[INFO] 正在打开设置面板`
4. `[INFO] 设置面板已打开`
5. `[DEBUG] DailyProgressSyncPlugin.openSetting - 方法出口`

### 同步操作正常流程
1. `[DEBUG] DailyProgressSyncPlugin.manualSync - 方法入口`
2. `[DEBUG] 检查同步服务状态`
3. `[INFO] 开始手动同步项目进展`
4. `[INFO] 手动同步完成`
5. `[DEBUG] DailyProgressSyncPlugin.manualSync - 方法出口`

## 📞 获取帮助

如果您在调试过程中遇到问题：

1. **收集日志**: 复制控制台中的完整日志输出
2. **描述问题**: 详细说明您遇到的具体问题
3. **重现步骤**: 提供重现问题的具体步骤
4. **环境信息**: 提供思源笔记版本和操作系统信息

通过这个详细的日志系统，我们现在可以精确定位插件运行中的任何问题！
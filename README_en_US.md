# SiYuan Note Project Progress Sync Plugin

English | [中文](./README.md)

An intelligent SiYuan Note plugin that automatically synchronizes project progress from daily notes to corresponding project documents, maintaining consistency and real-time updates of project information.

## ✨ Key Features

- 🔄 **Auto Sync**: Automatically identifies project references in daily notes and syncs related content to project documents
- 📝 **Smart Recognition**: Supports multiple project reference formats: `((blockId 'name'))`, `[[name]]`, `[text](link)`
- 🎯 **Precise Positioning**: Configurable target locations to insert content under specified headings
- ⏰ **Time Sorting**: Intelligently sorts by creation time, maintaining logical timeline order
- 🔍 **Duplicate Detection**: Smart duplicate content detection to avoid redundant syncing
- 🔧 **Flexible Configuration**: Rich settings options to meet different use scenarios

## 🚀 Quick Start

### Installation

#### Method 1: Install from Plugin Marketplace (Recommended)
1. Open SiYuan Note
2. Go to `Settings` → `Marketplace` → `Plugins`
3. Search for "Project Progress Sync"
4. Click download and enable

#### Method 2: Manual Installation
1. Download the latest `package.zip` from [Releases](https://github.com/your-username/siyuan-note-syn/releases)
2. Extract to SiYuan's `data/plugins/` directory
3. Restart SiYuan or manually enable the plugin

### Basic Usage

1. **Configure Plugin Settings**
   - Click the sync button 🔄 in the top toolbar
   - Or configure sync rules in plugin settings

2. **Write Daily Notes**
   ```markdown
   ## Daily Progress
   
   ((20240101010101-abcdefg 'My Project')) Completed requirement analysis today
   - Organized core features
   - Determined technical approach
   
   [[Another Project]] Fixed important bug
   - Resolved data sync issue
   - Optimized performance
   ```

3. **Automatic Sync**
   - Plugin automatically identifies project references
   - Syncs related content to corresponding project documents
   - Organizes project progress chronologically

## ⚙️ Configuration

### Recognition Settings

#### Daily Note Format
- **Date Format**: Default `YYYY-MM-DD`, supports customization
- **Document Path**: Configure path pattern for daily note documents
- **Extract Title**: Default `Daily Progress`, customizable title for content extraction

#### Recognition Types
- **Level 1 Heading** (`h1`): `# Title`
- **Level 2 Heading** (`h2`): `## Title`
- **Level 3 Heading** (`h3`): `### Title`
- **Unordered List** (`ul`): `- Project`
- **Ordered List** (`ol`): `1. Project`
- **Custom Pattern**: Supports regular expressions

### Copy Settings

#### Copy Target
- **Enable Target Title Function**: Specify content insertion position
- **Target Content**: Default `Project Progress`, supports customization
- **Smart Hints**: Provides dynamic hints based on selected recognition type

#### Copy Mechanism
- **Auto Copy**: 
  - Enabled by default, auto-syncs after detecting editing stops
  - Trigger time: Default 10 seconds, adjustable (minimum 1 second)
- **Manual Copy**: 
  - Hotkey: Default `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows)
  - Supports custom hotkeys

## 📋 Use Cases

### Case 1: Project Management
Record progress for various projects in daily notes, plugin automatically organizes them into project documents, forming complete project timelines.

### Case 2: Work Reporting
Work content recorded in daily notes automatically syncs to project documents, facilitating work report generation and progress tracking.

### Case 3: Study Notes
Automatically categorize daily learning content into corresponding knowledge domain documents.

## 🔧 Advanced Features

### Content Formatting
- Automatically removes project reference markers, keeping content clean
- Preserves original formatting (lists, paragraphs, etc.)
- Intelligently handles blank lines and indentation

### Duplicate Content Handling
- Smart deduplication based on content hashing
- Supports precise replacement when content is updated
- Delete sync: Content deleted from daily notes is removed from project documents

### Time Sorting
- Sorts based on document creation time, not last modification time
- Avoids timeline confusion caused by editing old content
- Intelligently inserts new content at correct temporal position

## 🛠️ Troubleshooting

### Common Issues

**Q: Content not syncing to project documents?**
A: 
1. Check if daily notes contain correct project reference format
2. Confirm project documents exist
3. Verify extract title in plugin settings is correct

**Q: Duplicate content appearing?**
A:
1. Check if sync was manually triggered multiple times
2. Review plugin logs to confirm duplicate detection is working
3. Manually delete duplicate content - plugin will remember and avoid re-adding

**Q: Incorrect content order?**
A:
1. Plugin sorts by document creation time, not modification time
2. If old date content is modified, it remains in original time position
3. Check if daily note actual creation date is correct

### Debug Mode
Detailed sync logs can be viewed in browser console, including:
- Content recognition process
- Hash calculation and comparison
- Insertion position calculation
- Error messages

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version update information.

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

### Development Environment Setup

1. Clone project locally
2. Install dependencies: `pnpm install`
3. Create development link: `pnpm run make-link`
4. Start development mode: `pnpm run dev`

### Contribution Guidelines

1. Fork this project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the [MIT](./LICENSE) License.

## 🙏 Acknowledgments

- Thanks to [SiYuan Note](https://github.com/siyuan-note/siyuan) for providing excellent note-taking platform
- Thanks to all contributors and users for their support

---

If this plugin helps you, please consider giving it a ⭐ for support!

Questions or suggestions? Feel free to provide feedback in [Issues](https://github.com/your-username/siyuan-note-syn/issues).

import { App, Plugin, PluginSettingTab, Setting, Notice, DropdownComponent } from 'obsidian';
import { DatabaseView, DATABASE_VIEW_TYPE } from './database/database-view';
import { JSONView, JSON_VIEW_TYPE } from './database/json-view';
import { DataManager, DatabaseSettings, DEFAULT_DB_SETTINGS } from './database/utils.ts/utils';

// 明确定义插件ID，确保与manifest.json一致
export const PLUGIN_ID = 'obsidian-tdd-lab';

// 添加数据存储位置类型
export type DataLocation = 'plugin-dir' | 'vault-root' | 'obsidian-dir';

interface TddLabSettings {
	mySetting: string;
	database: DatabaseSettings;
	dataLocation: DataLocation; // 新增：数据存储位置选项
}

const DEFAULT_SETTINGS: TddLabSettings = {
	mySetting: 'default',
	database: DEFAULT_DB_SETTINGS, // 使用utils.ts中定义的默认设置，确保一致性
	dataLocation: 'plugin-dir' // 默认存储在插件目录下
}

export default class TddLab extends Plugin {
	settings: TddLabSettings;
	dataManager: DataManager;

	async onload() {
		await this.loadSettings();
		
		// 获取插件目录路径并初始化数据管理器
        const pluginDir = this.manifest.dir || '';
        
        // 根据设置确定实际数据目录路径
        const dataPath = this.getDataFolderPath();
        console.log("Data folder path resolved to:", dataPath);
        
        // 初始化数据管理器
        this.dataManager = new DataManager(this.app, pluginDir, {
            ...this.settings.database,
            dataFolder: dataPath
        });
        
        // 使用增强的初始化方法
        try {
            await this.dataManager.initializeDatabase();
            console.log("Database initialized successfully");
            // 添加一个调试日志，显示实际使用的数据目录
            console.log("Using data folder:", this.dataManager.getPluginDataPath());
        } catch (error) {
            console.error("Failed to initialize database:", error);
            new Notice("数据库初始化失败，请检查控制台获取详细信息");
        }

		// 注册数据库视图
		this.registerView(
			DATABASE_VIEW_TYPE,
			(leaf) => new DatabaseView(leaf)
		);

		// 添加打开数据库视图的功能按钮
		this.addRibbonIcon('database', 'Open TDD Lab Database', (evt: MouseEvent) => {
			this.activateView();
		});

		// 添加示例数据创建命令 - 使用统一的方法
		this.addCommand({
			id: 'create-sample-data',
			name: 'Create sample data',
			callback: async () => {
				try {
					const newItem = await this.dataManager.createSampleData();
					new Notice(`Created new item with ID: ${newItem.id}`);
				} catch (error) {
					console.error("Failed to create sample data:", error);
					new Notice("创建示例数据失败");
				}
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new TddSettingTab(this.app, this));
	}

	onunload() {
		// 清理视图
		this.app.workspace.detachLeavesOfType(DATABASE_VIEW_TYPE);
		
		// 清理数据管理器缓存
		if (this.dataManager) {
			this.dataManager.clearCache();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		// 如果视图已经打开，则激活它
		const existing = this.app.workspace.getLeavesOfType(DATABASE_VIEW_TYPE);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		// 否则创建新视图
		await this.app.workspace.getLeaf(false).setViewState({
			type: DATABASE_VIEW_TYPE,
			active: true,
		});
	}
    
    // 获取实际数据文件夹路径 - 基于用户选择的位置
    getDataFolderPath(): string {
        const basePath = this.settings.database.dataFolder || DEFAULT_DB_SETTINGS.dataFolder;
        
        switch(this.settings.dataLocation) {
            case 'vault-root':
                // 使用vault根目录
                return basePath;
            case 'obsidian-dir':
                // 使用 .obsidian 目录
                return `.obsidian/${basePath}`;
            case 'plugin-dir':
            default:
                // 使用插件目录 (相对路径将被DataManager处理)
                return basePath;
        }
    }
}

class TddSettingTab extends PluginSettingTab {
	plugin: TddLab;

	constructor(app: App, plugin: TddLab) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('TDD 设置')
			.setDesc('配置 TDD Lab')
			.addText(text => text
				.setPlaceholder('输入设置')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
				
		// 添加数据存储位置下拉选择框
		new Setting(containerEl)
			.setName('数据存储位置')
			.setDesc('选择数据文件的存储位置')
			.addDropdown(dropdown => {
				dropdown
					.addOption('plugin-dir', '插件目录 (默认)')
					.addOption('vault-root', 'Obsidian 仓库根目录')
					.addOption('obsidian-dir', '.obsidian 目录')
					.setValue(this.plugin.settings.dataLocation)
					.onChange(async (value: DataLocation) => {
						// 如果改变存储位置，显示提示
						if (value !== this.plugin.settings.dataLocation) {
							new Notice('更改数据位置后，需要重启Obsidian才能生效');
						}
						this.plugin.settings.dataLocation = value;
						await this.plugin.saveSettings();
					});
			});
		
		new Setting(containerEl)
			.setName('数据文件夹名称')
			.setDesc('存储TDD Lab数据的文件夹名称')
			.addText(text => text
				.setPlaceholder('输入文件夹名称')
				.setValue(this.plugin.settings.database.dataFolder)
				.onChange(async (value) => {
					this.plugin.settings.database.dataFolder = value;
					await this.plugin.saveSettings();
					new Notice('更改数据文件夹后，需要重启Obsidian才能生效');
				}));
				
		// 添加显示当前完整路径的设置项
		const pathDisplay = containerEl.createEl('div', {
			cls: 'setting-item-description',
			text: `当前数据路径: ${this.getCurrentPathDisplay()}`
		});
		
		// 添加数据迁移警告
		containerEl.createEl('div', {
			cls: 'setting-warning',
			text: '注意: 更改数据位置不会自动迁移现有数据。如需迁移，请手动复制数据文件。'
		});
	}
	
	// 获取当前路径的可读显示
	getCurrentPathDisplay(): string {
		const { dataLocation } = this.plugin.settings;
		const folderName = this.plugin.settings.database.dataFolder;
		
		switch(dataLocation) {
			case 'vault-root':
				return `[仓库根目录]/${folderName}`;
			case 'obsidian-dir':
				return `[仓库根目录]/.obsidian/${folderName}`;
			case 'plugin-dir':
			default:
				return `[仓库根目录]/.obsidian/plugins/obsidian-tdd-lab/${folderName}`;
		}
	}
}

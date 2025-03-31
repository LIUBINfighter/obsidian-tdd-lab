import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { DatabaseView, DATABASE_VIEW_TYPE } from './database/database-view';
import { JSONView, JSON_VIEW_TYPE } from './database/json-view';
import { DataManager, DatabaseSettings } from './database/curd/utils';

// 明确定义插件ID，确保与manifest.json一致
export const PLUGIN_ID = 'obsidian-tdd-lab';

interface TddLabSettings {
	mySetting: string;
	database: DatabaseSettings;
}

const DEFAULT_SETTINGS: TddLabSettings = {
	mySetting: 'default',
	database: {
		dataFolder: 'tdd-lab-data',
		indexFile: 'data-index.json'
	}
}

export default class TddLab extends Plugin {
	settings: TddLabSettings;
	dataManager: DataManager;

	async onload() {
		await this.loadSettings();
		
		 // 获取插件目录路径并初始化数据管理器
        const pluginDir = this.manifest.dir || '';
        this.dataManager = new DataManager(this.app, pluginDir, this.settings.database);
        await this.dataManager.ensureDataFolder();

		// 注册数据库视图
		this.registerView(
			DATABASE_VIEW_TYPE,
			(leaf) => new DatabaseView(leaf)
		);

		// 添加打开数据库视图的功能按钮
		this.addRibbonIcon('database', 'Open TDD Lab Database', (evt: MouseEvent) => {
			this.activateView();
		});

		// 添加示例数据创建命令
		this.addCommand({
			id: 'create-sample-data',
			name: 'Create sample data',
			callback: async () => {
				const newItem = await this.dataManager.createData({
					id: this.dataManager.generateId(),
					title: 'Sample Item',
					content: 'This is a sample data item',
					createdAt: new Date().toISOString()
				});
				new Notice(`Created new item with ID: ${newItem.id}`);
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
			.setName('TDD Setting')
			.setDesc('Configure TDD Lab')
			.addText(text => text
				.setPlaceholder('Enter your setting')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
					}));
		
		new Setting(containerEl)
			.setName('Data Folder')
			.setDesc('Folder path for storing TDD Lab data')
			.addText(text => text
				.setPlaceholder('Enter folder path')
				.setValue(this.plugin.settings.database.dataFolder)
				.onChange(async (value) => {
					this.plugin.settings.database.dataFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}

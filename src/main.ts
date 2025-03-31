import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DatabaseView, DATABASE_VIEW_TYPE } from './database/database-view';

interface TddLabSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: TddLabSettings = {
	mySetting: 'default'
}

export default class TddLab extends Plugin {
	settings: TddLabSettings;

	async onload() {
		await this.loadSettings();

		// 注册数据库视图
		this.registerView(
			DATABASE_VIEW_TYPE,
			(leaf) => new DatabaseView(leaf)
		);

		// 添加打开数据库视图的功能按钮
		this.addRibbonIcon('database', 'Open TDD Lab Database', (evt: MouseEvent) => {
			this.activateView();
		});

		// 添加设置选项卡
		this.addSettingTab(new TddSettingTab(this.app, this));
	}

	onunload() {
		// 清理视图
		this.app.workspace.detachLeavesOfType(DATABASE_VIEW_TYPE);
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
	}
}

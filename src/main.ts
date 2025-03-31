import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

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

		const ribbonIconEl = this.addRibbonIcon('dice', 'TDD Lab', (evt: MouseEvent) => {
			new Notice('TDD Lab activated');
		});
		ribbonIconEl.addClass('tdd-lab-ribbon-class');

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('TDD Lab');

		this.addCommand({
			id: 'open-tdd-modal-simple',
			name: 'Open TDD modal (simple)',
			callback: () => {
				new TddModal(this.app).open();
			}
		});

		this.addCommand({
			id: 'tdd-editor-command',
			name: 'TDD editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('TDD Editor Command');
			}
		});

		this.addCommand({
			id: 'open-tdd-modal-complex',
			name: 'Open TDD modal (complex)',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new TddModal(this.app).open();
					}
					return true;
				}
			}
		});

		this.addSettingTab(new TddSettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TddModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('TDD Lab Modal');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
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

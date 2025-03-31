import { ItemView, WorkspaceLeaf, Plugin } from 'obsidian';
import { h, render } from 'preact';
import htm from 'htm';
import { Readme } from './Componets/Readme';
import { Debug } from './Componets/Debug';
import { Schema } from './Componets/Schema';
import { DataManager, DEFAULT_DB_SETTINGS } from './utils.ts/utils';

const html = htm.bind(h);

// Define the view type
export const DATABASE_VIEW_TYPE = 'database-view';

export class DatabaseView extends ItemView {
    private dataManager: DataManager;
    private activeTab: 'readme' | 'debug' | 'schema' = 'readme';
    private contentContainer: HTMLElement;
    private readmeTab: HTMLElement;
    private debugTab: HTMLElement;
    private schemaTab: HTMLElement;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        
        // 尝试获取插件实例
        const plugin = this.app.plugins.getPlugin('obsidian-tdd-lab') as any;
        if (plugin && plugin.manifest && plugin.manifest.dir) {
            // 创建一个新的DataManager实例，使用插件目录
            this.dataManager = new DataManager(this.app, plugin.manifest.dir, DEFAULT_DB_SETTINGS);
        } else {
            // 如果无法获取插件目录，使用默认设置
            this.dataManager = new DataManager(this.app, '', DEFAULT_DB_SETTINGS);
        }
    }

    getViewType(): string {
        return DATABASE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Database View';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // 修改为始终尝试获取插件的全局数据管理器，并确保路径一致
        try {
            const plugin = this.app.plugins.getPlugin('obsidian-tdd-lab');
            if (plugin && 'dataManager' in plugin) {
                // 使用插件的全局DataManager实例
                this.dataManager = (plugin as any).dataManager;
                console.log('Using plugin global dataManager');
                console.log('Data path:', this.dataManager.getPluginDataPath());
            } else {
                // 如果无法获取，创建本地实例并确保使用相同的路径逻辑
                console.log('Plugin dataManager not found, creating local instance');
                const pluginDir = this.app.plugins.manifests['obsidian-tdd-lab']?.dir || '';
                
                // 获取插件设置 - 使用插件的settings而不是loadData
                let dbSettings = DEFAULT_DB_SETTINGS;
                let dataLocation = 'plugin-dir';
                
                if (plugin && 'settings' in plugin) {
                    const settings = (plugin as any).settings;
                    dbSettings = settings.database || DEFAULT_DB_SETTINGS;
                    dataLocation = settings.dataLocation || 'plugin-dir';
                }
                
                const dataPath = this.getDataFolderPath(dataLocation, dbSettings.dataFolder);
                
                console.log('Resolved data path:', dataPath);
                
                // 使用解析后的路径创建DataManager
                this.dataManager = new DataManager(this.app, pluginDir, {
                    ...dbSettings,
                    dataFolder: dataPath
                });
                
                await this.dataManager.initializeDatabase();
            }
        } catch (error) {
            console.error('Failed to initialize dataManager:', error);
            
            // 出错时也要确保使用正确的路径
            const pluginDir = this.app.plugins.manifests['obsidian-tdd-lab']?.dir || '';
            const plugin = this.app.plugins.getPlugin('obsidian-tdd-lab');
            
            let dataPath = DEFAULT_DB_SETTINGS.dataFolder;
            
            // 尝试从插件实例获取设置
            if (plugin && 'settings' in plugin) {
                const settings = (plugin as any).settings;
                const dataLocation = settings.dataLocation || 'plugin-dir';
                dataPath = this.getDataFolderPath(dataLocation, DEFAULT_DB_SETTINGS.dataFolder);
            }
            
            this.dataManager = new DataManager(this.app, pluginDir, {
                ...DEFAULT_DB_SETTINGS,
                dataFolder: dataPath
            });
            
            await this.dataManager.initializeDatabase();
        }
        
        // 创建视图结构 - 只创建一次
        this.createViewStructure(container);
        
        // 初始渲染活动选项卡内容
        this.renderActiveTabContent();
    }
    
    // 创建视图结构 - 包括选项卡栏和内容容器
    private createViewStructure(container: HTMLElement) {
        // 创建选项卡栏
        const tabBar = container.createEl('div', { cls: 'tdd-tab-bar' });
        
        // 创建readme选项卡
        this.readmeTab = tabBar.createEl('div', { 
            cls: `tdd-tab ${this.activeTab === 'readme' ? 'active' : ''}`,
            text: '概览'
        });
        this.readmeTab.addEventListener('click', () => this.setActiveTab('readme'));
        
        // 创建debug选项卡
        this.debugTab = tabBar.createEl('div', { 
            cls: `tdd-tab ${this.activeTab === 'debug' ? 'active' : ''}`,
            text: '调试'
        });
        this.debugTab.addEventListener('click', () => this.setActiveTab('debug'));
        
        // 创建schema选项卡
        this.schemaTab = tabBar.createEl('div', { 
            cls: `tdd-tab ${this.activeTab === 'schema' ? 'active' : ''}`,
            text: '数据模式'
        });
        this.schemaTab.addEventListener('click', () => this.setActiveTab('schema'));
        
        // 创建内容容器 - 只创建一次，后续只更新内容
        this.contentContainer = container.createDiv('tdd-content-container');
    }
    
    // 设置活动选项卡
    private setActiveTab(tab: 'readme' | 'debug' | 'schema') {
        if (this.activeTab === tab) return; // 如果已经是活动选项卡，不做任何操作
        
        // 更新活动状态
        this.activeTab = tab;
        
        // 更新选项卡样式
        this.readmeTab.classList.toggle('active', tab === 'readme');
        this.debugTab.classList.toggle('active', tab === 'debug');
        this.schemaTab.classList.toggle('active', tab === 'schema');
        
        // 渲染新的选项卡内容
        this.renderActiveTabContent();
    }
    
    // 添加公共方法来切换标签页
    public switchToTab(tab: 'readme' | 'debug' | 'schema') {
        this.setActiveTab(tab);
    }
    
    // 渲染当前活动选项卡的内容
    private renderActiveTabContent() {
        // 清空内容容器，准备渲染新内容
        this.contentContainer.empty();
        
        // 根据活动选项卡渲染对应内容
        if (this.activeTab === 'readme') {
            render(html`
                <${Readme} 
                    dataManager=${this.dataManager}
                    onSwitchTab=${(tab: string) => this.switchToTab(tab as 'readme' | 'debug' | 'schema')}
                />
            `, this.contentContainer);
        } else if (this.activeTab === 'debug') {
            render(html`<${Debug} dataManager=${this.dataManager} />`, this.contentContainer);
        } else if (this.activeTab === 'schema') {
            render(html`<${Schema} dataManager=${this.dataManager} />`, this.contentContainer);
        }
    }

    // 复制main.ts中的路径解析方法，确保路径一致性
    private getDataFolderPath(dataLocation: string, baseFolderName: string): string {
        switch(dataLocation) {
            case 'vault-root':
                // 使用vault根目录
                return baseFolderName;
            case 'obsidian-dir':
                // 使用 .obsidian 目录
                return `.obsidian/${baseFolderName}`;
            case 'plugin-dir':
            default:
                // 使用插件目录 (相对路径将被DataManager处理)
                return baseFolderName;
        }
    }

    async onClose() {
        // Nothing to clean up.
    }
}

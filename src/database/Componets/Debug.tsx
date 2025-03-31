import { h, Component, Fragment } from 'preact';
import htm from 'htm';
import { DataManager, DataItem, DebugInfo } from '../curd/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface DebugProps {
    dataManager: DataManager;
}

interface DebugState {
    items: DataItem[];
    selectedItem: DataItem | null;
    rawData: string;
    debugInfo: DebugInfo | null;
    loading: boolean;
    filter: string;
}

export class Debug extends Component<DebugProps, DebugState> {
    constructor(props: DebugProps) {
        super(props);
        this.state = {
            items: [],
            selectedItem: null,
            rawData: '',
            debugInfo: null,
            loading: true,
            filter: ''
        };
    }

    async componentDidMount() {
        await this.loadData();
        await this.loadDebugInfo();
    }

    async loadData() {
        this.setState({ loading: true });
        try {
            const items = await this.props.dataManager.readAllData();
            this.setState({ 
                items: items,
                loading: false 
            });
        } catch (error) {
            console.error("Error loading data:", error);
            new Notice("Error loading data");
            this.setState({ loading: false });
        }
    }

    async loadDebugInfo() {
        try {
            const debugInfo = await this.props.dataManager.getDebugInfo();
            this.setState({ debugInfo });
        } catch (error) {
            console.error("Error loading debug info:", error);
        }
    }

    async selectItem(item: DataItem) {
        try {
            const rawData = await this.props.dataManager.getRawJson(item.id);
            this.setState({ 
                selectedItem: item,
                rawData: rawData || JSON.stringify(item, null, 2)
            });
        } catch (error) {
            console.error("Error getting raw JSON:", error);
            this.setState({ 
                selectedItem: item,
                rawData: JSON.stringify(item, null, 2)
            });
        }
    }

    handleFilterChange(e: Event) {
        this.setState({ 
            filter: (e.target as HTMLInputElement).value 
        });
    }

    renderItemList() {
        const { items, filter } = this.state;
        
        // 过滤项目
        const filteredItems = items.filter(item => {
            if (!filter) return true;
            return JSON.stringify(item).toLowerCase().includes(filter.toLowerCase());
        });

        if (filteredItems.length === 0) {
            return html`<div class="empty-list">无匹配项目</div>`;
        }

        return html`
            <ul class="debug-item-list">
                ${filteredItems.map(item => html`
                    <li 
                        key=${item.id}
                        class=${this.state.selectedItem?.id === item.id ? 'selected' : ''}
                        onClick=${() => this.selectItem(item)}
                    >
                        <div class="item-title">${item.title || item.id}</div>
                        <div class="item-subtitle">ID: ${item.id}</div>
                    </li>
                `)}
            </ul>
        `;
    }

    renderKeyValuePairs(obj: any, level = 0) {
        if (!obj || typeof obj !== 'object') return null;
        
        const entries = Object.entries(obj);
        const indent = '  '.repeat(level);
        
        return html`
            <div class="key-value-container level-${level}">
                ${entries.map(([key, value]) => {
                    const isObject = value && typeof value === 'object';
                    const isArray = Array.isArray(value);
                    
                    return html`
                        <div class="key-value-row">
                            <div class="key-label">${indent}${key}:</div>
                            <div class="value-content">
                                ${isObject 
                                    ? html`
                                        <div class="object-value">
                                            ${isArray 
                                                ? `Array[${(value as any[]).length}]` 
                                                : 'Object'
                                            }
                                            ${this.renderKeyValuePairs(value, level + 1)}
                                        </div>
                                      `
                                    : html`<span class="primitive-value">${String(value)}</span>`
                                }
                            </div>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    renderDebugPanel() {
        const { selectedItem, rawData, debugInfo } = this.state;
        
        if (!selectedItem) {
            return html`<div class="select-prompt">请从左侧选择一个数据项</div>`;
        }

        return html`
            <div class="debug-panel">
                <div class="panel-section">
                    <h3>数据详情</h3>
                    <div class="data-details">
                        ${this.renderKeyValuePairs(selectedItem)}
                    </div>
                </div>
                
                <div class="panel-section">
                    <h3>原始JSON</h3>
                    <pre class="raw-json">${rawData}</pre>
                </div>
            </div>
        `;
    }

    renderDebugInfo() {
        const { debugInfo } = this.state;
        
        if (!debugInfo) return null;
        
        return html`
            <div class="debug-info">
                <h3>数据库信息</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">数据项总数:</span>
                        <span class="info-value">${debugInfo.totalItems}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">数据目录:</span>
                        <span class="info-value">${debugInfo.dataFolder}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">索引文件:</span>
                        <span class="info-value">${debugInfo.indexFile}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">最后更新:</span>
                        <span class="info-value">${debugInfo.lastUpdated}</span>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div class="debug-container">
                <div class="debug-sidebar">
                    <div class="toolbar">
                        <input 
                            type="text" 
                            placeholder="搜索..." 
                            value=${this.state.filter}
                            onInput=${(e: Event) => this.handleFilterChange(e)}
                        />
                        <button class="refresh-btn" onClick=${() => this.loadData()}>
                            刷新
                        </button>
                    </div>
                    
                    ${this.renderDebugInfo()}
                    
                    <div class="item-list-container">
                        ${this.state.loading 
                            ? html`<div class="loading">加载中...</div>` 
                            : this.renderItemList()
                        }
                    </div>
                </div>
                
                <div class="debug-content">
                    ${this.renderDebugPanel()}
                </div>
            </div>
        `;
    }
}

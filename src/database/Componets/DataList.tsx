import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem, DataSchema } from '../utils.ts/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface DataListProps {
    dataManager: DataManager;
    items: DataItem[];
    loading: boolean;
    onDataChanged: () => void;
}

interface DataListState {
    sortField: string;
    sortDirection: 'asc' | 'desc';
    schema: DataSchema | null;
}

export class DataList extends Component<DataListProps, DataListState> {
    constructor(props: DataListProps) {
        super(props);
        this.state = {
            sortField: 'createdAt',
            sortDirection: 'desc',
            schema: null
        };
    }

    async componentDidMount() {
        await this.loadSchema();
    }

    async loadSchema() {
        try {
            const schema = await this.props.dataManager.loadSchema();
            this.setState({ schema });
        } catch (error) {
            console.error("Error loading schema:", error);
        }
    }

    async deleteItem(id: string) {
        try {
            const success = await this.props.dataManager.deleteData(id);
            if (success) {
                new Notice('数据项已删除');
                this.props.onDataChanged();
            } else {
                new Notice('删除失败：找不到数据项');
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            new Notice(`删除失败: ${error.message}`);
        }
    }

    // 切换排序字段和方向
    toggleSort(field: string) {
        this.setState(prevState => ({
            sortField: field,
            sortDirection: prevState.sortField === field && prevState.sortDirection === 'asc' ? 'desc' : 'asc'
        }));
    }

    // 获取排序后的项目
    getSortedItems(): DataItem[] {
        const { items } = this.props;
        const { sortField, sortDirection } = this.state;
        
        // 复制数组以避免修改原始数据
        const sortedItems = [...items];
        
        // 根据排序字段和方向排序
        sortedItems.sort((a, b) => {
            // 处理缺失值
            if (a[sortField] === undefined) return sortDirection === 'asc' ? -1 : 1;
            if (b[sortField] === undefined) return sortDirection === 'asc' ? 1 : -1;
            
            // 根据字段类型进行比较
            if (typeof a[sortField] === 'string' && typeof b[sortField] === 'string') {
                return sortDirection === 'asc' 
                    ? a[sortField].localeCompare(b[sortField]) 
                    : b[sortField].localeCompare(a[sortField]);
            } else {
                return sortDirection === 'asc' 
                    ? (a[sortField] > b[sortField] ? 1 : -1) 
                    : (a[sortField] < b[sortField] ? 1 : -1);
            }
        });
        
        return sortedItems;
    }

    // 根据Schema获取友好字段值的显示
    getFormattedValue(item: DataItem, field: string): string {
        const value = item[field];
        if (value === undefined || value === null) return '—';

        // 对于日期类型的特殊处理
        if (field === 'createdAt' || field === 'updatedAt' || field.toLowerCase().includes('date')) {
            try {
                return new Date(value).toLocaleString();
            } catch (e) {
                return String(value);
            }
        }

        // 对象和数组转JSON字符串
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }
    
    render() {
        const { loading } = this.props;
        const { sortField, sortDirection } = this.state;
        
        if (loading) {
            return html`<div class="loading-container"><p>加载数据中...</p></div>`;
        }
        
        const sortedItems = this.getSortedItems();
        
        if (sortedItems.length === 0) {
            return html`
                <div class="empty-data-container">
                    <p>暂无数据。请使用上方的表单创建新数据项。</p>
                </div>
            `;
        }
        
        // 确定要显示的字段 - 首先显示id, title, 然后是其他常见字段
        const sampleItem = sortedItems[0];
        let displayFields = ['id', 'title', 'content', 'createdAt'];
        
        // 过滤确保所有显示字段在数据中存在
        displayFields = displayFields.filter(field => sampleItem[field] !== undefined);
        
        // 添加任何其他字段（限制总数为5个以避免表过宽）
        const otherFields = Object.keys(sampleItem)
            .filter(key => !displayFields.includes(key))
            .slice(0, Math.max(0, 5 - displayFields.length));
        
        displayFields = [...displayFields, ...otherFields];
        
        return html`
            <div class="data-list-container">
                <div class="data-list-header">
                    <div class="list-stats">显示 ${sortedItems.length} 条记录</div>
                    <div class="list-actions">
                        <button 
                            class="refresh-list-btn" 
                            onClick=${() => this.props.onDataChanged()}
                            title="刷新数据列表"
                        >
                            刷新
                        </button>
                    </div>
                </div>
                
                <table class="data-table">
                    <thead>
                        <tr>
                            ${displayFields.map(field => html`
                                <th 
                                    class=${sortField === field ? `sorted-${sortDirection}` : ''}
                                    onClick=${() => this.toggleSort(field)}
                                >
                                    ${field}
                                    <span class="sort-indicator"></span>
                                </th>
                            `)}
                            <th class="actions-column">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedItems.map(item => html`
                            <tr key=${item.id}>
                                ${displayFields.map(field => html`
                                    <td>${this.getFormattedValue(item, field)}</td>
                                `)}
                                <td class="actions-cell">
                                    <button 
                                        class="delete-btn" 
                                        onClick=${(e: MouseEvent) => {
                                            e.stopPropagation();
                                            this.deleteItem(item.id);
                                        }}
                                        title="删除此数据项"
                                    >
                                        删除
                                    </button>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    }
}

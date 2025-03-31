import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem } from '../curd/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface DataListProps {
    dataManager: DataManager;
    items: DataItem[];
    loading: boolean;
    onDataChanged: () => void;
}

export class DataList extends Component<DataListProps> {
    async deleteItem(id: string) {
        const success = await this.props.dataManager.deleteData(id);
        if (success) {
            new Notice('Item deleted successfully');
            this.props.onDataChanged();
        } else {
            new Notice('Failed to delete item');
        }
    }
    
    render() {
        const { items, loading } = this.props;
        
        if (loading) {
            return html`<p>加载中...</p>`;
        }
        
        if (items.length === 0) {
            return html`<p>暂无数据。点击上方"创建示例数据"按钮来添加数据。</p>`;
        }
        
        return html`
            <ul class="data-list">
                ${items.map(item => html`
                    <li key=${item.id} class="data-item">
                        <strong>${item.title}</strong>
                        <p>${item.content}</p>
                        <div class="data-item-actions">
                            <small>创建时间: ${new Date(item.createdAt).toLocaleString()}</small>
                            <button 
                                onClick=${() => this.deleteItem(item.id)} 
                                class="delete-btn"
                            >
                                删除
                            </button>
                        </div>
                    </li>
                `)}
            </ul>
        `;
    }
}

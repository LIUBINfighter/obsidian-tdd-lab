import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem } from '../curd/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface ReadmeProps {
    dataManager: DataManager;
}

interface ReadmeState {
    items: DataItem[];
    loading: boolean;
}

export class Readme extends Component<ReadmeProps, ReadmeState> {
    constructor(props: ReadmeProps) {
        super(props);
        this.state = {
            items: [],
            loading: true
        };
    }

    async componentDidMount() {
        await this.loadData();
    }

    async loadData() {
        this.setState({ loading: true });
        const items = await this.props.dataManager.readAllData();
        this.setState({ 
            items: items,
            loading: false 
        });
    }

    async createSampleItem() {
        const newItem = await this.props.dataManager.createData({
            id: this.props.dataManager.generateId(),
            title: 'Sample Item ' + new Date().toLocaleTimeString(),
            content: 'This is a sample data item',
            createdAt: new Date().toISOString()
        });
        
        new Notice(`Created new item: ${newItem.title}`);
        await this.loadData();
    }

    async deleteItem(id: string) {
        const success = await this.props.dataManager.deleteData(id);
        if (success) {
            new Notice('Item deleted successfully');
            await this.loadData();
        } else {
            new Notice('Failed to delete item');
        }
    }

    render() {
        return html`
            <div class="readme-container">
                <h2>TDD Lab 数据库</h2>
                <p>欢迎使用TDD Lab数据库视图。这个界面可以帮助您管理测试驱动开发工作流。</p>
                
                <div class="readme-section">
                    <h3>数据操作</h3>
                    <button onClick=${() => this.createSampleItem()}>
                        创建示例数据
                    </button>
                </div>

                <div class="readme-section">
                    <h3>数据列表</h3>
                    ${this.state.loading 
                        ? html`<p>加载中...</p>` 
                        : this.state.items.length === 0 
                            ? html`<p>暂无数据。点击上方"创建示例数据"按钮来添加数据。</p>`
                            : html`
                                <ul class="data-list">
                                    ${this.state.items.map(item => html`
                                        <li key=${item.id} class="data-item">
                                            <strong>${item.title}</strong>
                                            <p>${item.content}</p>
                                            <div class="data-item-actions">
                                                <small>创建时间: ${new Date(item.createdAt).toLocaleString()}</small>
                                                <button onClick=${() => this.deleteItem(item.id)} class="delete-btn">
                                                    删除
                                                </button>
                                            </div>
                                        </li>
                                    `)}
                                </ul>
                            `
                    }
                </div>
            </div>
        `;
    }
}

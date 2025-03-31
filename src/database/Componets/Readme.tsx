import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem } from '../curd/utils';
import { DataOperations } from './DataOperations';
import { DataList } from './DataList';

const html = htm.bind(h);

interface ReadmeProps {
    dataManager: DataManager;
    onSwitchTab?: (tab: string) => void; // 添加属性接收切换标签页的回调
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

    render() {
        return html`
            <div class="readme-container">
                <h2>TDD Lab 数据库</h2>
                <p>欢迎使用TDD Lab数据库视图。这个界面可以帮助您管理测试驱动开发工作流。</p>
                
                <div class="readme-section">
                    <h3>数据操作</h3>
                    <${DataOperations} 
                        dataManager=${this.props.dataManager}
                        onDataChanged=${() => this.loadData()}
                        onSwitchTab=${this.props.onSwitchTab} // 传递切换标签页的回调
                    />
                </div>

                <div class="readme-section">
                    <h3>数据列表</h3>
                    <${DataList}
                        dataManager=${this.props.dataManager}
                        items=${this.state.items}
                        loading=${this.state.loading}
                        onDataChanged=${() => this.loadData()}
                    />
                </div>
            </div>
        `;
    }
}

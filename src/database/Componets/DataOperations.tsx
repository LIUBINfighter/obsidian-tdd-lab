import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem, DataSchema } from '../utils.ts/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface DataOperationsProps {
    dataManager: DataManager;
    onDataChanged: () => void;
    onSwitchTab?: (tab: string) => void; // 新增：用于切换到Schema标签页
}

interface DataOperationsState {
    schema: DataSchema | null;
    isLoading: boolean;
    customFields: {[key: string]: any};
    showSchemaInfo: boolean; // 新增：控制是否显示Schema信息
}

export class DataOperations extends Component<DataOperationsProps, DataOperationsState> {
    constructor(props: DataOperationsProps) {
        super(props);
        this.state = {
            schema: null,
            isLoading: true,
            customFields: {},
            showSchemaInfo: false
        };
    }

    async componentDidMount() {
        await this.loadSchema();
    }

    async loadSchema() {
        this.setState({ isLoading: true });
        try {
            const schema = await this.props.dataManager.loadSchema();
            this.setState({ 
                schema,
                isLoading: false,
                customFields: this.initializeCustomFields(schema)
            });
        } catch (error) {
            console.error("Error loading schema:", error);
            this.setState({ isLoading: false });
        }
    }

    // 根据Schema初始化自定义字段的值
    initializeCustomFields(schema: DataSchema | null): {[key: string]: any} {
        if (!schema) return {};
        
        const fields: {[key: string]: any} = {};
        schema.fields.forEach(field => {
            // 初始化字段值为默认值或适当的空值
            if (field.defaultValue !== undefined) {
                fields[field.name] = field.defaultValue;
            } else {
                // 根据字段类型设置适当的空值
                switch (field.type) {
                    case 'string':
                    case 'text':
                        fields[field.name] = '';
                        break;
                    case 'number':
                        fields[field.name] = 0;
                        break;
                    case 'boolean':
                        fields[field.name] = false;
                        break;
                    case 'date':
                        fields[field.name] = new Date().toISOString();
                        break;
                    case 'array':
                        fields[field.name] = [];
                        break;
                    case 'object':
                        fields[field.name] = {};
                        break;
                }
            }
        });
        
        return fields;
    }

    // 更新自定义字段的值
    handleFieldChange(fieldName: string, value: any) {
        this.setState(prevState => ({
            customFields: {
                ...prevState.customFields,
                [fieldName]: value
            }
        }));
    }

    // 根据Schema创建数据项
    async createItemWithSchema() {
        const { schema, customFields } = this.state;
        
        if (!schema) {
            new Notice('没有可用的Schema');
            return;
        }
        
        try {
            // 创建基础数据项
            const newItem: DataItem = {
                id: this.props.dataManager.generateId(),
                ...customFields,
                createdAt: new Date().toISOString()
            };
            
            // 创建数据
            const createdItem = await this.props.dataManager.createData(newItem);
            new Notice(`已创建: ${createdItem.title || createdItem.id}`);
            
            // 重置自定义字段
            this.setState({
                customFields: this.initializeCustomFields(schema)
            });
            
            // 通知父组件数据已更改
            this.props.onDataChanged();
        } catch (error) {
            console.error("Error creating item:", error);
            new Notice(`创建失败: ${error.message}`);
        }
    }

    // 创建示例数据项 - 使用统一的方法
    async createSampleItem() {
        try {
            const newItem = await this.props.dataManager.createSampleData();
            new Notice(`已创建示例数据: ${newItem.title}`);
            this.props.onDataChanged();
        } catch (error) {
            console.error("Error creating sample data:", error);
            new Notice("创建示例数据失败");
        }
    }
    
    // 切换显示Schema信息
    toggleSchemaInfo() {
        this.setState(prevState => ({
            showSchemaInfo: !prevState.showSchemaInfo
        }));
    }

    // 跳转到Schema标签页
    goToSchemaTab() {
        if (this.props.onSwitchTab) {
            this.props.onSwitchTab('schema');
        }
    }

    // 渲染Schema信息
    renderSchemaInfo() {
        const { schema, showSchemaInfo } = this.state;
        
        if (!schema || !showSchemaInfo) return null;
        
        return html`
            <div class="schema-info-panel">
                <h4>当前Schema: ${schema.name} <span class="schema-version">v${schema.version}</span></h4>
                <p class="schema-description">${schema.description || '无描述'}</p>
                
                <h5>字段列表</h5>
                <table class="schema-fields-table">
                    <thead>
                        <tr>
                            <th>字段名</th>
                            <th>类型</th>
                            <th>必需</th>
                            <th>默认值</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schema.fields.map(field => html`
                            <tr key=${field.name} class=${field.system ? 'system-field' : ''}>
                                <td>${field.name} ${field.system ? html`<span class="system-badge">系统</span>` : ''}</td>
                                <td>${field.type}</td>
                                <td>${field.required ? '✓' : '✗'}</td>
                                <td>${field.defaultValue !== undefined ? String(field.defaultValue) : '-'}</td>
                                <td>${field.description || '-'}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
                
                <h5>索引字段</h5>
                <div class="index-fields">
                    ${schema.indexFields.length > 0 
                        ? schema.indexFields.map(field => html`<span class="index-field-badge">${field}</span>`)
                        : '无索引字段'
                    }
                </div>
                
                <div class="schema-actions">
                    <button 
                        class="edit-schema-btn" 
                        onClick=${() => this.goToSchemaTab()}
                    >
                        编辑Schema
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染字段输入框
    renderFieldInput(fieldName: string, fieldType: string, value: any, required: boolean) {
        switch (fieldType) {
            case 'string':
            case 'text':
                return html`
                    <input 
                        type="text" 
                        value=${value || ''}
                        onChange=${(e: Event) => this.handleFieldChange(fieldName, (e.target as HTMLInputElement).value)}
                        placeholder=${fieldName}
                        required=${required}
                    />
                `;
            case 'number':
                return html`
                    <input 
                        type="number" 
                        value=${value}
                        onChange=${(e: Event) => this.handleFieldChange(fieldName, Number((e.target as HTMLInputElement).value))}
                        placeholder=${fieldName}
                        required=${required}
                    />
                `;
            case 'boolean':
                return html`
                    <label class="checkbox-label">
                        <input 
                            type="checkbox" 
                            checked=${value}
                            onChange=${(e: Event) => this.handleFieldChange(fieldName, (e.target as HTMLInputElement).checked)}
                        />
                        ${fieldName}
                    </label>
                `;
            case 'date':
                const dateValue = value ? new Date(value).toISOString().split('T')[0] : '';
                return html`
                    <input 
                        type="date" 
                        value=${dateValue}
                        onChange=${(e: Event) => {
                            const dateStr = (e.target as HTMLInputElement).value;
                            const date = new Date(dateStr);
                            this.handleFieldChange(fieldName, date.toISOString());
                        }}
                        required=${required}
                    />
                `;
            default:
                return html`<div>不支持的字段类型: ${fieldType}</div>`;
        }
    }
    
    render() {
        const { schema, isLoading, customFields, showSchemaInfo } = this.state;
        
        if (isLoading) {
            return html`<div>加载Schema中...</div>`;
        }
        
        // 渲染采用Schema的表单
        if (schema) {
            const userEditableFields = schema.fields.filter(field => 
                !field.system && (field.name !== 'id' && field.name !== 'createdAt')
            );
            
            return html`
                <div class="data-operations">
                    <div class="schema-header">
                        <h4>使用Schema创建数据</h4>
                        <button 
                            class="toggle-schema-info-btn" 
                            onClick=${() => this.toggleSchemaInfo()}
                            title="${showSchemaInfo ? '隐藏Schema详情' : '显示Schema详情'}"
                        >
                            ${showSchemaInfo ? '隐藏Schema' : '查看Schema'}
                        </button>
                    </div>
                    
                    ${this.renderSchemaInfo()}
                    
                    <div class="schema-form">
                        ${userEditableFields.map(field => html`
                            <div class="form-field" key=${field.name}>
                                <label class="field-label">
                                    ${field.name}
                                    ${field.required ? html`<span class="required-marker">*</span>` : null}
                                </label>
                                <div class="field-input">
                                    ${this.renderFieldInput(
                                        field.name, 
                                        field.type, 
                                        customFields[field.name], 
                                        field.required
                                    )}
                                </div>
                                ${field.description ? html`
                                    <div class="field-description">${field.description}</div>
                                ` : null}
                            </div>
                        `)}
                        
                        <div class="form-actions">
                            <button 
                                class="create-btn"
                                onClick=${() => this.createItemWithSchema()}
                            >
                                创建
                            </button>
                            <button 
                                class="create-sample-btn" 
                                onClick=${() => this.createSampleItem()}
                            >
                                创建示例数据
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 如果没有Schema，显示简单的创建按钮和引导信息
        return html`
            <div class="data-operations">
                <div class="no-schema-message">
                    没有发现Schema定义。您可以
                    <button 
                        class="go-to-schema-btn" 
                        onClick=${() => this.goToSchemaTab()}
                    >
                        点击这里
                    </button>
                    前往"数据模式"标签页创建一个Schema。
                </div>
                <button 
                    class="create-sample-btn" 
                    onClick=${() => this.createSampleItem()}
                >
                    创建示例数据
                </button>
            </div>
        `;
    }
}

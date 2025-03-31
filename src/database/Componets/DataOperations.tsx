import { h, Component } from 'preact';
import htm from 'htm';
import { DataManager, DataItem, DataSchema } from '../curd/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface DataOperationsProps {
    dataManager: DataManager;
    onDataChanged: () => void;
}

interface DataOperationsState {
    schema: DataSchema | null;
    isLoading: boolean;
    customFields: {[key: string]: any};
}

export class DataOperations extends Component<DataOperationsProps, DataOperationsState> {
    constructor(props: DataOperationsProps) {
        super(props);
        this.state = {
            schema: null,
            isLoading: true,
            customFields: {}
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

    // 创建示例数据项
    async createSampleItem() {
        const newItem = await this.props.dataManager.createData({
            id: this.props.dataManager.generateId(),
            title: 'Sample Item ' + new Date().toLocaleTimeString(),
            content: 'This is a sample data item',
            createdAt: new Date().toISOString()
        });
        
        new Notice(`Created new item: ${newItem.title}`);
        this.props.onDataChanged();
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
        const { schema, isLoading, customFields } = this.state;
        
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
                    <h4>使用Schema创建数据</h4>
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
        
        // 如果没有Schema，显示简单的创建按钮
        return html`
            <div class="data-operations">
                <div class="no-schema-message">
                    没有发现Schema定义。您可以在"数据模式"选项卡中创建一个Schema。
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

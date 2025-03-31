import { h, Component, Fragment } from 'preact';
import htm from 'htm';
import { DataManager, DataSchema, SchemaField, FieldType } from '../curd/utils';
import { Notice } from 'obsidian';

const html = htm.bind(h);

interface SchemaProps {
    dataManager: DataManager;
}

interface SchemaState {
    schema: DataSchema;
    newField: SchemaField;
    editingField: string | null;
    editingFieldData: SchemaField | null;
    loading: boolean;
    previewMode: boolean;
    jsonError: string | null;
    schemaJson: string;
}

export class Schema extends Component<SchemaProps, SchemaState> {
    constructor(props: SchemaProps) {
        super(props);
        
        this.state = {
            schema: {
                name: "未命名Schema",
                description: "数据库Schema描述",
                fields: [],
                indexFields: [],
                version: 1
            },
            newField: this.getEmptyField(),
            editingField: null,
            editingFieldData: null,
            loading: true,
            previewMode: false,
            jsonError: null,
            schemaJson: ''
        };
    }

    async componentDidMount() {
        await this.loadSchema();
    }

    // 获取空字段模板
    getEmptyField(): SchemaField {
        return {
            name: '',
            type: 'string',
            required: false,
            defaultValue: '',
            description: ''
        };
    }

    // 加载现有Schema
    async loadSchema() {
        this.setState({ loading: true });
        
        try {
            const schema = await this.props.dataManager.loadSchema();
            
            if (schema) {
                const schemaJson = JSON.stringify(schema, null, 2);
                this.setState({ 
                    schema, 
                    schemaJson,
                    loading: false 
                });
            } else {
                // 如果没有现有schema，使用默认值
                const defaultSchema = this.state.schema;
                defaultSchema.fields = [
                    {
                        name: 'id',
                        type: 'string',
                        required: true,
                        description: '数据项唯一标识',
                        system: true
                    },
                    {
                        name: 'title',
                        type: 'string',
                        required: true,
                        defaultValue: '未命名项目',
                        description: '数据项标题'
                    },
                    {
                        name: 'content',
                        type: 'text',
                        required: false,
                        description: '数据项内容'
                    },
                    {
                        name: 'createdAt',
                        type: 'date',
                        required: true,
                        description: '创建时间',
                        system: true
                    }
                ];
                defaultSchema.indexFields = ['id', 'title'];
                
                const schemaJson = JSON.stringify(defaultSchema, null, 2);
                this.setState({ 
                    schema: defaultSchema,
                    schemaJson,
                    loading: false 
                });
            }
        } catch (error) {
            console.error("Error loading schema:", error);
            new Notice("加载Schema失败");
            this.setState({ loading: false });
        }
    }

    // 保存Schema
    async saveSchema() {
        try {
            const { schema } = this.state;
            await this.props.dataManager.saveSchema(schema);
            new Notice("Schema保存成功");
        } catch (error) {
            console.error("Error saving schema:", error);
            new Notice("保存Schema失败");
        }
    }

    // 添加新字段
    addField(field: SchemaField) {
        if (!field.name.trim()) {
            new Notice("字段名称不能为空");
            return;
        }
        
        // 检查字段名称是否已存在
        if (this.state.schema.fields.some(f => f.name === field.name)) {
            new Notice(`字段 "${field.name}" 已存在`);
            return;
        }
        
        const schema = { ...this.state.schema };
        schema.fields = [...schema.fields, { ...field }];
        
        this.setState({
            schema,
            schemaJson: JSON.stringify(schema, null, 2),
            newField: this.getEmptyField()
        });
    }

    // 开始编辑字段
    startEditField(fieldName: string) {
        const field = this.state.schema.fields.find(f => f.name === fieldName);
        if (field) {
            this.setState({
                editingField: fieldName,
                editingFieldData: { ...field }
            });
        }
    }

    // 保存编辑的字段
    saveEditField() {
        const { editingField, editingFieldData, schema } = this.state;
        
        if (!editingField || !editingFieldData) return;
        
        const updatedSchema = { ...schema };
        const fieldIndex = updatedSchema.fields.findIndex(f => f.name === editingField);
        
        if (fieldIndex >= 0) {
            updatedSchema.fields[fieldIndex] = { ...editingFieldData };
            
            this.setState({
                schema: updatedSchema,
                schemaJson: JSON.stringify(updatedSchema, null, 2),
                editingField: null,
                editingFieldData: null
            });
        }
    }

    // 删除字段
    removeField(fieldName: string) {
        // 系统字段不能删除
        const field = this.state.schema.fields.find(f => f.name === fieldName);
        if (field?.system) {
            new Notice("系统字段不能删除");
            return;
        }
        
        const schema = { ...this.state.schema };
        schema.fields = schema.fields.filter(f => f.name !== fieldName);
        
        // 如果该字段在索引字段中，也要移除
        schema.indexFields = schema.indexFields.filter(name => name !== fieldName);
        
        this.setState({
            schema,
            schemaJson: JSON.stringify(schema, null, 2)
        });
    }

    // 切换字段是否为索引
    toggleIndexField(fieldName: string) {
        const schema = { ...this.state.schema };
        
        if (schema.indexFields.includes(fieldName)) {
            schema.indexFields = schema.indexFields.filter(name => name !== fieldName);
        } else {
            schema.indexFields = [...schema.indexFields, fieldName];
        }
        
        this.setState({
            schema,
            schemaJson: JSON.stringify(schema, null, 2)
        });
    }

    // 从JSON更新Schema
    updateSchemaFromJson(jsonStr: string) {
        try {
            const schema = JSON.parse(jsonStr);
            
            // 简单验证
            if (!schema.fields || !Array.isArray(schema.fields)) {
                throw new Error("无效的Schema结构");
            }
            
            this.setState({
                schema,
                schemaJson: jsonStr,
                jsonError: null
            });
        } catch (error) {
            console.error("JSON解析错误:", error);
            this.setState({
                jsonError: error.message
            });
        }
    }

    // 应用Schema到现有数据
    async applySchema() {
        try {
            await this.props.dataManager.saveSchema(this.state.schema);
            new Notice("Schema已应用到数据库");
        } catch (error) {
            console.error("应用Schema错误:", error);
            new Notice("应用Schema失败");
        }
    }

    // 切换预览模式
    togglePreviewMode() {
        this.setState(prevState => ({
            previewMode: !prevState.previewMode
        }));
    }

    // 处理新字段输入变化
    handleNewFieldChange(field: string, value: any) {
        this.setState(prevState => ({
            newField: {
                ...prevState.newField,
                [field]: value
            }
        }));
    }

    // 处理编辑字段输入变化
    handleEditFieldChange(field: string, value: any) {
        if (!this.state.editingFieldData) return;
        
        this.setState(prevState => ({
            editingFieldData: {
                ...prevState.editingFieldData!,
                [field]: value
            }
        }));
    }

    // 渲染字段类型选择器
    renderTypeSelector(currentType: FieldType, onChange: (type: FieldType) => void) {
        const types: FieldType[] = ['string', 'number', 'boolean', 'date', 'array', 'object', 'text'];
        
        return html`
            <select 
                value=${currentType} 
                onChange=${(e: Event) => onChange((e.target as HTMLSelectElement).value as FieldType)}
                class="field-type-select"
            >
                ${types.map(type => html`
                    <option value=${type}>${type}</option>
                `)}
            </select>
        `;
    }

    // 渲染字段列表
    renderFieldList() {
        const { schema, editingField } = this.state;
        
        if (schema.fields.length === 0) {
            return html`<div class="no-fields">尚未定义字段</div>`;
        }
        
        return html`
            <div class="schema-field-list">
                <div class="field-header">
                    <div class="field-name">字段名</div>
                    <div class="field-type">类型</div>
                    <div class="field-required">必需</div>
                    <div class="field-index">索引</div>
                    <div class="field-actions">操作</div>
                </div>
                
                ${schema.fields.map(field => {
                    if (editingField === field.name) {
                        return this.renderEditingField();
                    }
                    
                    return html`
                        <div class="field-row ${field.system ? 'system-field' : ''}">
                            <div class="field-name" title=${field.description || ''}>
                                ${field.name}
                                ${field.system ? html`<span class="system-badge">系统</span>` : null}
                            </div>
                            <div class="field-type">${field.type}</div>
                            <div class="field-required">${field.required ? '✓' : '✗'}</div>
                            <div class="field-index">
                                <input 
                                    type="checkbox" 
                                    checked=${schema.indexFields.includes(field.name)}
                                    onChange=${() => this.toggleIndexField(field.name)}
                                    disabled=${field.name === 'id'}
                                />
                            </div>
                            <div class="field-actions">
                                <button 
                                    class="field-edit-btn" 
                                    onClick=${() => this.startEditField(field.name)}
                                    disabled=${field.system}
                                >
                                    编辑
                                </button>
                                <button 
                                    class="field-delete-btn" 
                                    onClick=${() => this.removeField(field.name)}
                                    disabled=${field.system}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    // 渲染正在编辑的字段
    renderEditingField() {
        const { editingFieldData } = this.state;
        if (!editingFieldData) return null;
        
        return html`
            <div class="field-row editing">
                <div class="field-name">
                    <input 
                        type="text" 
                        value=${editingFieldData.name} 
                        onChange=${(e: Event) => this.handleEditFieldChange('name', (e.target as HTMLInputElement).value)}
                        disabled=${true}
                    />
                </div>
                <div class="field-type">
                    ${this.renderTypeSelector(
                        editingFieldData.type, 
                        (type) => this.handleEditFieldChange('type', type)
                    )}
                </div>
                <div class="field-required">
                    <input 
                        type="checkbox" 
                        checked=${editingFieldData.required}
                        onChange=${(e: Event) => this.handleEditFieldChange('required', (e.target as HTMLInputElement).checked)}
                    />
                </div>
                <div class="field-index">
                    <input 
                        type="checkbox" 
                        checked=${this.state.schema.indexFields.includes(editingFieldData.name)}
                        onChange=${() => this.toggleIndexField(editingFieldData.name)}
                    />
                </div>
                <div class="field-actions">
                    <button 
                        class="field-save-btn" 
                        onClick=${() => this.saveEditField()}
                    >
                        保存
                    </button>
                    <button 
                        class="field-cancel-btn" 
                        onClick=${() => this.setState({ editingField: null, editingFieldData: null })}
                    >
                        取消
                    </button>
                </div>
            </div>
            <div class="field-details">
                <div class="field-detail-row">
                    <div class="detail-label">默认值:</div>
                    <div class="detail-input">
                        <input 
                            type="text" 
                            value=${editingFieldData.defaultValue || ''}
                            onChange=${(e: Event) => this.handleEditFieldChange('defaultValue', (e.target as HTMLInputElement).value)}
                            placeholder="不设置则为空"
                        />
                    </div>
                </div>
                <div class="field-detail-row">
                    <div class="detail-label">描述:</div>
                    <div class="detail-input">
                        <input 
                            type="text" 
                            value=${editingFieldData.description || ''}
                            onChange=${(e: Event) => this.handleEditFieldChange('description', (e.target as HTMLInputElement).value)}
                            placeholder="字段描述"
                        />
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染添加字段表单
    renderAddFieldForm() {
        const { newField } = this.state;
        
        return html`
            <div class="add-field-form">
                <h3>添加新字段</h3>
                
                <div class="field-form-row">
                    <div class="form-label">字段名:</div>
                    <div class="form-input">
                        <input 
                            type="text" 
                            value=${newField.name}
                            onChange=${(e: Event) => this.handleNewFieldChange('name', (e.target as HTMLInputElement).value)}
                            placeholder="输入字段名称"
                        />
                    </div>
                </div>
                
                <div class="field-form-row">
                    <div class="form-label">类型:</div>
                    <div class="form-input">
                        ${this.renderTypeSelector(
                            newField.type, 
                            (type) => this.handleNewFieldChange('type', type)
                        )}
                    </div>
                </div>
                
                <div class="field-form-row">
                    <div class="form-label">必需:</div>
                    <div class="form-input">
                        <input 
                            type="checkbox" 
                            checked=${newField.required}
                            onChange=${(e: Event) => this.handleNewFieldChange('required', (e.target as HTMLInputElement).checked)}
                        />
                    </div>
                </div>
                
                <div class="field-form-row">
                    <div class="form-label">默认值:</div>
                    <div class="form-input">
                        <input 
                            type="text" 
                            value=${newField.defaultValue || ''}
                            onChange=${(e: Event) => this.handleNewFieldChange('defaultValue', (e.target as HTMLInputElement).value)}
                            placeholder="不设置则为空"
                        />
                    </div>
                </div>
                
                <div class="field-form-row">
                    <div class="form-label">描述:</div>
                    <div class="form-input">
                        <input 
                            type="text" 
                            value=${newField.description || ''}
                            onChange=${(e: Event) => this.handleNewFieldChange('description', (e.target as HTMLInputElement).value)}
                            placeholder="字段描述"
                        />
                    </div>
                </div>
                
                <div class="field-form-actions">
                    <button 
                        class="add-field-btn" 
                        onClick=${() => this.addField(newField)}
                    >
                        添加字段
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染Schema JSON预览
    renderSchemaPreview() {
        const { schemaJson, jsonError } = this.state;
        
        return html`
            <div class="schema-preview">
                <h3>Schema JSON</h3>
                <div class="json-editor-container ${jsonError ? 'has-error' : ''}">
                    <textarea 
                        class="json-editor"
                        value=${schemaJson}
                        onChange=${(e: Event) => this.setState({ schemaJson: (e.target as HTMLTextAreaElement).value })}
                    ></textarea>
                </div>
                ${jsonError ? html`<div class="json-error">${jsonError}</div>` : null}
                <div class="preview-actions">
                    <button 
                        onClick=${() => this.updateSchemaFromJson(this.state.schemaJson)}
                        class="parse-json-btn"
                    >
                        解析JSON
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染Schema编辑和预览
    renderSchemaEditor() {
        const { schema, previewMode } = this.state;
        
        return html`
            <div class="schema-editor">
                <div class="schema-header">
                    <div class="schema-title-section">
                        <h2>数据Schema定义</h2>
                        <div class="schema-meta">
                            <input 
                                type="text" 
                                value=${schema.name}
                                onChange=${(e: Event) => {
                                    const updatedSchema = { ...schema, name: (e.target as HTMLInputElement).value };
                                    this.setState({ 
                                        schema: updatedSchema,
                                        schemaJson: JSON.stringify(updatedSchema, null, 2)
                                    });
                                }}
                                class="schema-name-input"
                                placeholder="Schema名称"
                            />
                            <div class="schema-version">版本: ${schema.version}</div>
                        </div>
                        <textarea 
                            value=${schema.description}
                            onChange=${(e: Event) => {
                                const updatedSchema = { ...schema, description: (e.target as HTMLTextAreaElement).value };
                                this.setState({ 
                                    schema: updatedSchema,
                                    schemaJson: JSON.stringify(updatedSchema, null, 2)
                                });
                            }}
                            class="schema-description"
                            placeholder="Schema描述"
                        ></textarea>
                    </div>
                    
                    <div class="schema-actions">
                        <button 
                            onClick=${() => this.togglePreviewMode()}
                            class="toggle-preview-btn"
                        >
                            ${previewMode ? '编辑模式' : 'JSON模式'}
                        </button>
                        <button 
                            onClick=${() => this.saveSchema()}
                            class="save-schema-btn"
                        >
                            保存Schema
                        </button>
                        <button 
                            onClick=${() => this.applySchema()}
                            class="apply-schema-btn"
                        >
                            应用到数据库
                        </button>
                    </div>
                </div>
                
                ${previewMode 
                    ? this.renderSchemaPreview() 
                    : html`
                        <div class="schema-content">
                            <div class="schema-fields">
                                <h3>字段定义</h3>
                                ${this.renderFieldList()}
                            </div>
                            ${this.renderAddFieldForm()}
                        </div>
                    `
                }
            </div>
        `;
    }

    render() {
        return html`
            <div class="schema-container">
                ${this.state.loading 
                    ? html`<div class="loading">加载Schema中...</div>` 
                    : this.renderSchemaEditor()
                }
            </div>
        `;
    }
}

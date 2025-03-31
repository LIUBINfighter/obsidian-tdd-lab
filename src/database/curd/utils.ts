import { App, TFile, Vault } from 'obsidian';

// 定义数据类型接口
export interface DataItem {
    id: string;
    [key: string]: any;
}

export interface IndexEntry {
    id: string;
    filePath: string;
}

export interface DatabaseSettings {
    dataFolder: string;
    indexFile: string;
    schemaFile?: string;
}

export interface DebugInfo {
    totalItems: number;
    dataFolder: string;
    indexFile: string;
    lastUpdated: string;
    indexSize: number;
    storageStats?: {
        totalSize: number;
        avgItemSize: number;
        largestItem: {
            id: string;
            size: number;
        };
    };
}

// Schema相关类型定义
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'text';

export interface SchemaField {
    name: string;
    type: FieldType;
    required: boolean;
    defaultValue?: any;
    description?: string;
    system?: boolean; // 系统字段不可删除
}

export interface DataSchema {
    name: string;
    description: string;
    fields: SchemaField[];
    indexFields: string[]; // 用于索引的字段
    version: number;
}

export const DEFAULT_DB_SETTINGS: DatabaseSettings = {
    dataFolder: 'tdd-lab-data',
    indexFile: 'data-index.json',
    schemaFile: 'data-schema.json'
}

export class DataManager {
    app: App;
    vault: Vault;
    settings: DatabaseSettings;

    private cacheCleanupInterval: number;

    constructor(app: App, settings?: Partial<DatabaseSettings>) {
        this.app = app;
        this.vault = app.vault;
        this.settings = { ...DEFAULT_DB_SETTINGS, ...settings };
        
        // 每5分钟清理一次缓存
        this.cacheCleanupInterval = window.setInterval(() => {
            this.clearCache();
        }, 5 * 60 * 1000);
    }

    // 清理缓存
    clearCache(): void {
        this.queryCache.clear();
        console.log('Query cache cleared');
    }

    // 确保数据目录存在
    async ensureDataFolder(): Promise<void> {
        try {
            await this.vault.createFolder(this.settings.dataFolder);
        } catch (err) {
            if (err.message !== 'Folder already exists.') {
                console.error('Error creating data folder:', err);
            }
        }
    }

    // 生成唯一ID
    generateId(): string {
        return 'item-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    // 获取索引文件路径
    getIndexFilePath(): string {
        return `${this.settings.dataFolder}/${this.settings.indexFile}`;
    }

    // 获取数据文件路径
    getDataFilePath(id: string): string {
        return `${this.settings.dataFolder}/${id}.json`;
    }

    // 获取Schema文件路径
    getSchemaFilePath(): string | null {
        if (!this.settings.schemaFile) return null;
        return `${this.settings.dataFolder}/${this.settings.schemaFile}`;
    }

    // 加载索引
    async loadIndex(): Promise<IndexEntry[]> {
        const indexPath = this.getIndexFilePath();
        const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
        
        if (indexFile && indexFile instanceof TFile) {
            const content = await this.vault.read(indexFile);
            return JSON.parse(content);
        }
        
        return [];
    }

    // 保存索引
    async saveIndex(index: IndexEntry[]): Promise<void> {
        const indexPath = this.getIndexFilePath();
        await this.vault.adapter.write(indexPath, JSON.stringify(index, null, 2));
    }

    // Schema相关方法
    async loadSchema(): Promise<DataSchema | null> {
        const schemaPath = this.getSchemaFilePath();
        if (!schemaPath) return null;
        
        try {
            const content = await this.vault.adapter.read(schemaPath);
            return JSON.parse(content);
        } catch (err) {
            console.error("Error loading schema:", err);
            return null;
        }
    }

    async saveSchema(schema: DataSchema): Promise<void> {
        const schemaPath = this.getSchemaFilePath();
        if (!schemaPath) return;
        
        await this.vault.adapter.write(schemaPath, JSON.stringify(schema, null, 2));
    }

    async applySchema(schema: DataSchema): Promise<void> {
        // 1. 保存schema
        await this.saveSchema(schema);
        
        // 2. 验证并更新现有数据
        const index = await this.loadIndex();
        for (const entry of index) {
            try {
                const content = await this.vault.adapter.read(entry.filePath);
                const item = JSON.parse(content);
                
                // 验证数据是否符合新schema
                const validation = await this.validateData(item, schema);
                if (!validation.valid) {
                    console.warn(`Data item ${entry.id} does not match new schema: ${validation.errors.join(', ')}`);
                }
                
                // 更新数据文件
                await this.vault.adapter.write(entry.filePath, JSON.stringify(item, null, 2));
            } catch (err) {
                console.error(`Error applying schema to data item ${entry.id}:`, err);
            }
        }
    }

    async validateData(data: DataItem, schema?: DataSchema): Promise<{valid: boolean, errors: string[]}> {
        const errors: string[] = [];
        const currentSchema = schema || await this.loadSchema();
        
        if (!currentSchema) return {valid: true, errors};
        
        // 验证必填字段
        currentSchema.fields.forEach(field => {
            if (field.required && data[field.name] === undefined) {
                errors.push(`Missing required field: ${field.name}`);
            }
        });

        // 验证字段类型
        currentSchema.fields.forEach(field => {
            if (data[field.name] !== undefined) {
                const value = data[field.name];
                let valid = true;
                
                switch(field.type) {
                    case 'string':
                        valid = typeof value === 'string';
                        break;
                    case 'number':
                        valid = typeof value === 'number';
                        break;
                    case 'boolean':
                        valid = typeof value === 'boolean';
                        break;
                    case 'date':
                        valid = !isNaN(new Date(value).getTime());
                        break;
                    case 'array':
                        valid = Array.isArray(value);
                        break;
                    case 'object':
                        valid = typeof value === 'object' && !Array.isArray(value);
                        break;
                }
                
                if (!valid) {
                    errors.push(`Invalid type for field ${field.name}: expected ${field.type}, got ${typeof value}`);
                }
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // 创建数据 (Create)
    async createData(data: DataItem): Promise<DataItem> {
        // 验证数据
        const validation = await this.validateData(data);
        if (!validation.valid) {
            throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
        }
        
        // 确保有ID
        if (!data.id) {
            data.id = this.generateId();
        }
        
        // 保存数据文件
        const filePath = this.getDataFilePath(data.id);
        await this.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
        
        // 更新索引
        const index = await this.loadIndex();
        index.push({
            id: data.id,
            filePath: filePath
        });
        await this.saveIndex(index);
        
        return data;
    }

    // 读取数据 (Read)
    async readData(id: string): Promise<DataItem | null> {
        const index = await this.loadIndex();
        const entry = index.find(item => item.id === id);
        
        if (!entry) return null;
        
        try {
            const content = await this.vault.adapter.read(entry.filePath);
            return JSON.parse(content);
        } catch (err) {
            console.error(`Error reading data file for ID ${id}:`, err);
            return null;
        }
    }

    // 读取所有数据
    async readAllData(): Promise<DataItem[]> {
        const index = await this.loadIndex();
        const allData: DataItem[] = [];
        
        for (const entry of index) {
            try {
                const content = await this.vault.adapter.read(entry.filePath);
                allData.push(JSON.parse(content));
            } catch (err) {
                console.error(`Error reading data file for ID ${entry.id}:`, err);
            }
        }
        
        return allData;
    }

    // 更新数据 (Update)
    async updateData(id: string, newData: Partial<DataItem>): Promise<DataItem | null> {
        const existingData = await this.readData(id);
        if (!existingData) return null;
        
        // 合并数据
        const updatedData = { ...existingData, ...newData, id };
        
        // 验证数据
        const validation = await this.validateData(updatedData);
        if (!validation.valid) {
            throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
        }
        
        // 保存更新后的数据
        const filePath = this.getDataFilePath(id);
        await this.vault.adapter.write(filePath, JSON.stringify(updatedData, null, 2));
        
        return updatedData;
    }

    // 删除数据 (Delete)
    async deleteData(id: string): Promise<boolean> {
        const index = await this.loadIndex();
        const entryIndex = index.findIndex(item => item.id === id);
        
        if (entryIndex === -1) return false;
        
        // 删除数据文件
        try {
            await this.vault.adapter.remove(index[entryIndex].filePath);
        } catch (err) {
            console.error(`Error deleting data file for ID ${id}:`, err);
        }
        
        // 更新索引
        index.splice(entryIndex, 1);
        await this.saveIndex(index);
        
        return true;
    }

    private queryCache = new Map<string, DataItem[]>();
    
    // 增强搜索功能
    async searchData(query: string, field?: string): Promise<DataItem[]> {
        const cacheKey = `${field || '*'}:${query}`;
        
        // 检查缓存
        if (this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey)!;
        }
        
        const index = await this.loadIndex();
        const results: DataItem[] = [];
        
        // 按需加载数据文件
        for (const entry of index) {
            try {
                const content = await this.vault.adapter.read(entry.filePath);
                const item = JSON.parse(content);
                
                // 字段级查询
                if (field) {
                    if (item[field] && String(item[field]).toLowerCase().includes(query.toLowerCase())) {
                        results.push(item);
                    }
                }
                // 全局查询
                else if (JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) {
                    results.push(item);
                }
            } catch (err) {
                console.error(`Error searching data file for ID ${entry.id}:`, err);
            }
        }
        
        // 更新缓存
        this.queryCache.set(cacheKey, results);
        return results;
    }

    // 获取原始JSON数据
    async getRawJson(id: string): Promise<string | null> {
        const index = await this.loadIndex();
        const entry = index.find(item => item.id === id);
        
        if (!entry) return null;
        
        try {
            return await this.vault.adapter.read(entry.filePath);
        } catch (err) {
            console.error(`Error reading raw JSON for ID ${id}:`, err);
            return null;
        }
    }

    // 获取调试信息
    async getDebugInfo(): Promise<DebugInfo> {
        const index = await this.loadIndex();
        const indexContent = JSON.stringify(index);
        const lastUpdated = new Date().toLocaleString();
        
        let storageStats = undefined;
        
        try {
            let totalSize = 0;
            let largestItemSize = 0;
            let largestItemId = '';
            
            // 获取每个数据文件的大小
            for (const entry of index) {
                const file = this.app.vault.getAbstractFileByPath(entry.filePath);
                if (file && file instanceof TFile) {
                    const size = file.stat.size;
                    totalSize += size;
                    
                    if (size > largestItemSize) {
                        largestItemSize = size;
                        largestItemId = entry.id;
                    }
                }
            }
            
            const avgItemSize = index.length > 0 ? Math.round(totalSize / index.length) : 0;
            
            storageStats = {
                totalSize,
                avgItemSize,
                largestItem: {
                    id: largestItemId,
                    size: largestItemSize
                }
            };
        } catch (error) {
            console.error("Error calculating storage stats:", error);
        }
        
        return {
            totalItems: index.length,
            dataFolder: this.settings.dataFolder,
            indexFile: this.settings.indexFile,
            lastUpdated,
            indexSize: indexContent.length,
            storageStats
        };
    }

    // 格式化数据为表格格式
    formatAsTable(items: DataItem[]): string {
        if (items.length === 0) return "No data";
        
        // 获取所有可能的键
        const allKeys = new Set<string>();
        items.forEach(item => {
            Object.keys(item).forEach(key => allKeys.add(key));
        });

        const keys = Array.from(allKeys);
        let table = keys.join('\t') + '\n';
        
        items.forEach(item => {
            const row = keys.map(key => {
                const value = item[key];
                if (value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
            }).join('\t');
            table += row + '\n';
        });
        
        return table;
    }

    // 检查数据完整性
    async checkDataIntegrity(): Promise<{valid: boolean, issues: string[]}> {
        const issues: string[] = [];
        const index = await this.loadIndex();
        
        // 检查索引中的文件是否存在
        for (const entry of index) {
            const file = this.app.vault.getAbstractFileByPath(entry.filePath);
            if (!file || !(file instanceof TFile)) {
                issues.push(`Missing file: ${entry.filePath} for ID: ${entry.id}`);
                continue;
            }
            
            // 检查文件内容是否是有效的JSON
            try {
                const content = await this.vault.read(file);
                JSON.parse(content);
            } catch (err) {
                issues.push(`Invalid JSON in file: ${entry.filePath} for ID ${entry.id}`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }

    // 在系统文件浏览器中打开数据目录
    async openDataFolderInExplorer(): Promise<void> {
        try {
            // 检查文件夹是否存在
            const folderExists = await this.vault.adapter.exists(this.settings.dataFolder);
            if (!folderExists) {
                await this.vault.createFolder(this.settings.dataFolder);
            }
            
            // 在系统默认应用中打开
            await (this.app as any).openWithDefaultApp(this.settings.dataFolder);
        } catch (error) {
            console.error("Error opening data folder in explorer:", error);
            throw error;
        }
    }
}

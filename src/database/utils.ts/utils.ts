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
    dataFolder: '.data', // 改为 .data 作为插件目录内的隐藏文件夹
    indexFile: 'data-index.json',
    schemaFile: 'data-schema.json'
}

export class DataManager {
    app: App;
    vault: Vault;
    settings: DatabaseSettings;
    pluginDir: string;

    private cacheCleanupInterval: number;

    constructor(app: App, pluginDir: string, settings?: Partial<DatabaseSettings>) {
        this.app = app;
        this.vault = app.vault;
        this.settings = { ...DEFAULT_DB_SETTINGS, ...settings };
        this.pluginDir = pluginDir;
        
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

    // 获取插件数据目录的完整路径
    getPluginDataPath(): string {
        // 检查dataFolder是否为绝对路径或以./开头的相对路径
        if (this.settings.dataFolder.startsWith('/') || 
            this.settings.dataFolder.startsWith('./') ||
            this.settings.dataFolder.startsWith('../')) {
            // 这是vault相对路径或绝对路径
            return this.settings.dataFolder;
        }
        
        // 否则，将其视为插件目录的相对路径
        return `${this.pluginDir}/${this.settings.dataFolder}`;
    }

    // 确保数据目录存在
    async ensureDataFolder(): Promise<void> {
        const folderPath = this.getPluginDataPath();
        
        try {
            // 递归创建可能不存在的父目录
            await this.vault.adapter.mkdir(folderPath, { recursive: true });
            console.log(`Data folder ensured at: ${folderPath}`);
        } catch (err) {
            if (err.message !== 'Folder already exists.') {
                console.error('Error creating data folder:', err);
                throw err;
            }
        }
    }

    // 生成唯一ID
    generateId(): string {
        return 'item-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    // 获取索引文件路径
    getIndexFilePath(): string {
        return `${this.getPluginDataPath()}/${this.settings.indexFile}`;
    }

    // 获取数据文件路径
    getDataFilePath(id: string): string {
        return `${this.getPluginDataPath()}/${id}.json`;
    }

    // 获取Schema文件路径
    getSchemaFilePath(): string {
        return `${this.getPluginDataPath()}/${this.settings.schemaFile || 'data-schema.json'}`;
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
    async getSchema(): Promise<DataSchema | null> {
        return this.loadSchema();
    }

    // 加载Schema
    async loadSchema(): Promise<DataSchema | null> {
        const schemaPath = this.getSchemaFilePath();
        
        try {
            const exists = await this.vault.adapter.exists(schemaPath);
            if (!exists) return null;
            
            const content = await this.vault.adapter.read(schemaPath);
            return JSON.parse(content);
        } catch (error) {
            console.error("Error loading schema:", error);
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

    // 初始化数据库
    async initializeDatabase(): Promise<void> {
        console.log("Initializing database...");
        
        try {
            // 1. 确保数据目录存在
            await this.ensureDataFolder();
            
            // 2. 检查索引文件是否存在，不存在则创建
            const indexPath = this.getIndexFilePath();
            const indexExists = await this.vault.adapter.exists(indexPath);
            
            if (!indexExists) {
                console.log("Creating new index file at:", indexPath);
                await this.saveIndex([]);
            }
            
            // 3. 检查Schema文件是否存在，不存在则创建默认Schema
            const schemaPath = this.getSchemaFilePath();
            const schemaExists = await this.vault.adapter.exists(schemaPath);
            
            if (!schemaExists) {
                console.log("Creating default schema at:", schemaPath);
                const defaultSchema: DataSchema = {
                    name: "默认Schema",
                    description: "自动创建的默认Schema",
                    fields: [
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
                    ],
                    indexFields: ['id', 'title'],
                    version: 1
                };
                await this.saveSchema(defaultSchema);
            }
            
            // 4. 如果需要，可以在这里添加数据迁移逻辑
            
            console.log("Database initialization complete");
        } catch (error) {
            console.error("Error initializing database:", error);
            throw error;
        }
    }
    
    // 创建示例数据 - 确保可以被统一调用
    async createSampleData(): Promise<DataItem> {
        console.log("Creating sample data...");
        
        // 确保数据库已初始化
        await this.ensureDataFolder();
        
        try {
            // 创建一个示例数据项
            const newItem: DataItem = {
                id: this.generateId(),
                title: `示例数据 ${new Date().toLocaleTimeString()}`,
                content: '这是一个自动创建的示例数据项',
                createdAt: new Date().toISOString()
            };
            
            // 使用标准方法保存
            const savedItem = await this.createData(newItem);
            console.log("Sample data created successfully:", savedItem);
            
            return savedItem;
        } catch (error) {
            console.error("Error creating sample data:", error);
            throw error;
        }
    }

    // 创建数据 (Create)
    async createData(data: DataItem): Promise<DataItem> {
        console.log("Creating data:", data);
        
        // 确保数据目录存在
        await this.ensureDataFolder();
        
        // 验证数据
        const validation = await this.validateData(data);
        if (!validation.valid) {
            const errorMsg = `Data validation failed: ${validation.errors.join(', ')}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // 确保有ID
        if (!data.id) {
            data.id = this.generateId();
            console.log("Generated ID for data:", data.id);
        }
        
        try {
            // 保存数据文件
            const filePath = this.getDataFilePath(data.id);
            console.log("Writing data file to:", filePath);
            await this.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
            
            // 更新索引
            const indexPath = this.getIndexFilePath();
            console.log("Updating index file at:", indexPath);
            
            let index: IndexEntry[] = [];
            try {
                // 尝试读取现有索引
                index = await this.loadIndex();
            } catch (error) {
                console.warn("Could not load existing index, creating new:", error);
            }
            
            // 添加新条目或更新现有条目
            const existingEntryIndex = index.findIndex(entry => entry.id === data.id);
            if (existingEntryIndex >= 0) {
                index[existingEntryIndex].filePath = filePath;
            } else {
                index.push({
                    id: data.id,
                    filePath: filePath
                });
            }
            
            // 保存更新后的索引
            await this.saveIndex(index);
            console.log("Index updated successfully");
            
            return data;
        } catch (error) {
            console.error("Error creating data:", error);
            throw error;
        }
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
        console.log("Reading all data...");
        
        try {
            // 读取索引
            const indexPath = this.getIndexFilePath();
            console.log("Loading index from:", indexPath);
            
            let index: IndexEntry[] = [];
            try {
                index = await this.loadIndex();
            } catch (error) {
                console.warn("Error loading index:", error);
                return [];
            }
            
            console.log(`Found ${index.length} items in index`);
            
            if (index.length === 0) {
                console.log("No data found in index");
                return [];
            }
            
            const allData: DataItem[] = [];
            
            // 读取每个数据文件
            for (const entry of index) {
                try {
                    console.log(`Reading data file: ${entry.filePath} for ID: ${entry.id}`);
                    const content = await this.vault.adapter.read(entry.filePath);
                    allData.push(JSON.parse(content));
                } catch (err) {
                    console.error(`Error reading data file for ID ${entry.id}:`, err);
                }
            }
            
            console.log(`Successfully read ${allData.length} data items`);
            return allData;
        } catch (error) {
            console.error("Error reading all data:", error);
            return [];
        }
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
            const folderPath = this.getPluginDataPath();
            const folderExists = await this.vault.adapter.exists(folderPath);
            if (!folderExists) {
                await this.vault.adapter.mkdir(folderPath);
            }
            
            // 在系统默认应用中打开
            await (this.app as any).openWithDefaultApp(folderPath);
        } catch (error) {
            console.error("Error opening data folder in explorer:", error);
            throw error;
        }
    }
}

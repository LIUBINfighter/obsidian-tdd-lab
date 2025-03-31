import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

// 定义JSON视图类型
export const JSON_VIEW_TYPE = 'json-view';

export class JSONView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return JSON_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'JSON Viewer';
    }

    getIcon(): string {
        return 'file-json'; // Obsidian内置的JSON文件图标
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // 创建内容容器
        const contentContainer = container.createDiv('json-content-container');
        
        // 初始渲染内容
        this.renderContent(contentContainer);
    }

    async onClose() {
        // 清理工作
    }

    private renderContent(container: HTMLElement) {
        // 初始渲染一个简单的占位内容
        render(html`
            <div class="json-viewer">
                <h3>JSON Viewer</h3>
                <p>Open a JSON file to view its contents</p>
            </div>
        `, container);
    }
}

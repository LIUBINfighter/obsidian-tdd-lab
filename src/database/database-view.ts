import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render, Component } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

// Define the view type
export const DATABASE_VIEW_TYPE = 'database-view';

// Define a simple Preact component
class ExamplePreactComponent extends Component {
    render() {
        return html`<div>Hello, Preact!</div>`;
    }
}

export class DatabaseView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return DATABASE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Database View';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        render(html`<${ExamplePreactComponent} />`, container);
    }

    async onClose() {
        // Nothing to clean up.
    }
}

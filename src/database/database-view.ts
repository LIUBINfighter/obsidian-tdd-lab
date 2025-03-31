import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import htm from 'htm';
import { Readme } from './Componets/Readme';

const html = htm.bind(h);

// Define the view type
export const DATABASE_VIEW_TYPE = 'database-view';

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
        render(html`<${Readme} />`, container);
    }

    async onClose() {
        // Nothing to clean up.
    }
}

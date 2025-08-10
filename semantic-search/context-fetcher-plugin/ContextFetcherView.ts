import { ItemView, WorkspaceLeaf, Notice, TFile, App } from 'obsidian';
import type { ContextItem } from './ContextFetcherService';

export const VIEW_TYPE_CONTEXT_FETCHER = "context-fetcher-view";

export class ContextFetcherView extends ItemView {
    private contextItems: ContextItem[] = [];
    private isLoading = false;
    private plugin: any;

    constructor(leaf: WorkspaceLeaf, plugin: any) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return VIEW_TYPE_CONTEXT_FETCHER; }
    getDisplayText() { return "Semantic Context Fetcher"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        const headerDiv = container.createDiv({ cls: 'context-header' });
        headerDiv.createEl("h4", { text: "Semantic Context Fetcher" });
        const refreshButton = headerDiv.createEl("button", {
            text: "↻",
            cls: "context-refresh-button",
            attr: { "aria-label": "Fetch new context" }
        });
        refreshButton.addEventListener('click', () => {
            this.plugin.fetchContextForCurrentNote();
        });
        const stopButton = headerDiv.createEl("button", {
            text: "✋",
            cls: "context-stop-button",
            attr: { "aria-label": "Stop context fetch" }
        });
        stopButton.addEventListener('click', () => {
            this.plugin.stopCurrentProcess();
        });
        this.renderContent();
    }

    async onClose() { }

    setLoading(loading: boolean) {
        this.isLoading = loading;
        this.renderContent();
    }

    updateContext(items: ContextItem[]) {
        this.contextItems = items;
        this.renderContent();
    }

    private renderContent() {
        const container = this.containerEl.children[1];
        const existingContent = container.querySelector('.context-content');
        if (existingContent) existingContent.remove();
        const contentDiv = container.createDiv({ cls: 'context-content' });
        if (this.isLoading) {
            contentDiv.createEl('div', { text: 'Loading context...', cls: 'loading-message' });
            return;
        }
        if (this.contextItems.length === 0) {
            contentDiv.createEl('div', { text: 'No context items. Fetch context for a note to see relevant information here.', cls: 'empty-message' });
            return;
        }
        this.contextItems.forEach((item) => {
            const itemDiv = contentDiv.createDiv({ cls: 'context-item' });
            const typeDiv = itemDiv.createDiv({ cls: 'context-type' });
            typeDiv.createEl('span', { text: item.type, cls: `type-${item.type}` });
            const noteDiv = itemDiv.createDiv({ cls: 'context-note' });
            const noteLink = noteDiv.createEl('a', { text: item.note, cls: 'context-note-link', href: '#' });
            noteLink.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await this.app.workspace.openLinkText(
                        item.note,
                        this.app.workspace.getActiveFile()?.path || "",
                        true
                    );
                } catch (err) {
                    new Notice(`Could not open link: ${item.note}`);
                }
            });
            if (item.anchor) {
                noteDiv.createEl('span', { text: ` ${item.anchor}`, cls: 'context-anchor' });
            }
            const excerptDiv = itemDiv.createDiv({ cls: 'context-excerpt' });
            excerptDiv.createEl('p', { text: item.excerpt });
            const reasonDiv = itemDiv.createDiv({ cls: 'context-reason' });
            reasonDiv.createEl('em', { text: item.reason });
            const actionDiv = itemDiv.createDiv({ cls: 'context-action' });
            actionDiv.createEl('span', { text: `Action: ${item.action}`, cls: 'action-suggestion' });
        });
    }
}

import { ItemView, WorkspaceLeaf, Notice, TFile, App } from 'obsidian';
import { ContextFetcherService, ContextItem } from './services/ContextFetcherService';

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

    private formatDate(timestamp: number): string {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleString(); // Adjust format as needed
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // Row 1: Plugin Name and Description
        const headerDiv = container.createDiv({ cls: 'context-header' });
        headerDiv.createEl("h2", { text: "Semantic Context Fetcher" });
        headerDiv.createEl("p", { text: "AI-powered semantic search and contextual retrieval from your notes.", cls: 'plugin-description' });

        // Row 2: Indexed Document Count and Refresh
        const statsRow = container.createDiv({ cls: 'context-stats-row' });
        const totalDocsSpan = statsRow.createEl('span', { text: `Total Indexed Documents: ${this.plugin.settings.totalDocuments}`, cls: 'total-docs-value' });
        const lastUpdatedSpan = statsRow.createEl('span', { text: `Last Updated: ${this.formatDate(this.plugin.settings.lastIndexedDate)}`, cls: 'last-updated-value' });
        const refreshStatsButton = statsRow.createEl('button', { text: 'Refresh', cls: 'context-button small-button' });
        refreshStatsButton.addEventListener('click', async () => {
            await this.plugin.updateTotalDocumentsSetting();
            this.renderContent(); // Re-render to update last updated date
        });

        // Row 3: Indexing Controls
        const indexingControlsDiv = container.createDiv({ cls: 'context-controls-row indexing-controls' });
        indexingControlsDiv.createEl('span', { text: 'Indexing:', cls: 'control-label' });
        const reindexAllButton = indexingControlsDiv.createEl('button', { text: 'Reindex All', cls: 'context-button' });
        reindexAllButton.addEventListener('click', async () => {
            await this.plugin.reindexAllNotes();
        });

        const indexCurrentNoteButton = indexingControlsDiv.createEl('button', { text: 'Index Current Note', cls: 'context-button' });
        indexCurrentNoteButton.addEventListener('click', async () => {
            await this.plugin.indexCurrentNote();
        });

        const indexFolderButton = indexingControlsDiv.createEl('button', { text: 'Index Folder', cls: 'context-button' });
        indexFolderButton.addEventListener('click', async () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('No active note. Please open a note in the folder you wish to index.');
                return;
            }
            const folderPath = activeFile.parent?.path;
            if (folderPath) {
                await this.plugin.indexFolder(folderPath);
            } else {
                new Notice('Could not determine folder path for the active note.');
            }
        });

        // Row 4: Search Controls
        const searchControlsDiv = container.createDiv({ cls: 'context-controls-row search-controls' });
        searchControlsDiv.createEl('span', { text: 'Search:', cls: 'control-label' });
        const searchInput = searchControlsDiv.createEl('input', { type: 'text', placeholder: 'Search context...', cls: 'context-search-input' });
        const searchButton = searchControlsDiv.createEl('button', { text: 'Search', cls: 'context-button' });
        searchButton.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (query) {
                await this.plugin.service.searchQuery(query, this.setLoading.bind(this), this.updateContext.bind(this));
            } else {
                new Notice('Please enter a search query.');
            }
        });

        const useCurrentNoteButton = searchControlsDiv.createEl('button', { text: 'Use Current Note', cls: 'context-button' });
        useCurrentNoteButton.addEventListener('click', () => {
            this.plugin.fetchContextForCurrentNote();
        });

        const clearButton = searchControlsDiv.createEl('button', { text: 'Clear', cls: 'context-button' });
        clearButton.addEventListener('click', () => {
            this.updateContext([]);
        });

        // Row 5: Search Results (scrollable area)
        const scrollableDiv = container.createDiv({ cls: 'context-scrollable-content' });
        
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

    updateTotalDocuments(count: number) {
        const totalDocsSpan = this.containerEl.querySelector('.total-docs-value');
        if (totalDocsSpan) {
            totalDocsSpan.setText(count.toString());
        }
    }

    updateLastIndexedDate(timestamp: number) {
        const lastUpdatedSpan = this.containerEl.querySelector('.last-updated-value');
        if (lastUpdatedSpan) {
            lastUpdatedSpan.setText(`Last Updated: ${this.formatDate(timestamp)}`);
        }
    }

    private renderContent() {
        const container = this.containerEl.children[1];
        const scrollableContainer = container.querySelector('.context-scrollable-content');
        if (!scrollableContainer) return;
        
        const existingContent = scrollableContainer.querySelector('.context-content');
        if (existingContent) existingContent.remove();
        
        const contentDiv = scrollableContainer.createDiv({ cls: 'context-content' });
        
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
            reasonDiv.createEl('small', { text: item.reason, cls: 'distance-info' });
        });
    }
}

import { App, FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ContextFetcherService, ContextItem } from './services/ContextFetcherService';
import { ContextFetcherView, VIEW_TYPE_CONTEXT_FETCHER } from './ContextFetcherView';
import { ChromaDBSettings } from './services/ChromaDBService';

interface ContextFetcherPluginSettings {
	chromaHost: string;
	chromaPort: number;
	chromaCollectionName: string;
	pythonPath: string;
	searchMaxResults: number;
	foldersToIndex: string;
	totalDocuments: number;
	lastIndexedDate: number; // Timestamp
}

const DEFAULT_SETTINGS: ContextFetcherPluginSettings = {
	chromaHost: 'localhost',
	chromaPort: 8000,
	chromaCollectionName: 'notes',
	pythonPath: 'python3',
	searchMaxResults: 10,
	foldersToIndex: 'learnings,Meetings,My Daily Notes,my_prompts,PWD',
	totalDocuments: 0,
	lastIndexedDate: 0,
};

export default class ContextFetcherPlugin extends Plugin {
	settings: ContextFetcherPluginSettings;
	service: ContextFetcherService;
	contextView: ContextFetcherView | null = null;

	async onload() {
		await this.loadSettings();
		const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		const pluginDir = require('path').join(vaultPath, '.obsidian', 'plugins', 'context-fetcher-plugin');
		const chromaSettings: ChromaDBSettings = {
			host: this.settings.chromaHost,
			port: this.settings.chromaPort,
			collectionName: this.settings.chromaCollectionName,
			pythonPath: this.settings.pythonPath,
			pluginDir: pluginDir,
			searchMaxResults: this.settings.searchMaxResults,
			foldersToIndex: this.settings.foldersToIndex
		};
		this.service = new ContextFetcherService(chromaSettings);

		this.registerView(
			VIEW_TYPE_CONTEXT_FETCHER,
			(leaf) => {
				const view = new ContextFetcherView(leaf, this);
				this.contextView = view;
				return view;
			}
		);

		this.addRibbonIcon('brain-circuit', 'Semantic Context Fetcher', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'fetch-context',
			name: 'Fetch Context for Current Note',
			callback: () => {
				this.fetchContextForCurrentNote();
			}
		});

		this.addCommand({
			id: 'reindex-all-notes',
			name: 'Reindex All Notes',
			callback: async () => {
				await this.reindexAllNotes();
			}
		});

		this.addCommand({
			id: 'index-current-note',
			name: 'Index Current Note',
			callback: async () => {
				await this.indexCurrentNote();
			}
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) {
				new Notice('Could not open context fetcher view: no available leaf');
				return;
			}
			await leaf.setViewState({ type: VIEW_TYPE_CONTEXT_FETCHER, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	async fetchContextForCurrentNote() {
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			const allLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (allLeaves.length > 0) {
				activeView = allLeaves[0].view as MarkdownView;
			}
		}
		if (!activeView) {
			new Notice('No markdown view available');
			return;
		}
		const file = activeView.file;
		if (!file) {
			new Notice('No file in active view');
			return;
		}
		const contextView = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER)[0]?.view as ContextFetcherView;
		const setLoading = (loading: boolean) => contextView && contextView.setLoading(loading);
		const updateContext = (items: ContextItem[]) => contextView && contextView.updateContext(items);

		if (contextView) contextView.setLoading(true);
		await this.service.fetchContext({
			app: this.app,
			file,
			setLoading,
			updateContext
		});
	}

	async updateTotalDocumentsSetting() {
		const count = await this.service.getDocumentsCount();
		this.settings.totalDocuments = count;
		this.settings.lastIndexedDate = Date.now(); // Update timestamp
		await this.saveSettings();
		if (this.contextView) {
			this.contextView.updateTotalDocuments(count);
			this.contextView.updateLastIndexedDate(this.settings.lastIndexedDate);
		}
	}

	async reindexAllNotes() {
		try {
			new Notice('Starting full reindex...');
			const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
			await this.service.clearAllIndexes(vaultPath);
			await this.service.indexAllFolders(vaultPath);
			await this.updateTotalDocumentsSetting();
			new Notice('Full reindex complete.');
		} catch (error) {
			console.error('Error during full reindex:', error);
			new Notice(`Reindex failed: ${error.message}`);
		}
	}

	async indexCurrentNote() {
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			const allLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (allLeaves.length > 0) {
				activeView = allLeaves[0].view as MarkdownView;
			}
		}
		if (!activeView || !activeView.file) {
			new Notice('No active note to index.');
			return;
		}
		        const file = activeView.file;
		        try {
		            // new Notice(`Indexing current note: ${file.basename}...`); // Removed initial notice
		            const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		            await this.service.indexCurrentFile(file.path, vaultPath);
		            await this.updateTotalDocumentsSetting();
		            new Notice(`Current note '${file.basename}' indexed successfully.`);
		        } catch (error) {
		            console.error('Error indexing current note:', error);
		            new Notice(`Indexing of '${file.basename}' failed: ${error.message}`);
		        }	}

	async indexFolder(folderPath: string) {
		try {
			const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
			await this.service.indexFolder(folderPath, vaultPath);
			await this.updateTotalDocumentsSetting();
		} catch (error) {
			console.error('Error indexing folder:', error);
			new Notice(`Indexing folder failed: ${error.message}`);
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER);
	}

	async loadSettings(): Promise<ContextFetcherPluginSettings> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		return this.settings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: ContextFetcherPlugin;
	constructor(app: App, plugin: ContextFetcherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Context Fetcher Settings' });

		new Setting(containerEl)
			.setName('ChromaDB Host')
			.setDesc('ChromaDB server host address')
			.addText(text => text
				.setPlaceholder('localhost')
				.setValue(this.plugin.settings.chromaHost)
				.onChange(async (value) => {
					this.plugin.settings.chromaHost = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ChromaDB Port')
			.setDesc('ChromaDB server port')
			.addText(text => text
				.setPlaceholder('8000')
				.setValue(this.plugin.settings.chromaPort.toString())
				.onChange(async (value) => {
					const port = parseInt(value);
					if (!isNaN(port)) {
						this.plugin.settings.chromaPort = port;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Collection Name')
			.setDesc('ChromaDB collection name for your notes')
			.addText(text => text
				.setPlaceholder('notes')
				.setValue(this.plugin.settings.chromaCollectionName)
				.onChange(async (value) => {
					this.plugin.settings.chromaCollectionName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Python Path')
			.setDesc('Path to Python executable')
			.addText(text => text
				.setPlaceholder('/usr/bin/python3')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Search Max Results')
			.setDesc('Number of top results to return for each query.')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(this.plugin.settings.searchMaxResults.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num)) {
						this.plugin.settings.searchMaxResults = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Folders to Index')
			.setDesc('Comma-separated list of folders to include in indexing.')
			.addTextArea(text => text
				.setPlaceholder('learnings,Meetings,My Daily Notes')
				.setValue(this.plugin.settings.foldersToIndex)
				.onChange(async (value) => {
					this.plugin.settings.foldersToIndex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Total Documents')
			.setDesc('Total number of indexed documents (read-only).')
			.addText(text => text
				.setValue(this.plugin.settings.totalDocuments.toString())
				.setDisabled(true));
	}
}
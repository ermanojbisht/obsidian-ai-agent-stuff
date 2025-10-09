import { App, FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ContextFetcherService, ContextItem } from './services/ContextFetcherService';
import { ContextFetcherView, VIEW_TYPE_CONTEXT_FETCHER } from './ContextFetcherView';
import { ChromaDBSettings } from './services/ChromaDBService';

/**
 * Interface for the plugin's settings.
 */
interface ContextFetcherPluginSettings {
	chromaHost: string; // Host address for the ChromaDB server.
	chromaPort: number; // Port number for the ChromaDB server.
	chromaCollectionName: string; // Name of the ChromaDB collection to use.
	pythonPath: string; // Path to the Python executable.
	searchMaxResults: number; // Maximum number of search results to return.
	foldersToIndex: string; // Comma-separated list of folders to index.
	totalDocuments: number; // Total number of documents currently indexed in ChromaDB.
	lastIndexedDate: number; // Timestamp of the last indexing operation.
}

/**
 * Default settings for the Context Fetcher Plugin.
 */
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

/**
 * Main class for the Context Fetcher Plugin.
 * Manages plugin lifecycle, settings, UI, and interactions with the ChromaDB service.
 */
export default class ContextFetcherPlugin extends Plugin {
	settings: ContextFetcherPluginSettings; // Current plugin settings.
	service: ContextFetcherService; // Instance of the ContextFetcherService.
	contextView: ContextFetcherView | null = null; // Reference to the plugin's view.

	/**
	 * Called when the plugin is loaded.
	 * Initializes settings, ChromaDB service, registers views, ribbon icons, and commands.
	 */
	async onload() {
		await this.loadSettings();
		// Determine the vault path and plugin directory for Python script execution.
		const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		const pluginDir = require('path').join(vaultPath, '.obsidian', 'plugins', 'context-fetcher-plugin');
		
		// Initialize ChromaDB settings.
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

		// Register the Context Fetcher View.
		this.registerView(
			VIEW_TYPE_CONTEXT_FETCHER,
			(leaf) => {
				const view = new ContextFetcherView(leaf, this);
				this.contextView = view;
				return view;
			}
		);

		// Add a ribbon icon to activate the view.
		this.addRibbonIcon('brain-circuit', 'Semantic Context Fetcher', () => {
			this.activateView();
		});

		// Register commands for various plugin actions.
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

		// Add the plugin's settings tab.
		this.addSettingTab(new SettingTab(this.app, this));
	}

	/**
	 * Activates and reveals the Context Fetcher View.
	 */
	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER);
		if (leaves.length > 0) {
			leaf = leaves[0]; // If a view already exists, use it.
		} else {
			leaf = workspace.getRightLeaf(false); // Otherwise, create a new leaf on the right.
			if (!leaf) {
				new Notice('Could not open context fetcher view: no available leaf');
				return;
			}
			await leaf.setViewState({ type: VIEW_TYPE_CONTEXT_FETCHER, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	/**
	 * Fetches context for the currently active Markdown note.
	 * Updates the Context Fetcher View with the retrieved context items.
	 */
	async fetchContextForCurrentNote() {
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// If no active Markdown view, try to find any Markdown leaf.
		if (!activeView) {
			const allLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (allLeaves.length > 0) {
				activeView = allLeaves[0].view as MarkdownView;
			}
		}
		// If still no active view or file, show a notice and return.
		if (!activeView) {
			new Notice('No markdown view available');
			return;
		}
		const file = activeView.file;
		if (!file) {
			new Notice('No file in active view');
			return;
		}
		// Get the context view instance and prepare callbacks for loading and updating context.
		const contextView = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER)[0]?.view as ContextFetcherView;
		const setLoading = (loading: boolean) => contextView && contextView.setLoading(loading);
		const updateContext = (items: ContextItem[]) => contextView && contextView.updateContext(items);

		// Set loading state and fetch context.
		if (contextView) contextView.setLoading(true);
		await this.service.fetchContext({
			app: this.app,
			file,
			setLoading,
			updateContext
		});
	}

	/**
	 * Updates the total document count and last indexed date in settings and the UI.
	 */
	async updateTotalDocumentsSetting() {
		const count = await this.service.getDocumentsCount();
		this.settings.totalDocuments = count;
		this.settings.lastIndexedDate = Date.now(); // Update timestamp to current time.
		await this.saveSettings();
		// Update the UI if the context view is active.
		if (this.contextView) {
			this.contextView.updateTotalDocuments(count);
			this.contextView.updateLastIndexedDate(this.settings.lastIndexedDate);
		}
	}

	/**
	 * Initiates a full reindexing of all configured notes in the vault.
	 * Clears existing indexes, then reindexes all folders, and updates document count.
	 */
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

	/**
	 * Indexes the currently active Markdown note.
	 */
	async indexCurrentNote() {
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// If no active Markdown view, try to find any Markdown leaf.
		if (!activeView) {
			const allLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (allLeaves.length > 0) {
				activeView = allLeaves[0].view as MarkdownView;
			}
		}
		// If still no active view or file, show a notice and return.
		if (!activeView || !activeView.file) {
			new Notice('No active note to index.');
			return;
		}
		        const file = activeView.file;
		        try {
		            const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		            await this.service.indexCurrentFile(file.path, vaultPath);
		            await this.updateTotalDocumentsSetting();
		            new Notice(`Current note '${file.basename}' indexed successfully.`);
		        } catch (error) {
		            console.error('Error indexing current note:', error);
		            new Notice(`Indexing of '${file.basename}' failed: ${error.message}`);
		        }	}

	/**
	 * Indexes a specific folder within the Obsidian vault.
	 * @param folderPath The path of the folder to index.
	 */
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

	/**
	 * Called when the plugin is unloaded.
	 * Detaches the Context Fetcher View.
	 */	
	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER);
	}

	/**
	 * Loads the plugin's settings from storage.
	 * @returns A Promise that resolves with the loaded settings.
	 */
	async loadSettings(): Promise<ContextFetcherPluginSettings> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		return this.settings;
	}

	/**
	 * Saves the plugin's settings to storage.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * Settings tab for the Context Fetcher Plugin.
 * Allows users to configure ChromaDB connection details, Python path, and indexing options.
 */
class SettingTab extends PluginSettingTab {
	plugin: ContextFetcherPlugin;

	constructor(app: App, plugin: ContextFetcherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Displays the settings UI.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Context Fetcher Settings' });

		new Setting(containerEl)
			.setName('ChromaDB Host')
			.setDesc('The host address of your ChromaDB server (e.g., 'localhost').')
			.addText(text => text
				.setPlaceholder('localhost')
				.setValue(this.plugin.settings.chromaHost)
				.onChange(async (value) => {
					this.plugin.settings.chromaHost = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ChromaDB Port')
			.setDesc('The port number your ChromaDB server is listening on (e.g., 8000).')
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
			.setDesc('The name of the ChromaDB collection where your notes will be stored.')
			.addText(text => text
				.setPlaceholder('notes')
				.setValue(this.plugin.settings.chromaCollectionName)
				.onChange(async (value) => {
					this.plugin.settings.chromaCollectionName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Python Path')
			.setDesc('The absolute path to your Python 3 executable (e.g., '/usr/bin/python3' or 'C:\\Python\\Python39\\python.exe').')
			.addText(text => text
				.setPlaceholder('/usr/bin/python3')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Search Max Results')
			.setDesc('The maximum number of similar notes to retrieve for each search query.')
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
			.setDesc('A comma-separated list of folder names within your vault that should be indexed. (e.g., 'notes,journal,projects').')
			.addTextArea(text => text
				.setPlaceholder('learnings,Meetings,My Daily Notes')
				.setValue(this.plugin.settings.foldersToIndex)
				.onChange(async (value) => {
					this.plugin.settings.foldersToIndex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Total Documents')
			.setDesc('Displays the total number of documents currently indexed in your ChromaDB collection (read-only).')
			.addText(text => text
				.setValue(this.plugin.settings.totalDocuments.toString())
				.setDisabled(true));
	}
}
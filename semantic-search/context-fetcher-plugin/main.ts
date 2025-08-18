import { App, FileSystemAdapter, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ContextFetcherService, ContextItem } from './ContextFetcherService';
import { ContextFetcherView, VIEW_TYPE_CONTEXT_FETCHER } from './ContextFetcherView';
import { ChromaDBSettings } from './ChromaDBService';

interface ContextFetcherPluginSettings {
	chromaHost: string;
	chromaPort: number;
	chromaCollectionName: string;
	pythonPath: string;
}

const DEFAULT_SETTINGS: ContextFetcherPluginSettings = {
	chromaHost: 'localhost',
	chromaPort: 8000,
	chromaCollectionName: 'notes',
	pythonPath: 'C:\\Users\\Jo.VanEyck\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
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
			pluginDir: pluginDir
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
		const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
		const pluginDir = require('path').join(vaultPath, '.obsidian', 'plugins', 'context-fetcher-plugin');
		const chromaSettings: ChromaDBSettings = {
			host: this.settings.chromaHost,
			port: this.settings.chromaPort,
			collectionName: this.settings.chromaCollectionName,
			pythonPath: this.settings.pythonPath,
			pluginDir: pluginDir
		};
		await this.service.fetchContext({
			app: this.app,
			file,
			setLoading,
			updateContext
		});
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
				.setPlaceholder('C:\\Users\\Jo.VanEyck\\AppData\\Local\\Programs\\Python\\Python312\\python.exe')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));

	}
}

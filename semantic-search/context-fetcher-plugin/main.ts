import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ContextFetcherService, ContextItem } from './ContextFetcherService';
import { ContextFetcherView, VIEW_TYPE_CONTEXT_FETCHER } from './ContextFetcherView';

interface ContextFetcherPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: ContextFetcherPluginSettings = {
	mySetting: 'default'
};

export default class ContextFetcherPlugin extends Plugin {
	settings: ContextFetcherPluginSettings;
	service: ContextFetcherService;
	contextView: ContextFetcherView | null = null;

	async onload() {
		await this.loadSettings();
		this.service = new ContextFetcherService();

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

		this.addSettingTab(new SampleSettingTab(this.app, this));
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

	stopCurrentProcess() {
		if (this.service) {
			this.service.stopCurrentProcess();
		}
		if (this.contextView) {
			this.contextView.setLoading(false);
		}
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
		const setProcess = (proc: any, timeoutId: any) => {
			this.service.currentExecProcess = proc;
			this.service.currentTimeoutId = timeoutId;
		};
		const clearProcess = () => {
			this.service.currentExecProcess = null;
			this.service.currentTimeoutId = null;
		};
		if (contextView) contextView.setLoading(true);
		await this.service.fetchContext({
			app: this.app,
			file,
			setLoading,
			updateContext,
			setProcess,
			clearProcess
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT_FETCHER);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ContextFetcherPlugin;
	constructor(app: App, plugin: ContextFetcherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

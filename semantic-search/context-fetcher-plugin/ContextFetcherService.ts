import { Notice, TFile, WorkspaceLeaf, MarkdownView, App } from 'obsidian';
import { ChromaDBService, ChromaDBSettings } from './ChromaDBService';
import { promises } from 'fs'
export interface ContextItem {
    type: "reference" | "counterpoint" | "definition" | "contradiction" | "example" | "template";
    note: string;
    anchor: string;
    excerpt: string;
    reason: string;
}

export interface FetchContextOptions {
    app: App;
    file: TFile;
    setLoading: (loading: boolean) => void;
    updateContext: (items: ContextItem[]) => void;
}

export class ContextFetcherService {
    chromaService: ChromaDBService;

    constructor(chromaSettings: ChromaDBSettings) {
        this.chromaService = new ChromaDBService(chromaSettings);
    }

    async fetchContext(opts: FetchContextOptions) {
        const { app, file, setLoading, updateContext } = opts;

        try {
            setLoading(true);
            const contextItems = await this.chromaService.fetchContextForNote(app, file);
            updateContext(contextItems);

        } catch (error) {
            console.error('ChromaDB context fetch failed:', error);
            new Notice(`Context fetch failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    async readFile(path: string) {
        return await promises.readFile(path, 'utf8');
    }
}

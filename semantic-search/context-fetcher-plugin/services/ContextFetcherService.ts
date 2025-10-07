import { Notice, TFile, WorkspaceLeaf, MarkdownView, App } from 'obsidian';
import { ChromaDBService, ChromaDBSettings } from './ChromaDBService';


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

    async clearAllIndexes(): Promise<any> {
        try {
            new Notice('Clearing all indexes...');
            const result = await this.chromaService.clearCollection();
            new Notice('All indexes cleared.');
            return result;
        } catch (error) {
            console.error('Error clearing indexes:', error);
            new Notice(`Error clearing indexes: ${error.message}`);
            throw error;
        }
    }

    async indexAllFolders(vaultPath: string): Promise<any> {
        try {
            new Notice('Indexing all configured folders...');
            const result = await this.chromaService.indexVault(vaultPath);
            new Notice('Indexing complete.');
            return result;
        } catch (error) {
            console.error('Error indexing folders:', error);
            new Notice(`Error indexing folders: ${error.message}`);
            throw error;
        }
    }

    async indexCurrentFile(filePath: string): Promise<any> {
        try {
            new Notice(`Indexing file: ${filePath}...`);
            const result = await this.chromaService.indexFile(filePath);
            new Notice(`File ${filePath} indexed.`);
            return result;
        } catch (error) {
            console.error('Error indexing file:', error);
            new Notice(`Error indexing file: ${error.message}`);
            throw error;
        }
    }

    async indexFolder(folderPath: string): Promise<any> {
        try {
            new Notice(`Indexing folder: ${folderPath}...`);
            const result = await this.chromaService.indexSpecificFolder(folderPath);
            new Notice(`Folder ${folderPath} indexed.`);
            return result;
        } catch (error) {
            console.error('Error indexing folder:', error);
            new Notice(`Error indexing folder: ${error.message}`);
            throw error;
        }
    }

    async getDocumentsCount(): Promise<number> {
        try {
            const count = await this.chromaService.getDocumentsCount();
            return count;
        } catch (error) {
            console.error('Error getting document count:', error);
            new Notice(`Error getting document count: ${error.message}`);
            return 0;
        }
    }

    async searchQuery(query: string, setLoading: (loading: boolean) => void, updateContext: (items: ContextItem[]) => void) {
        try {
            setLoading(true);
            const results = await this.chromaService.searchSimilarContent(query);
            const contextItems = this.chromaService.processChromaResults(results, ''); // Pass empty string for currentNotePath as it's a direct search
            updateContext(contextItems);
        } catch (error) {
            console.error('ChromaDB search query failed:', error);
            new Notice(`Search failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }
}
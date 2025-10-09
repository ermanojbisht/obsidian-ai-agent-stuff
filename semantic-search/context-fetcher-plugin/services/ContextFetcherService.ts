import { Notice, TFile, WorkspaceLeaf, MarkdownView, App } from 'obsidian';
import { ChromaDBService, ChromaDBSettings } from './ChromaDBService';


/**
 * Represents a single contextual item retrieved from ChromaDB.
 */
export interface ContextItem {
    type: "reference" | "counterpoint" | "definition" | "contradiction" | "example" | "template"; // The type of context item.
    note: string; // The title of the note where the context was found.
    anchor: string; // An optional anchor within the note (e.g., a heading).
    excerpt: string; // A short excerpt of the relevant content.
    reason: string; // The reason for its relevance (e.g., similarity score).
}

/**
 * Options for fetching context, used to pass necessary data and callbacks to the fetchContext method.
 */
export interface FetchContextOptions {
    app: App; // The Obsidian App instance.
    file: TFile; // The TFile object representing the note for which context is being fetched.
    setLoading: (loading: boolean) => void; // Callback to set the loading state of the UI.
    updateContext: (items: ContextItem[]) => void; // Callback to update the UI with new context items.
}

/**
 * Orchestrates interactions between the Obsidian plugin and the ChromaDBService.
 * Provides methods for fetching context, managing the index, and handling UI updates.
 */
export class ContextFetcherService {
    chromaService: ChromaDBService; // Instance of ChromaDBService for database operations.

    constructor(chromaSettings: ChromaDBSettings) {
        this.chromaService = new ChromaDBService(chromaSettings);
    }

    /**
     * Fetches contextual information for a given Obsidian note and updates the UI.
     * @param opts Options containing the app, file, and UI update callbacks.
     */
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

    /**
     * Clears all indexed documents from the ChromaDB collection.
     * Displays notices to the user about the operation's status.
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the result of the clear operation.
     * @throws An error if the clear operation fails.
     */
    async clearAllIndexes(vaultPath: string): Promise<any> {
        try {
            new Notice('Clearing all indexes...');
            const result = await this.chromaService.clearCollection(vaultPath);
            new Notice('All indexes cleared.');
            return result;
        } catch (error) {
            console.error('Error clearing indexes:', error);
            new Notice(`Error clearing indexes: ${error.message}`);
            throw error;
        }
    }

    /**
     * Indexes all configured folders within the Obsidian vault into ChromaDB.
     * Displays notices to the user about the operation's status.
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the result of the indexing operation.
     * @throws An error if the indexing operation fails.
     */
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

    /**
     * Indexes a specific file into ChromaDB.
     * Displays notices to the user about the operation's status.
     * @param filePath The absolute path to the file to index.
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the result of the indexing operation.
     * @throws An error if the indexing operation fails.
     */
    async indexCurrentFile(filePath: string, vaultPath: string): Promise<any> {
        try {
            new Notice(`Indexing file: ${filePath}...`);
            const result = await this.chromaService.indexFile(filePath, vaultPath);
            new Notice(`File ${filePath} indexed.`);
            return result;
        } catch (error) {
            console.error('Error indexing file:', error);
            new Notice(`Error indexing file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Indexes a specific folder within the Obsidian vault into ChromaDB.
     * Displays notices to the user about the operation's status.
     * @param folderPath The path of the folder to index (relative to the vault).
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the result of the indexing operation.
     * @throws An error if the indexing operation fails.
     */
    async indexFolder(folderPath: string, vaultPath: string): Promise<any> {
        try {
            new Notice(`Indexing folder: ${folderPath}...`);
            const result = await this.chromaService.indexSpecificFolder(folderPath, vaultPath);
            new Notice(`Folder ${folderPath} indexed.`);
            return result;
        } catch (error) {
            console.error('Error indexing folder:', error);
            new Notice(`Error indexing folder: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieves the total number of documents currently in the ChromaDB collection.
     * Displays notices to the user if an error occurs.
     * @returns A Promise that resolves with the total document count, or 0 if an error occurs.
     */
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

    /**
     * Performs a direct search query against ChromaDB and updates the UI with the results.
     * @param query The search query string.
     * @param setLoading Callback to set the loading state of the UI.
     * @param updateContext Callback to update the UI with new context items.
     */
    async searchQuery(query: string, setLoading: (loading: boolean) => void, updateContext: (items: ContextItem[]) => void) {
        try {
            setLoading(true);
            const results = await this.chromaService.searchSimilarContent(query);
            // Pass an empty string for currentNotePath as it's a direct search, not related to a specific open note.
            const contextItems = this.chromaService.processChromaResults(results, '');
            updateContext(contextItems);
        } catch (error) {
            console.error('ChromaDB search query failed:', error);
            new Notice(`Search failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }
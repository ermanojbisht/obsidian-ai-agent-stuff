import { Notice, TFile, App } from 'obsidian';
import { ContextItem } from './ContextFetcherService';
import { spawn, ChildProcess } from 'child_process';

export interface ChromaDBSettings {
    host: string;
    port: number;
    collectionName: string;
    pythonPath: string;
    pluginDir?: string;
    searchMaxResults: number;
    foldersToIndex: string;
}

export class ChromaDBService {
    private settings: ChromaDBSettings;

    constructor(settings: ChromaDBSettings) {
        this.settings = settings;
    }

    async initialize(): Promise<void> {
        // No initialization needed for subprocess approach
    }

    private async runPythonScript(scriptName: string, action: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const request = {
                action: action,
                host: this.settings.host,
                port: this.settings.port,
                collection_name: this.settings.collectionName,
                ...payload
            };

            const scriptPath = this.settings.pluginDir
                ? require('path').join(this.settings.pluginDir, 'python', scriptName)
                : require('path').join(__dirname, 'python', scriptName);

            const python = spawn(this.settings.pythonPath, [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                const chunk = data.toString('utf8');
                stdout += chunk;
            });

            python.stderr.on('data', (data) => {
                const chunk = data.toString('utf8');
                stderr += chunk;
            });

            python.on('close', (code) => {
                if (stderr) {
                    console.error(`ChromaDBService: Python stderr for ${scriptName}:`, stderr);
                }

                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    const response = JSON.parse(stdout);
                    if (!response.success) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response);
                } catch (error) {
                    reject(new Error(`Failed to parse Python response: ${error}. Raw stdout: ${stdout}`));
                }
            });

            python.on('error', (error) => {
                const fs = require('fs');
                const path = require('path');

                let errorMessage = `Failed to spawn Python process: ${error}`;
                const pythonScriptPath = this.settings.pluginDir
                    ? path.join(this.settings.pluginDir, 'python', scriptName)
                    : path.join(__dirname, 'python', scriptName);

                errorMessage += `\nPython path: ${this.settings.pythonPath}`;
                errorMessage += `\nScript path: ${pythonScriptPath}`;
                errorMessage += `\nCurrent directory: ${__dirname}`;
                errorMessage += `\nPython exists: ${fs.existsSync(this.settings.pythonPath)}`;
                errorMessage += `\nScript exists: ${fs.existsSync(pythonScriptPath)}`;

                if (error.message.includes('ENOENT')) {
                    errorMessage += `\nENOENT means "file not found" - check paths above.`;
                }
                reject(new Error(errorMessage));
            });

            const requestJson = JSON.stringify(request, null, 0);
            python.stdin.setDefaultEncoding('utf8');
            python.stdin.write(requestJson, 'utf8');
            python.stdin.end();
        });
    }

    async searchSimilarContent(queryText: string): Promise<any> {
        try {
            const queryEmbeddings = await this.generateEmbedding(queryText);

            const payload = {
                query_embeddings: queryEmbeddings,
                n_results: this.settings.searchMaxResults
            };
            const response = await this.runPythonScript('chroma_query.py', 'query', payload);

            const results = response.results;

            const formattedResults = {
                documents: [results.map((r: any) => r.document)],
                metadatas: [results.map((r: any) => r.metadata)],
                distances: [results.map((r: any) => r.distance)],
                ids: [results.map((r: any) => r.id)]
            };

            return formattedResults;
        } catch (error) {
            console.error('ChromaDB query failed:', error);
            throw error;
        }
    }

    processChromaResults(results: any, currentNotePath: string): ContextItem[] {
        if (!results.documents || !results.documents[0] || results.documents[0].length === 0) {
            return [];
        }

        const contextItems: ContextItem[] = [];
        const documents = results.documents[0];
        const metadatas = results.metadatas?.[0] || [];
        const distances = results.distances?.[0] || [];

        for (let i = 0; i < documents.length; i++) {
            const document = documents[i];
            const metadata = metadatas[i] || {};
            const distance = distances[i] || 1;

            const notePath = metadata.relative_path;

            // Normalize paths for comparison (handle different separators and formats)
            const normalizeNotePath = (path: string) => path?.replace(/\\/g, '/').toLowerCase();
            const normalizedCurrentPath = normalizeNotePath(currentNotePath);
            const normalizedNotePath = normalizeNotePath(notePath);

            if (normalizedNotePath === normalizedCurrentPath) {
                continue;
            }

            const noteTitle = metadata.filename?.replace('.md', '') || 'Unknown';
            const excerpt = document.substring(0, 240);

            const anchor = metadata.heading ? `#${metadata.heading}` : '';
            const reason = `Distance: ${distance.toFixed(2)}`;

            contextItems.push({
                type: 'reference',
                note: noteTitle,
                anchor,
                excerpt,
                reason
            });
        }

        return contextItems;
    }

    async fetchContextForNote(app: App, file: TFile): Promise<ContextItem[]> {
        try {
            const content = await app.vault.read(file);
            const cleanContent = content.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            const noteTitle = file.basename;
            const queryText = `${noteTitle}\n\n${cleanContent}`;

            const results = await this.searchSimilarContent(queryText);
            const contextItems = this.processChromaResults(results, file.path);

            return contextItems;
        } catch (error) {
            console.error('Error fetching context:', error);
            new Notice(`Error fetching context: ${error.message}`);
            return [];
        }
    }

    async clearCollection(): Promise<any> {
        return this.runPythonScript('manage_index.py', 'clear', {});
    }

    async indexVault(vaultPath: string): Promise<any> {
        const payload = {
            vault_path: vaultPath,
            folders_to_index: this.settings.foldersToIndex.split(',').map(f => f.trim()).filter(f => f.length > 0)
        };
        return this.runPythonScript('manage_index.py', 'index', payload);
    }

    async indexFile(filePath: string): Promise<any> {
        const payload = {
            file_path: filePath
        };
        return this.runPythonScript('manage_index.py', 'index', payload);
    }

    async indexSpecificFolder(folderPath: string): Promise<any> {
        const payload = {
            vault_path: this.settings.pluginDir, // Assuming pluginDir can be used to derive vault path or passed explicitly
            folders_to_index: [folderPath]
        };
        return this.runPythonScript('manage_index.py', 'index', payload);
    }

    async getDocumentsCount(): Promise<number> {
        const response = await this.runPythonScript('get_doc_count.py', 'get_count', {});
        return response.total_documents || 0;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const payload = {
            text: text
        };
        const response = await this.runPythonScript('generate_embedding.py', 'embed', payload);
        if (response.embeddings && Array.isArray(response.embeddings) && response.embeddings.length > 0) {
            return response.embeddings[0]; // Assuming the script returns a list of embeddings, and we need the first one
        } else {
            throw new Error('Failed to generate embeddings or received empty embeddings.');
        }
    }
}
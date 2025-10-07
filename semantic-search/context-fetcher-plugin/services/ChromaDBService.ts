import { Notice, TFile, App } from 'obsidian';
import { ContextItem } from './ContextFetcherService';
import { spawn, ChildProcess } from 'child_process';

export interface ChromaDBSettings {
    host: string;
    port: number;
    collectionName: string;
    pythonPath: string;
    pluginDir?: string;
}

export class ChromaDBService {
    private settings: ChromaDBSettings;

    constructor(settings: ChromaDBSettings) {
        this.settings = settings;
    }

    async initialize(): Promise<void> {
        // No initialization needed for subprocess approach
    }

    private async runPythonQuery(queryText: string, maxResults: number): Promise<any> {
        return new Promise((resolve, reject) => {
            // Ensure query text is a clean string
            const cleanQueryText = typeof queryText === 'string' ? queryText.trim() : String(queryText).trim();
            if (!cleanQueryText) {
                reject(new Error('Query text cannot be empty'));
                return;
            }

            const request = {
                action: "query",
                host: this.settings.host,
                port: this.settings.port,
                collection_name: this.settings.collectionName,
                query_text: cleanQueryText,
                n_results: maxResults
            };

            const scriptPath = this.settings.pluginDir
                ? require('path').join(this.settings.pluginDir, 'chroma_query.py')
                : require('path').join(__dirname, 'chroma_query.py');

            console.log('ChromaDBService: Request payload:');
            console.dir(request)

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
                console.log('ChromaDBService: Python stderr chunk:', chunk);
                stderr += chunk;
            });

            python.on('close', (code) => {
                console.log('ChromaDBService: Final stdout:');
                console.dir(JSON.parse(stdout));
                if (stderr) {
                    console.log('ChromaDBService: Final stderr:', stderr);
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
                    resolve(response.results);
                } catch (error) {
                    reject(new Error(`Failed to parse Python response: ${error}`));
                }
            });

            python.on('error', (error) => {
                const fs = require('fs');
                const path = require('path');

                let errorMessage = `Failed to spawn Python process: ${error}`;
                const pythonScriptPath = this.settings.pluginDir
                    ? path.join(this.settings.pluginDir, 'chroma_query.py')
                    : path.join(__dirname, 'chroma_query.py');

                // Add diagnostic information
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

            // Send the request to stdin with explicit UTF-8 encoding
            const requestJson = JSON.stringify(request, null, 0);
            python.stdin.setDefaultEncoding('utf8');
            python.stdin.write(requestJson, 'utf8');
            python.stdin.end();
        });
    }

    async searchSimilarContent(queryText: string, maxResults: number = 8): Promise<any> {
        try {
            const results = await this.runPythonQuery(queryText, maxResults);

            // Convert the Python response format to match the original ChromaDB format
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
            // Ensure proper string encoding and normalize line endings
            const cleanContent = content.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Prepend note title to query text
            const noteTitle = file.basename; // This strips .md automatically
            const queryText = `${noteTitle}\n\n${cleanContent}`;

            const results = await this.searchSimilarContent(queryText, 12);
            const contextItems = this.processChromaResults(results, file.path);

            return contextItems;
        } catch (error) {
            console.error('Error fetching context:', error);
            new Notice(`Error fetching context: ${error.message}`);
            return [];
        }
    }
}
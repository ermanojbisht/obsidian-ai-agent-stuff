import { Notice, TFile, App } from 'obsidian';
import { ContextItem } from './ContextFetcherService';
import { spawn, ChildProcess } from 'child_process';

/**
 * Interface for ChromaDB settings, defining configuration options for connecting to and interacting with ChromaDB.
 */
export interface ChromaDBSettings {
    host: string; // The host address of the ChromaDB server.
    port: number; // The port number of the ChromaDB server.
    collectionName: string; // The name of the collection to use in ChromaDB.
    pythonPath: string; // The path to the Python executable.
    pluginDir?: string; // Optional: The directory of the plugin, used to locate Python scripts.
    searchMaxResults: number; // The maximum number of results to return from a search query.
    foldersToIndex: string; // Comma-separated string of folders within the vault to index.
}

/**
 * Service responsible for interacting with ChromaDB via Python subprocesses.
 * It handles embedding generation, querying, indexing, and managing the ChromaDB collection.
 */
export class ChromaDBService {
    private settings: ChromaDBSettings; // Stores the configuration settings for ChromaDB.

    constructor(settings: ChromaDBSettings) {
        this.settings = settings;
    }

    /**
     * Initializes the ChromaDB service. Currently, no specific initialization is needed for the subprocess approach.
     */
    async initialize(): Promise<void> {
        // No initialization needed for subprocess approach
    }

    /**
     * Runs a Python script as a child process, communicating via JSON over stdin/stdout.
     * This method is used for Python scripts that expect a JSON payload and return a JSON response.
     * @param scriptName The name of the Python script to run (e.g., 'generate_embedding.py').
     * @param action The action to be performed by the Python script.
     * @param payload The JSON payload to send to the Python script via stdin.
     * @returns A Promise that resolves with the parsed JSON response from the Python script.
     */
    private async runPythonScript(scriptName: string, action: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            // Construct the request object to be sent to the Python script.
            const request = {
                action: action,
                host: this.settings.host,
                port: this.settings.port,
                collection_name: this.settings.collectionName,
                ...payload
            };

            // Determine the absolute path to the Python script.
            const scriptPath = this.settings.pluginDir
                ? require('path').join(this.settings.pluginDir, 'python', scriptName)
                : require('path').join(__dirname, 'python', scriptName);

            // Spawn the Python child process.
            const python = spawn(this.settings.pythonPath, [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'], // Use pipes for stdin, stdout, and stderr.
                windowsHide: true // Hide the console window on Windows.
            });

            let stdout = '';
            let stderr = '';

            // Collect data from stdout.
            python.stdout.on('data', (data) => {
                const chunk = data.toString('utf8');
                stdout += chunk;
            });

            // Collect data from stderr.
            python.stderr.on('data', (data) => {
                const chunk = data.toString('utf8');
                stderr += chunk;
            });

            // Handle the Python process closing.
            python.on('close', (code) => {
                // Log stderr if present, as it often contains error messages or warnings from the Python script
                if (stderr) {
                    console.error(`ChromaDBService: Python stderr for ${scriptName}:`, stderr);
                }

                // If the Python process exited with a non-zero code, it indicates an error
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Attempt to parse the stdout as JSON.
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

            // Handle errors during Python process spawning.
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

            // Write the JSON request to the Python script's stdin.
            const requestJson = JSON.stringify(request, null, 0);
            python.stdin.setDefaultEncoding('utf8');
            python.stdin.write(requestJson, 'utf8');
            python.stdin.end();
        });
    }

    /**
     * Runs a Python script as a child process, passing arguments directly.
     * This method is used for Python scripts that expect command-line arguments.
     * @param scriptName The name of the Python script to run (e.g., 'manage_index.py').
     * @param args An array of string arguments to pass to the Python script.
     * @returns A Promise that resolves with the parsed JSON response from the Python script.
     */
    private async runPythonScriptWithArgs(scriptName: string, args: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            // Determine the absolute path to the Python script.
            const scriptPath = this.settings.pluginDir
                ? require('path').join(this.settings.pluginDir, 'python', scriptName)
                : require('path').join(__dirname, 'python', scriptName);

            // Combine the script path with the provided arguments.
            const pythonArgs = [scriptPath, ...args];

            // Spawn the Python child process.
            const python = spawn(this.settings.pythonPath, pythonArgs, {
                stdio: ['pipe', 'pipe', 'pipe'], // Use pipes for stdin, stdout, and stderr.
                windowsHide: true // Hide the console window on Windows.
            });

            let stdout = '';
            let stderr = '';

            // Collect data from stdout.
            python.stdout.on('data', (data) => {
                const chunk = data.toString('utf8');
                stdout += chunk;
            });

            // Collect data from stderr.
            python.stderr.on('data', (data) => {
                const chunk = data.toString('utf8');
                stderr += chunk;
            });

            // Handle the Python process closing.
            python.on('close', (code) => {
                // Log stderr if present, as it often contains error messages or warnings from the Python script
                if (stderr) {
                    console.error(`ChromaDBService: Python stderr for ${scriptName}:`, stderr);
                }

                // If the Python process exited with a non-zero code, it indicates an error
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }

                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Attempt to parse the stdout as JSON.
                    const response = JSON.parse(stdout);
                    if (!response.success) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response);
                } catch (error) {
                    reject(new Error(`Failed to parse Python response: ${error}. Raw stdout: ${stdout}. Raw stderr: ${stderr}`));
                }
            });

            // Handle errors during Python process spawning.
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
        });
    }

    /**
     * Searches for similar content in ChromaDB based on a query text.
     * @param queryText The text to use for the similarity search.
     * @returns A Promise that resolves with the formatted search results from ChromaDB.
     */
    async searchSimilarContent(queryText: string): Promise<any> {

        try {
            // Generate embeddings for the query text.
            const queryEmbeddings = await this.generateEmbedding(queryText);

            // Prepare the payload for the chroma_query.py script.
            const payload = {
                query_embeddings: queryEmbeddings,
                n_results: this.settings.searchMaxResults
            };
            // Run the chroma_query.py script to get similar documents.
            const response = await this.runPythonScript('chroma_query.py', 'query', payload);

            const results = response.results;

            // Format the results into a structure expected by the UI.
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

    /**
     * Processes raw results from ChromaDB into a structured array of ContextItem objects.
     * Filters out the current note from the results.
     * @param results The raw results object from ChromaDB.
     * @param currentNotePath The path of the currently active note, to exclude from results.
     * @returns An array of ContextItem objects.
     */
    processChromaResults(results: any, currentNotePath: string): ContextItem[] {
        // Return an empty array if no documents are found.
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

            // Normalize paths for comparison (handle different separators and formats).
            const normalizeNotePath = (path: string) => path?.replace(/\\/g, '/').toLowerCase();
            const normalizedCurrentPath = normalizeNotePath(currentNotePath);
            const normalizedNotePath = normalizeNotePath(notePath);

            // Skip the current note if it appears in the search results.
            if (normalizedNotePath === normalizedCurrentPath) {
                continue;
            }

            const noteTitle = metadata.filename?.replace('.md', '') || 'Unknown';
            const excerpt = document.substring(0, 240); // Take the first 240 characters as an excerpt.

            const anchor = metadata.heading ? `#${metadata.heading}` : '';
            const reason = `Distance: ${distance.toFixed(2)}`; // Display the distance as a reason.

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

    /**
     * Fetches contextual information for a given Obsidian note.
     * Reads the note's content, generates embeddings, queries ChromaDB, and processes the results.
     * @param app The Obsidian App instance.
     * @param file The TFile object representing the note.
     * @returns A Promise that resolves with an array of ContextItem objects relevant to the note.
     */
    async fetchContextForNote(app: App, file: TFile): Promise<ContextItem[]> {
        try {
            // Read the content of the Obsidian note.
            const content = await app.vault.read(file);
            // Clean the content by normalizing line endings.
            const cleanContent = content.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            const noteTitle = file.basename;
            // Combine title and content for a comprehensive query.
            const queryText = `${noteTitle}\n\n${cleanContent}`;

            // Search for similar content in ChromaDB.
            const results = await this.searchSimilarContent(queryText);
            // Process the raw ChromaDB results into ContextItem objects.
            const contextItems = this.processChromaResults(results, file.path);

            return contextItems;
        } catch (error) {
            console.error('Error fetching context:', error);
            new Notice(`Error fetching context: ${error.message}`);
            return [];
        }
    }

    /**
     * Clears all documents from the configured ChromaDB collection.
     * @param vaultPath The absolute path to the Obsidian vault (used by the Python script for context).
     * @returns A Promise that resolves with the response from the Python script.
     */
    async clearCollection(vaultPath: string): Promise<any> {
        // Prepare arguments for the manage_index.py script to clear the collection.
        const args = [
            'clear',
            vaultPath, // Dummy path, as it's required by argparse but not used for clear
            vaultPath,
            '--host', this.settings.host,
            '--port', this.settings.port.toString(),
            '--collection', this.settings.collectionName
        ];
        return this.runPythonScriptWithArgs('manage_index.py', args);
    }

    /**
     * Indexes all configured folders within the Obsidian vault into ChromaDB.
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the response from the Python script.
     */
    async indexVault(vaultPath: string): Promise<any> {
        // Parse the comma-separated list of folders to index.
        const folders = this.settings.foldersToIndex.split(',').map(f => f.trim()).filter(f => f.length > 0);
        // Prepare arguments for the manage_index.py script to index the specified folders.
        const args = [
            'index',
            vaultPath, // Path to the vault itself
            vaultPath,
            '--host', this.settings.host,
            '--port', this.settings.port.toString(),
            '--collection', this.settings.collectionName,
            '--folders', folders.join(',') // Pass folders as a comma-separated string.
        ];
        return this.runPythonScriptWithArgs('manage_index.py', args);
    }

    /**
     * Indexes a specific file into ChromaDB.
     * @param filePath The absolute path to the file to index.
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the response from the Python script.
     */
    async indexFile(filePath: string, vaultPath: string): Promise<any> {
        // Prepare arguments for the manage_index.py script to index a single file.
        const args = [
            'index',
            filePath,
            vaultPath,
            '--host', this.settings.host,
            '--port', this.settings.port.toString(),
            '--collection', this.settings.collectionName
        ];
        return this.runPythonScriptWithArgs('manage_index.py', args);
    }

    /**
     * Indexes a specific folder within the Obsidian vault into ChromaDB.
     * @param folderPath The path of the folder to index (relative to the vault).
     * @param vaultPath The absolute path to the Obsidian vault.
     * @returns A Promise that resolves with the response from the Python script.
     */
    async indexSpecificFolder(folderPath: string, vaultPath: string): Promise<any> {
        // Prepare arguments for the manage_index.py script to index a specific folder.
        const args = [
            'index',
            vaultPath, // The base path for finding files
            vaultPath,
            '--host', this.settings.host,
            '--port', this.settings.port.toString(),
            '--collection', this.settings.collectionName,
            '--folders', folderPath // Pass the specific folder to index.
        ];
        return this.runPythonScriptWithArgs('manage_index.py', args);
    }

    /**
     * Retrieves the total number of documents currently in the ChromaDB collection.
     * @returns A Promise that resolves with the total document count.
     */
    async getDocumentsCount(): Promise<number> {
        // Prepare arguments for the get_doc_count.py script.
        const args = [
            '--host', this.settings.host,
            '--port', this.settings.port.toString(),
            '--collection', this.settings.collectionName
        ];
        // Run the get_doc_count.py script and return the total_documents from its response.
        const response = await this.runPythonScriptWithArgs('get_doc_count.py', args);
        return response.total_documents || 0;
    }

    /**
     * Generates vector embeddings for a given text using a Python script.
     * @param text The text for which to generate embeddings.
     * @returns A Promise that resolves with an array of numbers representing the embedding.
     * @throws An error if embedding generation fails or returns empty embeddings.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Prepare the payload for the generate_embedding.py script.
        const payload = {
            text: text
        };
        // Run the generate_embedding.py script.
        const response = await this.runPythonScript('generate_embedding.py', 'embed', payload);
        // Validate and return the generated embeddings.
        if (response.embeddings && Array.isArray(response.embeddings) && response.embeddings.length > 0) {
            return response.embeddings[0]; // Assuming the script returns a list of embeddings, and we need the first one.
        } else {
            throw new Error('Failed to generate embeddings or received empty embeddings.');
        }
    }
}
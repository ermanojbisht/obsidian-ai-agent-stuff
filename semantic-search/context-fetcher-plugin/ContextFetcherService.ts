import { Notice, TFile, WorkspaceLeaf, MarkdownView, App } from 'obsidian';

export interface ContextItem {
    type: "reference" | "counterpoint" | "definition" | "contradiction" | "example" | "template";
    note: string;
    anchor: string;
    excerpt: string;
    reason: string;
    action: "insert-link" | "quote" | "compare" | "rewrite" | "add-section";
}

export interface FetchContextOptions {
    app: App;
    file: TFile;
    setLoading: (loading: boolean) => void;
    updateContext: (items: ContextItem[]) => void;
    setProcess: (proc: any, timeoutId: any) => void;
    clearProcess: () => void;
}

export interface IProcessRunner {
    spawn(cmd: string, args: string[], opts: any): any;
    existsSync(path: string): boolean;
    readFile(path: string): Promise<string>;
}

export class NodeProcessRunner implements IProcessRunner {
    childProcess: any;
    fs: any;
    constructor() {
        this.childProcess = require('child_process');
        this.fs = require('fs');
    }
    spawn(cmd: string, args: string[], opts: any) {
        console.log('[ContextFetcherService] Running command:', cmd, args, opts);
        return this.childProcess.spawn(cmd, args, opts);
    }
    existsSync(path: string) {
        return this.fs.existsSync(path);
    }
    async readFile(path: string) {
        return await this.fs.promises.readFile(path, 'utf8');
    }
}

// Pure function to parse the Claude response
export function parseClaudeResponse(stdout: string): ContextItem[] | null {
    try {
        const response = JSON.parse(stdout);
        if (response.result) {
            const jsonMatch = response.result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        if (Array.isArray(response)) {
            return response;
        }
    } catch (e) {
        console.error('Parse error:', e);
    }
    return null;
}

export class ContextFetcherService {
    currentExecProcess: any = null;
    currentTimeoutId: any = null;
    processRunner: IProcessRunner;

    constructor(processRunner?: IProcessRunner) {
        this.processRunner = processRunner || new NodeProcessRunner();
    }

    stopCurrentProcess() {
        if (this.currentExecProcess) {
            const proc = this.currentExecProcess;
            try {
                if (proc.pid && process.platform === 'win32') {
                    const { execSync } = require('child_process');
                    execSync(`taskkill /PID ${proc.pid} /T /F`);
                    new Notice('Context fetch process force killed');
                } else {
                    proc.kill('SIGKILL');
                    new Notice('Context fetch process killed');
                }
            } catch (killError) {
                console.error('Failed to force kill process:', killError);
                new Notice('Failed to force kill process');
            }
            this.currentExecProcess = null;
        }
        if (this.currentTimeoutId) {
            clearTimeout(this.currentTimeoutId);
            this.currentTimeoutId = null;
        }
    }

    async fetchContext(opts: FetchContextOptions) {
        const { app, file, setLoading, updateContext, setProcess, clearProcess } = opts;
        let path: any;
        try {
            path = require('path');
        } catch (requireError) {
            console.error('Node.js modules not available:', requireError);
            new Notice('Error: Node.js modules not available in Obsidian plugin environment');
            setLoading(false);
            return;
        }
        const vaultPath = (app.vault.adapter as any).basePath;
        const filePath = file.path;
        const commandFilePath = path.join(vaultPath, '.claude', 'commands', 'aide', 'gather-relevant-context.md');
        let commandContent: string;
        try {
            commandContent = await this.processRunner.readFile(commandFilePath);
        } catch (error) {
            new Notice('Failed to read command file');
            setLoading(false);
            return;
        }
        const commandText = commandContent.replace('$ARGUMENTS', filePath).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
        let callbackCalled = false;
        let execProcess: any = null;
        const timeoutId = setTimeout(() => {
            if (!callbackCalled) {
                if (execProcess && execProcess.pid) {
                    try { execProcess.kill('SIGTERM'); } catch { }
                }
                new Notice('Command execution timed out - process killed');
                setLoading(false);
            }
        }, 60000);
        setProcess(execProcess, timeoutId);
        const args = ['-p', commandText, '--output-format', 'json'];
        const possiblePaths = [
            'C:\\nvm4w\\nodejs\\claude.cmd',
            'C:\\nvm4w\\nodejs\\claude',
            'claude.cmd',
            'claude'
        ];
        let claudePath = 'claude';
        for (const testPath of possiblePaths) {
            try {
                if (testPath.includes('\\') && this.processRunner.existsSync(testPath)) {
                    claudePath = testPath;
                    break;
                } else if (!testPath.includes('\\')) {
                    claudePath = testPath;
                    break;
                }
            } catch { }
        }

        execProcess = this.processRunner.spawn(claudePath, args, {
            cwd: vaultPath,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        setProcess(execProcess, timeoutId);
        let stdout = '';
        let stderr = '';
        execProcess.stdout?.on('data', (data: any) => { stdout += data.toString(); });
        execProcess.stderr?.on('data', (data: any) => { stderr += data.toString(); });
        execProcess.on('close', (code: number) => {
            callbackCalled = true;
            clearTimeout(timeoutId);
            clearProcess();
            setLoading(false);
            if (code !== 0) {
                console.error(`Claude command failed with code ${code}. stderr: ${stderr}. stdout: ${stdout}`);
                new Notice(`Claude command failed with code ${code}`);
                return;
            }
            const contextData = parseClaudeResponse(stdout);
            if (contextData) {
                updateContext(contextData);
            } else {
                new Notice('No valid context data found in response');
            }
        });
        execProcess.on('error', (error: any) => {
            callbackCalled = true;
            clearTimeout(timeoutId);
            clearProcess();
            setLoading(false);
            new Notice(`Error running Claude command: ${error.message}`);
        });
    }
}

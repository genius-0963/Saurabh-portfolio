const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const pty = require('node-pty');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const { CraftLangCompiler } = require('./compiler/craftlang');

// Create workspace directory
const WORKSPACE_DIR = path.join(__dirname, '../workspace');
const CLIENT_DIR = path.join(__dirname, '../client');

// Ensure workspace directory exists
fs.mkdir(WORKSPACE_DIR, { recursive: true }).catch(console.error);

const app = express();
const server = http.createServer(app);

// Serve static files from client directory
app.use(express.static(CLIENT_DIR));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

// Agent namespace for hardware agents
const agentNamespace = io.of('/agent');

// Store active processes and debug sessions
const activeProcesses = new Map();
const debugSessions = new Map();
// Persistent Python REPL sessions per socket
const pythonSessions = new Map();
// Hardware agents registry
const hardwareAgents = new Map();
const agentSessions = new Map();

// Initialize CraftLang compiler
const craftLangCompiler = new CraftLangCompiler();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Create a PTY process for this client
    const ptyProcess = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: WORKSPACE_DIR,
        env: process.env
    });
    
    // Store PTY process for this socket
    activeProcesses.set(socket.id, { pty: ptyProcess, execProcess: null });
    
    // Handle PTY data
    ptyProcess.onData(data => {
        socket.emit('terminal:data', data);
    });
    
    // Terminal input
    socket.on('terminal:data', (data) => {
        ptyProcess.write(data);
    });
    
    // Code execution
    socket.on('code:execute', async (data) => {
        try {
            await executeCode(socket, data);
        } catch (error) {
            socket.emit('execution:error', { error: error.message });
        }
    });

    // Python REPL: start session
    socket.on('python:start', async () => {
        try {
            await ensurePythonSession(socket);
        } catch (error) {
            socket.emit('execution:error', { error: `Python start error: ${error.message}` });
        }
    });

    // Python REPL: execute code
    socket.on('python:exec', async (data) => {
        try {
            const { code } = data || {};
            if (typeof code !== 'string') {
                socket.emit('execution:error', { error: 'python:exec requires { code: string }' });
                return;
            }
            const resp = await pythonExec(socket, code);
            if (resp.stdout) socket.emit('execution:output', { output: resp.stdout, type: 'output' });
            if (resp.stderr) socket.emit('execution:output', { output: resp.stderr, type: resp.ok ? 'warn' : 'error' });
            socket.emit('execution:complete', { exitCode: resp.ok ? 0 : 1 });
        } catch (error) {
            socket.emit('execution:error', { error: `Python exec error: ${error.message}` });
        }
    });

    // Python REPL: reset session
    socket.on('python:reset', async () => {
        try {
            await resetPythonSession(socket);
            socket.emit('python:ready', { message: 'Python session reset' });
        } catch (error) {
            socket.emit('execution:error', { error: `Python reset error: ${error.message}` });
        }
    });

    // Python REPL: stop session
    socket.on('python:stop', () => {
        try {
            stopPythonSession(socket);
            socket.emit('python:stopped', { message: 'Python session stopped' });
        } catch (error) {
            socket.emit('execution:error', { error: `Python stop error: ${error.message}` });
        }
    });

    // Hardware events - route to selected agent
    socket.on('hardware:listAgents', () => {
        const agents = Array.from(hardwareAgents.values()).map(agent => ({
            id: agent.id,
            name: agent.name,
            platform: agent.platform,
            status: agent.status,
            lastSeen: agent.lastSeen
        }));
        socket.emit('hardware:agentsList', { agents });
    });

    socket.on('hardware:selectAgent', (data) => {
        const { agentId } = data;
        if (hardwareAgents.has(agentId)) {
            agentSessions.set(socket.id, agentId);
            socket.emit('hardware:agentSelected', { agentId, success: true });
        } else {
            socket.emit('hardware:agentSelected', { agentId, success: false, error: 'Agent not found' });
        }
    });

    socket.on('hardware:listSerialPorts', () => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('list_serial_ports', { requestId: generateRequestId(socket.id) });
    });

    socket.on('hardware:serialOpen', (data) => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('serial_open', { 
            requestId: generateRequestId(socket.id),
            port: data.port,
            baudrate: data.baudrate || 9600
        });
    });

    socket.on('hardware:serialWrite', (data) => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('serial_write', { 
            requestId: generateRequestId(socket.id),
            data: data.data
        });
    });

    socket.on('hardware:serialClose', () => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('serial_close', { requestId: generateRequestId(socket.id) });
    });

    // Camera events
    socket.on('hardware:listCameras', () => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('camera_list', { requestId: generateRequestId(socket.id) });
    });

    socket.on('hardware:cameraStart', (data) => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('camera_start', { 
            requestId: generateRequestId(socket.id),
            cameraId: data.cameraId || 0
        });
    });

    socket.on('hardware:cameraCapture', () => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('camera_capture', { requestId: generateRequestId(socket.id) });
    });

    socket.on('hardware:cameraStop', () => {
        const agentId = agentSessions.get(socket.id);
        if (!agentId || !hardwareAgents.has(agentId)) {
            socket.emit('hardware:error', { error: 'No agent selected or agent offline' });
            return;
        }
        const agent = hardwareAgents.get(agentId);
        agent.socket.emit('camera_stop', { requestId: generateRequestId(socket.id) });
    });
    
    // Stop code execution
    socket.on('code:stop', (data) => {
        stopExecution(socket);
    });
    
    // Debug code
    socket.on('code:debug', async (data) => {
        try {
            await debugCode(socket, data);
        } catch (error) {
            socket.emit('execution:error', { error: error.message });
        }
    });
    
    // Debug controls
    socket.on('debug:step', (data) => {
        handleDebugStep(socket, data);
    });
    
    socket.on('debug:continue', () => {
        handleDebugContinue(socket);
    });
    
    // File operations
    socket.on('file:getTree', async () => {
        try {
            const tree = await getFileTree(WORKSPACE_DIR);
            socket.emit('file:tree', { tree });
        } catch (error) {
            socket.emit('execution:error', { error: 'Failed to load file tree' });
        }
    });
    
    socket.on('file:open', async (data) => {
        try {
            const filePath = path.join(WORKSPACE_DIR, data.filename);
            const content = await fs.readFile(filePath, 'utf8');
            socket.emit('file:content', { filename: data.filename, content });
        } catch (error) {
            socket.emit('execution:error', { error: `Failed to open file: ${data.filename}` });
        }
    });
    
    socket.on('file:save', async (data) => {
        try {
            const filePath = path.join(WORKSPACE_DIR, data.filename);
            await fs.writeFile(filePath, data.content, 'utf8');
            socket.emit('file:saved', { filename: data.filename });
        } catch (error) {
            socket.emit('execution:error', { error: `Failed to save file: ${data.filename}` });
        }
    });
    
    socket.on('file:create', async (data) => {
        try {
            const { filename, type, content = '' } = data;
            const filePath = path.join(WORKSPACE_DIR, filename);
            
            if (type === 'file') {
                await fs.writeFile(filePath, content, 'utf8');
            } else if (type === 'folder') {
                await fs.mkdir(filePath, { recursive: true });
            }
            
            socket.emit('file:created', { filename, type });
        } catch (error) {
            socket.emit('execution:error', { error: `Failed to create ${data.type}: ${data.filename}` });
        }
    });
    
    socket.on('file:delete', async (data) => {
        try {
            const filePath = path.join(WORKSPACE_DIR, data.filename);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                await fs.rmdir(filePath, { recursive: true });
                socket.emit('file:deleted', { filename: data.filename, type: 'folder' });
            } else {
                await fs.unlink(filePath);
                socket.emit('file:deleted', { filename: data.filename, type: 'file' });
            }
        } catch (error) {
            socket.emit('execution:error', { error: `Failed to delete: ${data.filename}` });
        }
    });
    
    socket.on('file:rename', async (data) => {
        try {
            const { oldPath, newName } = data;
            const oldFilePath = path.join(WORKSPACE_DIR, oldPath);
            const newFilePath = path.join(path.dirname(oldFilePath), newName);
            
            await fs.rename(oldFilePath, newFilePath);
            
            const stats = await fs.stat(newFilePath);
            const type = stats.isDirectory() ? 'folder' : 'file';
            
            socket.emit('file:renamed', { 
                oldPath, 
                newPath: path.relative(WORKSPACE_DIR, newFilePath), 
                type 
            });
        } catch (error) {
            socket.emit('execution:error', { error: `Failed to rename: ${data.oldPath}` });
        }
    });
    
    socket.on('project:upload', async (data) => {
        try {
            const { projectName, files } = data;
            console.log(`Uploading project: ${projectName} with ${files.length} files`);
            
            let filesCreated = 0;
            let foldersCreated = 0;
            const createdFolders = new Set();
            let mainFile = null;
            
            // Process each file
            for (const file of files) {
                const filePath = path.join(WORKSPACE_DIR, file.path);
                const dirPath = path.dirname(filePath);
                
                // Create directory if it doesn't exist
                if (!createdFolders.has(dirPath)) {
                    await fs.mkdir(dirPath, { recursive: true });
                    createdFolders.add(dirPath);
                    foldersCreated++;
                }
                
                // Create file if it's not binary
                if (!file.isBinary && file.content !== null) {
                    await fs.writeFile(filePath, file.content, 'utf8');
                    filesCreated++;
                    
                    // Detect main file (index.js, main.py, app.js, etc.)
                    const fileName = path.basename(file.path).toLowerCase();
                    if (!mainFile && (
                        fileName === 'index.js' || 
                        fileName === 'main.py' || 
                        fileName === 'app.js' || 
                        fileName === 'main.js' ||
                        fileName === 'index.html' ||
                        fileName === 'main.cpp' ||
                        fileName === 'main.c'
                    )) {
                        mainFile = file.path;
                    }
                }
            }
            
            socket.emit('project:uploaded', {
                projectName,
                filesCreated,
                foldersCreated,
                mainFile
            });
            
        } catch (error) {
            console.error('Project upload error:', error);
            socket.emit('project:error', { error: error.message });
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Clean up processes
        const processes = activeProcesses.get(socket.id);
        if (processes) {
            if (processes.pty) processes.pty.kill();
            if (processes.execProcess) processes.execProcess.kill();
            activeProcesses.delete(socket.id);
        }

        // Clean up python session
        stopPythonSession(socket);
        
        // Clean up debug session
        if (debugSessions.has(socket.id)) {
            debugSessions.delete(socket.id);
        }
    });
});

// Agent namespace handlers
agentNamespace.on('connection', (agentSocket) => {
    console.log('Hardware agent connected:', agentSocket.id);
    
    agentSocket.on('register', (data) => {
        const { agentId, name, platform, authToken } = data;
        
        // Simple auth token validation (in production, use proper JWT/crypto)
        const expectedToken = process.env.AGENT_AUTH_TOKEN || 'hardware-agent-secret-2024';
        if (authToken !== expectedToken) {
            agentSocket.emit('registration_failed', { error: 'Invalid auth token' });
            agentSocket.disconnect();
            return;
        }
        
        // Register agent
        const agent = {
            id: agentId,
            name: name || `Agent-${agentId}`,
            platform: platform || 'unknown',
            status: 'online',
            lastSeen: Date.now(),
            socket: agentSocket
        };
        
        hardwareAgents.set(agentId, agent);
        agentSocket.agentId = agentId;
        
        console.log(`Hardware agent registered: ${name} (${agentId}) on ${platform}`);
        agentSocket.emit('registration_success', { agentId });
        
        // Notify all IDE clients about new agent
        io.emit('hardware:agentConnected', { 
            id: agentId, 
            name: agent.name, 
            platform: agent.platform 
        });
    });
    
    // Forward agent responses back to IDE clients
    agentSocket.on('serial_ports_list', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:serialPortsList', { ports: data.ports });
        }
    });
    
    agentSocket.on('serial_opened', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:serialOpened', { 
                success: data.success, 
                port: data.port,
                error: data.error 
            });
        }
    });
    
    agentSocket.on('serial_data', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:serialData', { data: data.data });
        }
    });
    
    agentSocket.on('serial_closed', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:serialClosed', { success: data.success });
        }
    });
    
    agentSocket.on('error_response', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:error', { error: data.error });
        }
    });
    
    // Camera response handlers
    agentSocket.on('camera_list_response', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:camerasList', { cameras: data.cameras });
        }
    });
    
    agentSocket.on('camera_start_response', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:cameraStarted', { 
                success: data.success, 
                cameraId: data.cameraId,
                error: data.error 
            });
        }
    });
    
    agentSocket.on('camera_capture_response', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:cameraImage', { 
                success: data.success,
                image: data.image,
                format: data.format,
                error: data.error 
            });
        }
    });
    
    agentSocket.on('camera_stop_response', (data) => {
        const clientSocketId = getClientFromRequestId(data.requestId);
        if (clientSocketId) {
            io.to(clientSocketId).emit('hardware:cameraStopped', { success: data.success });
        }
    });
    
    // Handle agent heartbeat
    agentSocket.on('heartbeat', () => {
        if (agentSocket.agentId && hardwareAgents.has(agentSocket.agentId)) {
            const agent = hardwareAgents.get(agentSocket.agentId);
            agent.lastSeen = Date.now();
            agent.status = 'online';
        }
    });
    
    // Handle agent disconnect
    agentSocket.on('disconnect', () => {
        if (agentSocket.agentId) {
            console.log(`Hardware agent disconnected: ${agentSocket.agentId}`);
            const agent = hardwareAgents.get(agentSocket.agentId);
            if (agent) {
                agent.status = 'offline';
                // Notify IDE clients
                io.emit('hardware:agentDisconnected', { id: agentSocket.agentId });
            }
        }
    });
});

// Utility functions for request routing
const requestMap = new Map(); // requestId -> clientSocketId

function generateRequestId(clientSocketId) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    requestMap.set(requestId, clientSocketId);
    // Clean up old requests after 30 seconds
    setTimeout(() => requestMap.delete(requestId), 30000);
    return requestId;
}

function getClientFromRequestId(requestId) {
    return requestMap.get(requestId);
}

// Code execution function
async function executeCode(socket, data) {
    const { code, language, filename } = data;
    const processes = activeProcesses.get(socket.id);
    
    if (!processes) return;
    
    // Save code to temporary file
    const tempFile = path.join(WORKSPACE_DIR, `temp_${socket.id}_${Date.now()}`);
    const extension = getFileExtension(language);
    const sourceFile = tempFile + extension;
    
    await fs.writeFile(sourceFile, code, 'utf8');
    
    let command, args;
    
    switch (language) {
        case 'javascript':
            command = 'node';
            args = [sourceFile];
            break;
        case 'python':
            command = 'python3';
            args = [sourceFile];
            break;
        case 'cpp':
            const execFile = tempFile + '_exec';
            // Compile first
            const compileResult = await compileCode(sourceFile, execFile, 'g++');
            if (!compileResult.success) {
                socket.emit('execution:error', { error: compileResult.error });
                return;
            }
            command = execFile;
            args = [];
            break;
        case 'c':
            const cExecFile = tempFile + '_exec';
            const cCompileResult = await compileCode(sourceFile, cExecFile, 'gcc');
            if (!cCompileResult.success) {
                socket.emit('execution:error', { error: cCompileResult.error });
                return;
            }
            command = cExecFile;
            args = [];
            break;
        case 'craftlang':
            // Use our custom CraftLang compiler
            const craftResult = craftLangCompiler.compile(code, { debug: false });
            if (!craftResult.success) {
                socket.emit('execution:error', { error: craftResult.errors.map(e => e.message).join('\n') });
                return;
            }
            // Send output directly since CraftLang is interpreted
            socket.emit('execution:output', { output: craftResult.output, type: 'output' });
            socket.emit('execution:complete', { exitCode: 0 });
            processes.execProcess = null;
            return;
        default:
            socket.emit('execution:error', { error: `Unsupported language: ${language}` });
            return;
    }
    
    // Execute the code
    const execProcess = spawn(command, args, {
        cwd: WORKSPACE_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    processes.execProcess = execProcess;
    
    execProcess.stdout.on('data', (data) => {
        socket.emit('execution:output', { output: data.toString(), type: 'output' });
    });
    
    execProcess.stderr.on('data', (data) => {
        socket.emit('execution:output', { output: data.toString(), type: 'error' });
    });
    
    execProcess.on('close', (code) => {
        socket.emit('execution:complete', { exitCode: code });
        processes.execProcess = null;
        
        // Clean up temporary files
        fs.unlink(sourceFile).catch(() => {});
        if (language === 'cpp' || language === 'c') {
            fs.unlink(command).catch(() => {});
        }
    });
    
    execProcess.on('error', (error) => {
        socket.emit('execution:error', { error: error.message });
        processes.execProcess = null;
    });
}

// Ensure Python REPL session exists
async function ensurePythonSession(socket) {
    if (pythonSessions.has(socket.id)) {
        const sess = pythonSessions.get(socket.id);
        if (sess.proc && !sess.exited) {
            socket.emit('python:ready', { message: 'Python session ready' });
            return;
        }
    }
    const driverPath = path.join(__dirname, 'python', 'repl_driver.py');
    const proc = spawn('python3', [driverPath], { cwd: WORKSPACE_DIR });
    const session = { proc, ready: false, exited: false, buffer: '' };
    pythonSessions.set(socket.id, session);

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
        if (!session.ready) {
            session.buffer += chunk;
            if (session.buffer.includes('READY')) {
                session.ready = true;
                socket.emit('python:ready', { message: 'Python session ready' });
                session.buffer = '';
            }
            return;
        }
        // REPL driver outputs JSON per line; forwarding is handled in pythonExec
    });

    proc.stderr.on('data', (data) => {
        socket.emit('execution:output', { output: data.toString(), type: 'error' });
    });

    proc.on('close', () => {
        session.exited = true;
    });
}

// Execute code in Python REPL
function pythonExec(socket, code) {
    return new Promise(async (resolve, reject) => {
        await ensurePythonSession(socket);
        const session = pythonSessions.get(socket.id);
        if (!session || !session.proc || session.exited) return reject(new Error('Python session not available'));

        const onData = (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    session.proc.stdout.off('data', onData);
                    return resolve(obj);
                } catch (_) {
                    // ignore lines that are not JSON (e.g., READY or stray prints)
                    socket.emit('execution:output', { output: line + '\n', type: 'output' });
                }
            }
        };
        session.proc.stdout.on('data', onData);
        const payload = JSON.stringify({ code }) + '\n';
        session.proc.stdin.write(payload);
    });
}

// Reset Python session
async function resetPythonSession(socket) {
    stopPythonSession(socket);
    await ensurePythonSession(socket);
}

// Stop Python session
function stopPythonSession(socket) {
    const session = pythonSessions.get(socket.id);
    if (session && session.proc && !session.exited) {
        try {
            session.proc.stdin.write('__EXIT__\n');
        } catch (_) {}
        session.proc.kill('SIGTERM');
    }
    pythonSessions.delete(socket.id);
}

// Compile code function
function compileCode(sourceFile, outputFile, compiler) {
    return new Promise((resolve) => {
        const compileProcess = spawn(compiler, ['-o', outputFile, sourceFile], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let errorOutput = '';
        
        compileProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        compileProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: errorOutput || 'Compilation failed' });
            }
        });
        
        compileProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });
    });
}

// Stop execution
function stopExecution(socket) {
    const processes = activeProcesses.get(socket.id);
    if (processes && processes.execProcess) {
        processes.execProcess.kill('SIGTERM');
        processes.execProcess = null;
    }
}

// Debug code (basic implementation)
async function debugCode(socket, data) {
    // For now, this is a simplified debug implementation
    // In a full implementation, you'd integrate with language-specific debuggers
    const { code, language, breakpoints } = data;
    
    debugSessions.set(socket.id, {
        code,
        language,
        breakpoints: new Set(breakpoints),
        currentLine: 1,
        variables: {}
    });
    
    socket.emit('debug:started', { message: 'Debug session started' });
    
    // Simulate hitting first breakpoint if any
    if (breakpoints.length > 0) {
        const firstBreakpoint = Math.min(...breakpoints);
        socket.emit('debug:breakpoint', { line: firstBreakpoint });
        socket.emit('debug:variables', { variables: { example: 'value' } });
    }
}

// Handle debug stepping
function handleDebugStep(socket, data) {
    const session = debugSessions.get(socket.id);
    if (!session) return;
    
    // Simplified step implementation
    session.currentLine++;
    socket.emit('debug:step', { line: session.currentLine, type: data.type });
    
    // Check if we hit a breakpoint
    if (session.breakpoints.has(session.currentLine)) {
        socket.emit('debug:breakpoint', { line: session.currentLine });
    }
}

// Handle debug continue
function handleDebugContinue(socket) {
    const session = debugSessions.get(socket.id);
    if (!session) return;
    
    socket.emit('debug:continue', { message: 'Continuing execution' });
}

// Get file extension based on language
function getFileExtension(language) {
    const extensions = {
        'javascript': '.js',
        'python': '.py',
        'cpp': '.cpp',
        'c': '.c',
        'java': '.java'
    };
    return extensions[language] || '.txt';
}

// Get file tree
async function getFileTree(dirPath, basePath = '') {
    const items = [];
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue; // Skip hidden files
            
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(basePath, entry.name);
            
            if (entry.isDirectory()) {
                const children = await getFileTree(fullPath, relativePath);
                items.push({
                    name: entry.name,
                    type: 'directory',
                    path: relativePath,
                    children
                });
            } else {
                items.push({
                    name: entry.name,
                    type: 'file',
                    path: relativePath
                });
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
    }
    
    return items.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

server.listen(9000, () => {
    console.log('CodeCraft IDE Server running on port 9000');
    console.log(`Workspace directory: ${WORKSPACE_DIR}`);
    console.log('Open http://localhost:9000 to access the IDE');
});

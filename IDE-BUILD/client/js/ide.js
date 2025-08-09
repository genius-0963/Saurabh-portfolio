class CodeCraftIDE {
    constructor() {
        this.socket = io();
        this.editor = null;
        this.currentFile = null;
        this.openFiles = new Map();
        this.breakpoints = new Set();
        this.isDebugging = false;
        this.currentTheme = 'monokai';
        this.currentLanguage = 'javascript';
        this.executionProcess = null;
        this.hardwareMode = false;
        
        this.init();
    }

    init() {
        this.initEditor();
        this.initEventListeners();
        this.initSocketListeners();
        this.loadFileTree();
        this.updateStatusBar();
    }

    initEditor() {
        const textarea = document.getElementById('codeEditor');
        this.editor = CodeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            mode: this.getEditorMode(this.currentLanguage),
            theme: this.currentTheme,
            autoCloseBrackets: true,
            matchBrackets: true,
            styleActiveLine: true,
            indentUnit: 4,
            indentWithTabs: false,
            lineWrapping: false,
            gutters: ['CodeMirror-linenumbers', 'breakpoint-gutter'],
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-S': () => this.saveCurrentFile(),
                'Ctrl-O': () => this.openFile(),
                'Ctrl-N': () => this.newFile(),
                'F5': () => this.runCode(),
                'F9': () => this.toggleBreakpoint(),
                'F10': () => this.stepOver(),
                'F11': () => this.stepInto()
            }
        });

        // Add breakpoint functionality
        this.editor.on('gutterClick', (cm, n, gutter) => {
            if (gutter === 'breakpoint-gutter') {
                this.toggleBreakpoint(n + 1);
            }
        });

        // Update cursor position
        this.editor.on('cursorActivity', () => {
            this.updateCursorPosition();
        });

        // Auto-save functionality
        this.editor.on('change', () => {
            if (this.currentFile) {
                this.markFileAsModified();
            }
        });
    }

    initEventListeners() {
        // File operations
        document.getElementById('newFile').addEventListener('click', () => this.newFile());
        document.getElementById('openFile').addEventListener('click', () => this.openFile());
        document.getElementById('openProject').addEventListener('click', () => this.openProject());
        document.getElementById('saveFile').addEventListener('click', () => this.saveCurrentFile());
        
        // Execution controls
        document.getElementById('runCode').addEventListener('click', () => this.runCode());
        document.getElementById('stopCode').addEventListener('click', () => this.stopCode());
        document.getElementById('debugCode').addEventListener('click', () => this.debugCode());
        
        // Language selection
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Python full session controls
        const pyStartBtn = document.getElementById('pythonStart');
        const pyResetBtn = document.getElementById('pythonReset');
        const hwToggleBtn = document.getElementById('hardwareToggle');
        if (pyStartBtn) pyStartBtn.addEventListener('click', () => this.startPython());
        if (pyResetBtn) pyResetBtn.addEventListener('click', () => this.resetPython());
        if (hwToggleBtn) hwToggleBtn.addEventListener('click', () => this.toggleHardwareMode());

        // Hardware panel controls
        this.initHardwareEventListeners();
        
        // Panel tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchPanel(e.target.dataset.panel);
            });
        });
        
        // Serial controls
        const refreshPortsBtn = document.getElementById('refreshPorts');
        const serialConnectBtn = document.getElementById('serialConnect');
        const serialDisconnectBtn = document.getElementById('serialDisconnect');
        const serialSendBtn = document.getElementById('serialSend');
        const clearSerialBtn = document.getElementById('clearSerial');
        const serialInput = document.getElementById('serialInput');

        if (refreshPortsBtn) refreshPortsBtn.addEventListener('click', () => this.refreshSerialPorts());
        if (serialConnectBtn) serialConnectBtn.addEventListener('click', () => this.connectSerial());
        if (serialDisconnectBtn) serialDisconnectBtn.addEventListener('click', () => this.disconnectSerial());
        if (serialSendBtn) serialSendBtn.addEventListener('click', () => this.sendSerialData());
        if (clearSerialBtn) clearSerialBtn.addEventListener('click', () => this.clearSerialConsole());
        if (serialInput) {
            serialInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendSerialData();
            });
        }

        // Camera controls
        const refreshCamerasBtn = document.getElementById('refreshCameras');
        const cameraStartBtn = document.getElementById('cameraStart');
        const cameraCaptureBtn = document.getElementById('cameraCapture');
        const cameraStopBtn = document.getElementById('cameraStop');

        if (refreshCamerasBtn) refreshCamerasBtn.addEventListener('click', () => this.refreshCameras());
        if (cameraStartBtn) cameraStartBtn.addEventListener('click', () => this.startCamera());
        if (cameraCaptureBtn) cameraCaptureBtn.addEventListener('click', () => this.captureImage());
        if (cameraStopBtn) cameraStopBtn.addEventListener('click', () => this.stopCamera());

        // Console operations
        document.getElementById('clearConsole').addEventListener('click', () => this.clearConsole());
        document.getElementById('sendInput').addEventListener('click', () => this.sendInput());
        document.getElementById('consoleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendInput();
        });
        
        // Debugger controls
        document.getElementById('stepOver').addEventListener('click', () => this.stepOver());
        document.getElementById('stepInto').addEventListener('click', () => this.stepInto());
        document.getElementById('stepOut').addEventListener('click', () => this.stepOut());
        document.getElementById('continue').addEventListener('click', () => this.continueExecution());
        
        // File tree refresh
        document.getElementById('refreshFiles').addEventListener('click', () => this.loadFileTree());
        
        // File explorer actions
        document.getElementById('newFileInExplorer').addEventListener('click', () => this.createNewFileInExplorer());
        document.getElementById('newFolderInExplorer').addEventListener('click', () => this.createNewFolderInExplorer());
        
        // File input for opening files
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // Folder input for opening projects
        document.getElementById('folderInput').addEventListener('change', (e) => {
            this.handleProjectUpload(e.target.files);
        });
        
        // Context menu
        this.initContextMenu();
    }

    initSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateExecutionStatus('Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateExecutionStatus('Disconnected');
        });

        this.socket.on('terminal:data', (data) => {
            this.appendToConsole(data, 'output');
        });

        this.socket.on('execution:output', (data) => {
            this.appendToConsole(data.output, data.type || 'output');
        });

        this.socket.on('execution:error', (data) => {
            this.appendToConsole(data.error, 'error');
            this.updateExecutionStatus('Error');
        });

        this.socket.on('execution:complete', (data) => {
            this.appendToConsole(`\nExecution completed with exit code: ${data.exitCode}`, 'info');
            this.updateExecutionStatus('Ready');
            this.executionProcess = null;
        });

        this.socket.on('debug:breakpoint', (data) => {
            this.handleBreakpointHit(data);
        });

        this.socket.on('debug:variables', (data) => {
            this.updateVariables(data.variables);
        });

        this.socket.on('file:tree', (data) => {
            this.renderFileTree(data.tree);
        });

        this.socket.on('file:content', (data) => {
            this.openFileContent(data.filename, data.content);
        });

        this.socket.on('file:saved', (data) => {
            this.handleFileSaved(data.filename);
        });

        this.socket.on('file:created', (data) => {
            this.handleFileCreated(data);
        });

        this.socket.on('file:deleted', (data) => {
            this.handleFileDeleted(data);
        });

        this.socket.on('file:renamed', (data) => {
            this.handleFileRenamed(data);
        });

        this.socket.on('project:uploaded', (data) => {
            this.handleProjectUploaded(data);
        });

        this.socket.on('project:error', (data) => {
            this.appendToConsole(`Project upload error: ${data.error}`, 'error');
            this.updateExecutionStatus('Ready');
        });

        // Python REPL events
        this.socket.on('python:ready', (data) => {
            this.appendToConsole(data?.message || 'Python session ready', 'info');
            this.updateExecutionStatus('Python Ready');
        });
        this.socket.on('python:stopped', (data) => {
            this.appendToConsole(data?.message || 'Python session stopped', 'info');
            this.updateExecutionStatus('Ready');
        });

        // Hardware events
        this.socket.on('hardware:agentsList', (data) => {
            this.updateAgentsList(data.agents);
        });
        this.socket.on('hardware:agentConnected', (data) => {
            this.onAgentConnected(data);
        });
        this.socket.on('hardware:agentDisconnected', (data) => {
            this.onAgentDisconnected(data);
        });
        this.socket.on('hardware:agentSelected', (data) => {
            this.onAgentSelected(data);
        });
        this.socket.on('hardware:serialPortsList', (data) => {
            this.updateSerialPortsList(data.ports);
        });
        this.socket.on('hardware:serialOpened', (data) => {
            this.onSerialOpened(data);
        });
        this.socket.on('hardware:serialClosed', (data) => {
            this.onSerialClosed(data);
        });
        this.socket.on('hardware:serialData', (data) => {
            this.onSerialData(data);
        });
        this.socket.on('hardware:error', (data) => {
            this.appendToConsole(`Hardware error: ${data.error}`, 'error');
        });
        this.socket.on('hardware:camerasList', (data) => {
            this.updateCamerasList(data.cameras);
        });
        this.socket.on('hardware:cameraStarted', (data) => {
            this.onCameraStarted(data);
        });
        this.socket.on('hardware:cameraStopped', (data) => {
            this.onCameraStopped(data);
        });
        this.socket.on('hardware:cameraImage', (data) => {
            this.onCameraImage(data);
        });
    }

    getEditorMode(language) {
        const modes = {
            'javascript': 'javascript',
            'python': 'python',
            'python_full': 'python',
            'cpp': 'text/x-c++src',
            'c': 'text/x-csrc',
            'java': 'text/x-java',
            'html': 'htmlmixed',
            'css': 'css',
            'json': 'application/json',
            'craftlang': 'javascript' // Use JavaScript mode for syntax highlighting
        };
        return modes[language] || 'text/plain';
    }

    changeLanguage(language) {
        this.currentLanguage = language;
        this.editor.setOption('mode', this.getEditorMode(language));
        document.getElementById('languageStatus').textContent = language.toUpperCase();
        
        // Update file extension if creating new file
        if (this.currentFile && this.currentFile.startsWith('untitled')) {
            const extensions = {
                'javascript': '.js',
                'python': '.py',
                'python_full': '.py',
                'cpp': '.cpp',
                'c': '.c',
                'java': '.java',
                'html': '.html',
                'css': '.css'
            };
            // Update tab name with extension
            this.updateTabName(this.currentFile, `untitled${extensions[language] || '.txt'}`);
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'monokai' ? 'eclipse' : 'monokai';
        this.editor.setOption('theme', this.currentTheme);
        document.body.classList.toggle('light-theme', this.currentTheme === 'eclipse');
    }

    newFile() {
        const filename = `untitled-${Date.now()}`;
        this.openFiles.set(filename, {
            content: '',
            modified: false,
            language: this.currentLanguage
        });
        this.switchToFile(filename);
        this.addTab(filename);
    }

    openFile() {
        document.getElementById('fileInput').click();
    }

    openProject() {
        document.getElementById('folderInput').click();
    }

    handleFileUpload(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const filename = file.name;
                this.openFiles.set(filename, {
                    content: content,
                    modified: false,
                    language: this.detectLanguage(filename)
                });
                this.switchToFile(filename);
                this.addTab(filename);
            };
            reader.readAsText(file);
        });
    }

    handleProjectUpload(files) {
        if (files.length === 0) return;
        
        // Show loading message
        this.appendToConsole('Uploading project files...', 'info');
        this.updateExecutionStatus('Uploading...');
        
        // Get the project root folder name
        const firstFile = files[0];
        const projectName = firstFile.webkitRelativePath.split('/')[0];
        
        // Confirm project import
        if (!confirm(`Import project "${projectName}" with ${files.length} files?`)) {
            return;
        }
        
        // Process all files in the project
        const projectFiles = [];
        let processedCount = 0;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const relativePath = file.webkitRelativePath;
                
                projectFiles.push({
                    path: relativePath,
                    content: content,
                    size: file.size
                });
                
                processedCount++;
                
                // When all files are processed, send to server
                if (processedCount === files.length) {
                    this.uploadProjectToServer(projectName, projectFiles);
                }
            };
            
            reader.onerror = () => {
                this.appendToConsole(`Error reading file: ${file.webkitRelativePath}`, 'error');
                processedCount++;
                
                if (processedCount === files.length) {
                    this.uploadProjectToServer(projectName, projectFiles);
                }
            };
            
            // Only read text files (skip binary files)
            if (this.isTextFile(file.name)) {
                reader.readAsText(file);
            } else {
                // For binary files, just record the path
                projectFiles.push({
                    path: file.webkitRelativePath,
                    content: null,
                    size: file.size,
                    isBinary: true
                });
                processedCount++;
                
                if (processedCount === files.length) {
                    this.uploadProjectToServer(projectName, projectFiles);
                }
            }
        });
    }

    isTextFile(filename) {
        const textExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.css', '.scss', '.sass', '.html', '.htm', '.xml', '.json', '.yaml', '.yml',
            '.md', '.txt', '.csv', '.sql', '.php', '.rb', '.go', '.rs', '.swift',
            '.kt', '.scala', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore',
            '.env', '.config', '.ini', '.toml', '.lock', '.log'
        ];
        
        const ext = '.' + filename.split('.').pop().toLowerCase();
        return textExtensions.includes(ext) || filename.includes('README') || 
               filename.includes('LICENSE') || filename.includes('Makefile');
    }

    uploadProjectToServer(projectName, files) {
        this.appendToConsole(`Uploading ${files.length} files to server...`, 'info');
        
        this.socket.emit('project:upload', {
            projectName: projectName,
            files: files
        });
    }

    detectLanguage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const langMap = {
            'js': 'javascript',
            'py': 'python',
            'cpp': 'cpp',
            'c': 'c',
            'java': 'java',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'craft': 'craftlang',
            'cl': 'craftlang'
        };
        return langMap[ext] || 'text';
    }

    saveCurrentFile() {
        if (!this.currentFile) return;
        
        const content = this.editor.getValue();
        const fileData = this.openFiles.get(this.currentFile);
        
        if (fileData) {
            fileData.content = content;
            fileData.modified = false;
            
            // Send to server for actual file saving
            this.socket.emit('file:save', {
                filename: this.currentFile,
                content: content,
                language: fileData.language
            });
            
            this.updateTabModifiedState(this.currentFile, false);
        }
    }

    switchToFile(filename) {
        if (this.currentFile === filename) return;
        
        // Save current file state
        if (this.currentFile && this.openFiles.has(this.currentFile)) {
            this.openFiles.get(this.currentFile).content = this.editor.getValue();
        }
        
        this.currentFile = filename;
        const fileData = this.openFiles.get(filename);
        
        if (fileData) {
            this.editor.setValue(fileData.content);
            this.changeLanguage(fileData.language);
            this.updateActiveTab(filename);
            this.updateStatusBar();
        }
    }

    addTab(filename) {
        const tabsContainer = document.getElementById('editorTabs');
        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        tab.dataset.filename = filename;
        
        const displayName = filename.length > 20 ? '...' + filename.slice(-17) : filename;
        
        tab.innerHTML = `
            <span class="tab-name">${displayName}</span>
            <button class="close-btn" onclick="event.stopPropagation(); ide.closeFile('${filename}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tab.addEventListener('click', () => this.switchToFile(filename));
        tabsContainer.appendChild(tab);
        this.updateActiveTab(filename);
    }

    closeFile(filename) {
        const fileData = this.openFiles.get(filename);
        if (fileData && fileData.modified) {
            if (!confirm(`File "${filename}" has unsaved changes. Close anyway?`)) {
                return;
            }
        }
        
        this.openFiles.delete(filename);
        const tab = document.querySelector(`[data-filename="${filename}"]`);
        if (tab) tab.remove();
        
        if (this.currentFile === filename) {
            const remainingFiles = Array.from(this.openFiles.keys());
            if (remainingFiles.length > 0) {
                this.switchToFile(remainingFiles[0]);
            } else {
                this.currentFile = null;
                this.editor.setValue('');
                this.updateStatusBar();
            }
        }
    }

    updateActiveTab(filename) {
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filename === filename);
        });
    }

    updateTabName(oldName, newName) {
        const tab = document.querySelector(`[data-filename="${oldName}"]`);
        if (tab) {
            tab.dataset.filename = newName;
            tab.querySelector('.tab-name').textContent = newName;
        }
    }

    updateTabModifiedState(filename, modified) {
        const tab = document.querySelector(`[data-filename="${filename}"]`);
        if (tab) {
            const tabName = tab.querySelector('.tab-name');
            if (modified && !tabName.textContent.endsWith('*')) {
                tabName.textContent += '*';
            } else if (!modified && tabName.textContent.endsWith('*')) {
                tabName.textContent = tabName.textContent.slice(0, -1);
            }
        }
    }

    markFileAsModified() {
        if (this.currentFile && this.openFiles.has(this.currentFile)) {
            const fileData = this.openFiles.get(this.currentFile);
            if (!fileData.modified) {
                fileData.modified = true;
                this.updateTabModifiedState(this.currentFile, true);
            }
        }
    }

    runCode() {
        if (!this.currentFile) {
            this.appendToConsole('No file selected for execution.', 'error');
            return;
        }
        
        const code = this.editor.getValue();
        if (!code.trim()) {
            this.appendToConsole('No code to execute.', 'error');
            return;
        }
        
        this.clearConsole();
        this.updateExecutionStatus('Running...');

        if (this.currentLanguage === 'python_full') {
            // Ensure Python session then execute
            this.socket.emit('python:start');
            this.socket.emit('python:exec', { code });
        } else {
            this.socket.emit('code:execute', {
                code: code,
                language: this.currentLanguage,
                filename: this.currentFile
            });
        }
    }

    stopCode() {
        if (this.executionProcess) {
            this.socket.emit('code:stop', { processId: this.executionProcess });
            this.updateExecutionStatus('Stopped');
        }
    }

    debugCode() {
        if (!this.currentFile) {
            this.appendToConsole('No file selected for debugging.', 'error');
            return;
        }
        
        const code = this.editor.getValue();
        this.clearConsole();
        this.isDebugging = true;
        this.updateExecutionStatus('Debugging...');
        
        this.socket.emit('code:debug', {
            code: code,
            language: this.currentLanguage,
            filename: this.currentFile,
            breakpoints: Array.from(this.breakpoints)
        });
        
        this.switchPanel('debugger');
    }

    toggleBreakpoint(line) {
        if (!line) {
            const cursor = this.editor.getCursor();
            line = cursor.line + 1;
        }
        
        if (this.breakpoints.has(line)) {
            this.breakpoints.delete(line);
            this.removeBreakpointMarker(line - 1);
        } else {
            this.breakpoints.add(line);
            this.addBreakpointMarker(line - 1);
        }
        
        this.updateBreakpointsList();
    }

    addBreakpointMarker(line) {
        const marker = document.createElement('div');
        marker.className = 'breakpoint';
        marker.title = `Breakpoint at line ${line + 1}`;
        this.editor.setGutterMarker(line, 'breakpoint-gutter', marker);
    }

    removeBreakpointMarker(line) {
        this.editor.setGutterMarker(line, 'breakpoint-gutter', null);
    }

    updateBreakpointsList() {
        const list = document.getElementById('breakpoints');
        list.innerHTML = '';
        
        Array.from(this.breakpoints).sort((a, b) => a - b).forEach(line => {
            const item = document.createElement('li');
            item.textContent = `Line ${line}`;
            item.addEventListener('click', () => {
                this.editor.setCursor(line - 1, 0);
                this.editor.focus();
            });
            list.appendChild(item);
        });
    }

    stepOver() {
        if (this.isDebugging) {
            this.socket.emit('debug:step', { type: 'over' });
        }
    }

    stepInto() {
        if (this.isDebugging) {
            this.socket.emit('debug:step', { type: 'into' });
        }
    }

    stepOut() {
        if (this.isDebugging) {
            this.socket.emit('debug:step', { type: 'out' });
        }
    }

    continueExecution() {
        if (this.isDebugging) {
            this.socket.emit('debug:continue');
        }
    }

    handleBreakpointHit(data) {
        this.appendToConsole(`Breakpoint hit at line ${data.line}`, 'info');
        this.editor.setCursor(data.line - 1, 0);
        this.editor.addLineClass(data.line - 1, 'background', 'debug-line');
    }

    switchPanel(panelName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });
        
        document.querySelectorAll('.panel-content').forEach(panel => {
            panel.classList.toggle('active', panel.id === panelName);
        });
    }

    appendToConsole(text, type = 'output') {
        const consoleOutput = document.getElementById('consoleOutput');
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = text;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    clearConsole() {
        document.getElementById('consoleOutput').innerHTML = '';
    }

    sendInput() {
        const input = document.getElementById('consoleInput');
        const value = input.value;
        if (value.trim()) {
            this.appendToConsole(`> ${value}`, 'input');
            this.socket.emit('terminal:data', value + '\n');
            input.value = '';
        }
    }

    updateVariables(variables) {
        const container = document.getElementById('variablesContent');
        container.innerHTML = '';
        
        Object.entries(variables).forEach(([name, value]) => {
            const item = document.createElement('div');
            item.className = 'variable-item';
            item.innerHTML = `
                <span class="variable-name">${name}</span>
                <span class="variable-value">${JSON.stringify(value)}</span>
            `;
            container.appendChild(item);
        });
    }

    loadFileTree() {
        this.socket.emit('file:getTree');
    }

    renderFileTree(tree) {
        const container = document.getElementById('fileTree');
        container.innerHTML = '';
        this.renderTreeNode(tree, container, 0);
    }

    renderTreeNode(node, container, depth) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.paddingLeft = `${depth * 16 + 8}px`;
        
        const icon = node.type === 'directory' ? 'fas fa-folder' : 'fas fa-file';
        item.innerHTML = `
            <i class="${icon}"></i>
            <span>${node.name}</span>
        `;
        
        // Left click to open files
        if (node.type === 'file') {
            item.addEventListener('click', () => {
                this.socket.emit('file:open', { filename: node.path });
            });
        }
        
        // Right click for context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, node);
        });
        
        container.appendChild(item);
        
        if (node.children) {
            node.children.forEach(child => {
                this.renderTreeNode(child, container, depth + 1);
            });
        }
    }

    showContextMenu(event, node) {
        this.setCurrentContextItem(node);
        
        const contextMenu = this.contextMenu;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        
        // Hide/show context items based on file type
        const openItem = document.getElementById('contextOpen');
        if (node.type === 'directory') {
            openItem.style.display = 'none';
        } else {
            openItem.style.display = 'flex';
        }
    }

    openFileContent(filename, content) {
        this.openFiles.set(filename, {
            content: content,
            modified: false,
            language: this.detectLanguage(filename)
        });
        this.switchToFile(filename);
        this.addTab(filename);
    }

    handleFileSaved(filename) {
        this.appendToConsole(`File saved: ${filename}`, 'info');
        const fileData = this.openFiles.get(filename);
        if (fileData) {
            fileData.modified = false;
            this.updateTabModifiedState(filename, false);
        }
    }

    updateStatusBar() {
        document.getElementById('currentFile').textContent = 
            this.currentFile || 'No file selected';
        document.getElementById('languageStatus').textContent = 
            this.currentLanguage.toUpperCase();
    }

    updateCursorPosition() {
        const cursor = this.editor.getCursor();
        document.getElementById('cursorPosition').textContent = 
            `Line ${cursor.line + 1}, Column ${cursor.ch + 1}`;
    }

    updateExecutionStatus(status) {
        document.getElementById('executionStatus').textContent = status;
    }

    createNewFileInExplorer() {
        const fileName = prompt('Enter file name (with extension):');
        if (fileName && fileName.trim()) {
            this.socket.emit('file:create', {
                filename: fileName.trim(),
                type: 'file',
                content: ''
            });
        }
    }

    createNewFolderInExplorer() {
        const folderName = prompt('Enter folder name:');
        if (folderName && folderName.trim()) {
            this.socket.emit('file:create', {
                filename: folderName.trim(),
                type: 'folder'
            });
        }
    }

    handleFileCreated(data) {
        this.appendToConsole(`${data.type === 'file' ? 'File' : 'Folder'} created: ${data.filename}`, 'info');
        this.loadFileTree(); // Refresh the file tree
        
        // If it's a file, open it automatically
        if (data.type === 'file') {
            setTimeout(() => {
                this.socket.emit('file:open', { filename: data.filename });
            }, 500);
        }
    }

    handleFileDeleted(data) {
        this.appendToConsole(`${data.type === 'file' ? 'File' : 'Folder'} deleted: ${data.filename}`, 'info');
        this.loadFileTree(); // Refresh the file tree
        
        // Close the file if it's open
        if (data.type === 'file' && this.openFiles.has(data.filename)) {
            this.closeFile(data.filename);
        }
    }

    handleFileRenamed(data) {
        this.appendToConsole(`${data.type === 'file' ? 'File' : 'Folder'} renamed: ${data.oldPath} → ${data.newPath}`, 'info');
        this.loadFileTree(); // Refresh the file tree
        
        // Update open file if it was renamed
        if (data.type === 'file' && this.openFiles.has(data.oldPath)) {
            const fileData = this.openFiles.get(data.oldPath);
            this.openFiles.delete(data.oldPath);
            this.openFiles.set(data.newPath, fileData);
            
            if (this.currentFile === data.oldPath) {
                this.currentFile = data.newPath;
            }
            
            // Update tab
            this.updateTabName(data.oldPath, data.newPath);
        }
    }

    handleProjectUploaded(data) {
        this.appendToConsole(`Project "${data.projectName}" uploaded successfully!`, 'info');
        this.appendToConsole(`${data.filesCreated} files created, ${data.foldersCreated} folders created`, 'info');
        this.updateExecutionStatus('Ready');
        
        // Refresh file tree to show new project
        this.loadFileTree();
        
        // If there's a main file, open it
        if (data.mainFile) {
            setTimeout(() => {
                this.socket.emit('file:open', { filename: data.mainFile });
            }, 1000);
        }
    }

    initContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        let currentContextItem = null;

        // Hide context menu when clicking elsewhere
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });

        // Context menu actions
        document.getElementById('contextOpen').addEventListener('click', () => {
            if (currentContextItem) {
                this.socket.emit('file:open', { filename: currentContextItem.path });
            }
            contextMenu.style.display = 'none';
        });

        document.getElementById('contextDelete').addEventListener('click', () => {
            if (currentContextItem) {
                const itemType = currentContextItem.type === 'directory' ? 'folder' : 'file';
                if (confirm(`Are you sure you want to delete this ${itemType}?`)) {
                    this.socket.emit('file:delete', { filename: currentContextItem.path });
                }
            }
            contextMenu.style.display = 'none';
        });

        document.getElementById('contextRename').addEventListener('click', () => {
            if (currentContextItem) {
                const newName = prompt('Enter new name:', currentContextItem.name);
                if (newName && newName.trim() && newName !== currentContextItem.name) {
                    this.socket.emit('file:rename', { 
                        oldPath: currentContextItem.path, 
                        newName: newName.trim() 
                    });
                }
            }
            contextMenu.style.display = 'none';
        });

        // Store reference for context menu positioning
        this.contextMenu = contextMenu;
        this.setCurrentContextItem = (item) => {
            currentContextItem = item;
        };
    }
}

// Initialize IDE when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ide = new CodeCraftIDE();
});

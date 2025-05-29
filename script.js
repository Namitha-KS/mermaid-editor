class InteractiveFlowchart {
    constructor() {
        this.isEditMode = false;
        this.selectedNode = null;
        this.isConnectMode = false;
        this.connectStartNode = null;
        this.nodeCounter = 0;
        this.dragData = null;
        this.mermaidCode = '';
        this.parsedNodes = new Map();
        this.parsedEdges = [];
        
        this.init();
    }

    init() {
        // Initialize Mermaid with updated configuration
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: false, // Changed to false to avoid getBBox issues
                curve: 'basis'
            },
            securityLevel: 'loose',
            suppressErrorRendering: false
        });

        this.bindEvents();
        // Set a default flowchart to start with
        this.setDefaultFlowchart();
        this.updatePreview();
    }

    setDefaultFlowchart() {
        const defaultCode = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[End]
    D --> E`;
        
        const codeInput = document.getElementById('mermaidCode');
        if (codeInput && !codeInput.value.trim()) {
            codeInput.value = defaultCode;
        }
    }

    bindEvents() {
        // Editor events
        document.getElementById('mermaidCode').addEventListener('input', 
            this.debounce(() => this.updatePreview(), 500));
        document.getElementById('updateBtn').addEventListener('click', () => this.updatePreview());
        document.getElementById('toggleEditBtn').addEventListener('click', () => this.toggleEditMode());

        // Toolbar events
        document.getElementById('addNodeBtn').addEventListener('click', () => this.addNewNode());
        document.getElementById('connectModeBtn').addEventListener('click', () => this.toggleConnectMode());
        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());

        // Property panel events
        this.bindPropertyEvents();

        // Download event - Fixed implementation
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFlowchart());

        // Global events
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Mouse events for dragging
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    bindPropertyEvents() {
        const panel = document.getElementById('propertyPanel');
        
        document.getElementById('nodeText').addEventListener('input', (e) => {
            if (this.selectedNode) {
                this.updateNodeText(this.selectedNode, e.target.value);
            }
        });

        document.getElementById('nodeBgColor').addEventListener('input', (e) => {
            if (this.selectedNode && !document.getElementById('noBgColor').checked) {
                this.updateNodeStyle(this.selectedNode, 'fill', e.target.value);
            }
        });

        document.getElementById('noBgColor').addEventListener('change', (e) => {
            if (this.selectedNode) {
                const color = e.target.checked ? 'transparent' : document.getElementById('nodeBgColor').value;
                this.updateNodeStyle(this.selectedNode, 'fill', color);
            }
        });

        document.getElementById('nodeBorderColor').addEventListener('input', (e) => {
            if (this.selectedNode) {
                this.updateNodeStyle(this.selectedNode, 'stroke', e.target.value);
            }
        });

        document.getElementById('nodeTextColor').addEventListener('input', (e) => {
            if (this.selectedNode) {
                this.updateNodeStyle(this.selectedNode, 'color', e.target.value);
            }
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            if (this.selectedNode) {
                this.updateNodeStyle(this.selectedNode, 'font-size', e.target.value + 'px');
                document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
            }
        });

        document.getElementById('deleteNode').addEventListener('click', () => {
            if (this.selectedNode) {
                this.deleteNode(this.selectedNode);
            }
        });

        document.getElementById('closePanel').addEventListener('click', () => {
            this.hidePropertyPanel();
        });
    }

    async updatePreview() {
        const code = document.getElementById('mermaidCode').value.trim();
        const preview = document.getElementById('mermaidPreview');
        const diagram = document.getElementById('mermaidDiagram');
        
        if (!code) {
            diagram.innerHTML = '<div class="loading">Enter Mermaid code to see preview</div>';
            return;
        }

        try {
            this.mermaidCode = code;
            diagram.innerHTML = '';
            
            const elementId = 'mermaid-' + Date.now();
            const containerDiv = document.createElement('div');
            containerDiv.id = elementId;
            containerDiv.className = 'mermaid';
            containerDiv.textContent = code;
            
            diagram.appendChild(containerDiv);
            
            // Use the newer mermaid.run API correctly
            await mermaid.run({
                nodes: [containerDiv]
            });
            
            // Make interactive after rendering
            setTimeout(() => {
                this.makeInteractive();
                this.parseCodeStructure(code);
            }, 200);
            
        } catch (error) {
            console.error('Mermaid rendering error:', error);
            diagram.innerHTML = `<div class="error">Error rendering diagram: ${error.message}</div>`;
            
            // Try fallback method
            this.tryFallbackRender(code, diagram);
        }
    }

    tryFallbackRender(code, diagram) {
        try {
            // Fallback to older mermaid API if available
            if (mermaid.render) {
                const elementId = 'fallback-mermaid-' + Date.now();
                mermaid.render(elementId, code)
                    .then(({svg}) => {
                        diagram.innerHTML = svg;
                        setTimeout(() => {
                            this.makeInteractive();
                            this.parseCodeStructure(code);
                        }, 200);
                    })
                    .catch(err => {
                        console.error('Fallback render failed:', err);
                        diagram.innerHTML = `<div class="error">Failed to render diagram. Please check your Mermaid syntax.</div>`;
                    });
            } else {
                diagram.innerHTML = `<div class="error">Mermaid rendering failed. Please check syntax and Mermaid version.</div>`;
            }
        } catch (fallbackError) {
            console.error('Fallback render error:', fallbackError);
            diagram.innerHTML = `<div class="error">Unable to render diagram. Please verify Mermaid is properly loaded.</div>`;
        }
    }

    makeInteractive() {
        if (!this.isEditMode) return;

        const svg = document.querySelector('#mermaidDiagram svg');
        if (!svg) return;

        // Make nodes interactive
        const nodes = svg.querySelectorAll('.node');
        nodes.forEach(node => {
            node.style.cursor = 'pointer';
            
            // Click event
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleNodeClick(node, e);
            });

            // Mouse events for dragging
            node.addEventListener('mousedown', (e) => {
                if (this.isEditMode) {
                    this.startDrag(node, e);
                }
            });

            // Double click to edit text
            node.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editNodeText(node);
            });
        });

        // Make edges interactive
        const edges = svg.querySelectorAll('.edgeLabel');
        edges.forEach(edge => {
            edge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editEdgeLabel(edge);
            });
        });
    }

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const indicator = document.getElementById('editModeIndicator');
        const preview = document.getElementById('mermaidPreview');
        
        if (this.isEditMode) {
            indicator.textContent = 'Edit Mode: ON';
            indicator.classList.add('active');
            preview.classList.add('edit-mode');
            this.makeInteractive();
        } else {
            indicator.textContent = 'Edit Mode: OFF';
            indicator.classList.remove('active');
            preview.classList.remove('edit-mode');
            this.clearSelection();
        }
    }

    handleNodeClick(node, event) {
        if (!this.isEditMode) return;

        if (this.isConnectMode) {
            this.handleConnectionClick(node);
            return;
        }

        this.selectNode(node);
        event.stopPropagation();
    }

    selectNode(node) {
        // Clear previous selection
        this.clearSelection();
        
        // Select new node
        node.classList.add('selected');
        this.selectedNode = node;
        this.showPropertyPanel(node);
    }

    clearSelection() {
        const selected = document.querySelectorAll('.node.selected');
        selected.forEach(node => node.classList.remove('selected'));
        this.selectedNode = null;
        this.hidePropertyPanel();
    }

    showPropertyPanel(node) {
        const panel = document.getElementById('propertyPanel');
        const nodeText = this.getNodeText(node);
        
        // Fill current values
        document.getElementById('nodeText').value = nodeText;
        
        // Get computed styles
        const rect = node.querySelector('rect') || node.querySelector('circle') || node.querySelector('polygon');
        if (rect) {
            const fill = rect.getAttribute('fill') || '#ffffff';
            const stroke = rect.getAttribute('stroke') || '#000000';
            
            document.getElementById('nodeBgColor').value = fill.startsWith('#') ? fill : '#ffffff';
            document.getElementById('nodeBorderColor').value = stroke.startsWith('#') ? stroke : '#000000';
        }
        
        panel.style.display = 'block';
        panel.classList.add('show');
    }

    hidePropertyPanel() {
        const panel = document.getElementById('propertyPanel');
        panel.style.display = 'none';
        panel.classList.remove('show');
    }

    getNodeText(node) {
        const textElement = node.querySelector('text, tspan');
        return textElement ? textElement.textContent.trim() : '';
    }

    updateNodeText(node, newText) {
        const textElement = node.querySelector('text, tspan');
        if (textElement) {
            textElement.textContent = newText;
            
            // Update the code
            this.updateCodeWithNodeChange(node, 'text', newText);
        }
    }

    updateNodeStyle(node, property, value) {
        const shapes = node.querySelectorAll('rect, circle, polygon, path');
        const texts = node.querySelectorAll('text, tspan');
        
        shapes.forEach(shape => {
            if (property === 'fill' || property === 'stroke') {
                shape.setAttribute(property, value);
            }
        });
        
        if (property === 'color' || property === 'font-size') {
            texts.forEach(text => {
                text.style[property] = value;
            });
        }
    }

    startDrag(node, event) {
        if (!this.isEditMode) return;
        
        this.dragData = {
            node: node,
            startX: event.clientX,
            startY: event.clientY,
            nodeStartX: parseFloat(node.getAttribute('transform')?.match(/translate\(([^,]+)/)?.[1] || 0),
            nodeStartY: parseFloat(node.getAttribute('transform')?.match(/translate\([^,]+,([^)]+)/)?.[1] || 0)
        };
        
        node.classList.add('dragging');
        event.preventDefault();
    }

    handleMouseMove(event) {
        if (!this.dragData) return;
        
        const deltaX = event.clientX - this.dragData.startX;
        const deltaY = event.clientY - this.dragData.startY;
        
        const newX = this.dragData.nodeStartX + deltaX;
        const newY = this.dragData.nodeStartY + deltaY;
        
        this.dragData.node.setAttribute('transform', `translate(${newX}, ${newY})`);
    }

    handleMouseUp() {
        if (this.dragData) {
            this.dragData.node.classList.remove('dragging');
            this.dragData = null;
        }
    }

    toggleConnectMode() {
        this.isConnectMode = !this.isConnectMode;
        const btn = document.getElementById('connectModeBtn');
        
        if (this.isConnectMode) {
            btn.style.background = '#e74c3c';
            btn.textContent = '❌ Cancel Connect';
            this.connectStartNode = null;
        } else {
            btn.style.background = '#3498db';
            btn.textContent = '🔗 Connect Nodes';
            this.connectStartNode = null;
        }
    }

    handleConnectionClick(node) {
        if (!this.connectStartNode) {
            this.connectStartNode = node;
            node.style.outline = '3px solid #27ae60';
        } else if (this.connectStartNode !== node) {
            this.createConnection(this.connectStartNode, node);
            this.connectStartNode.style.outline = '';
            this.connectStartNode = null;
            this.toggleConnectMode();
        }
    }

    createConnection(startNode, endNode) {
        const startId = this.getNodeId(startNode);
        const endId = this.getNodeId(endNode);
        
        if (startId && endId) {
            const currentCode = document.getElementById('mermaidCode').value;
            const newConnection = `    ${startId} --> ${endId}`;
            
            document.getElementById('mermaidCode').value = currentCode + '\n' + newConnection;
            this.updatePreview();
        }
    }

    getNodeId(node) {
        // Extract node ID from the DOM structure
        const textContent = this.getNodeText(node);
        // This is a simplified approach - in a real implementation,
        // you'd need to map DOM nodes back to their Mermaid IDs
        return textContent.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    }

    addNewNode() {
        const nodeId = `N${++this.nodeCounter}`;
        const nodeText = `Node ${this.nodeCounter}`;
        const currentCode = document.getElementById('mermaidCode').value;
        
        const newNodeLine = `    ${nodeId}[${nodeText}]`;
        document.getElementById('mermaidCode').value = currentCode + '\n' + newNodeLine;
        
        this.updatePreview();
    }

    deleteNode(node) {
        // This is complex as it requires parsing and rebuilding the Mermaid code
        // For now, we'll just hide the node
        node.style.display = 'none';
        this.hidePropertyPanel();
        
        // In a full implementation, you'd parse the code, remove the node and its connections,
        // then regenerate the code
    }

    editNodeText(node) {
        const currentText = this.getNodeText(node);
        const newText = prompt('Enter new text:', currentText);
        
        if (newText !== null && newText !== currentText) {
            this.updateNodeText(node, newText);
        }
    }

    editEdgeLabel(edge) {
        const currentText = edge.textContent.trim();
        const newText = prompt('Enter edge label:', currentText);
        
        if (newText !== null) {
            edge.textContent = newText;
        }
    }

    handleGlobalClick(event) {
        if (!event.target.closest('.property-panel') && 
            !event.target.closest('.node') &&
            !event.target.closest('.context-menu')) {
            this.clearSelection();
            this.hideContextMenu();
        }
    }

    handleContextMenu(event) {
        if (!this.isEditMode) return;
        
        const node = event.target.closest('.node');
        if (node) {
            event.preventDefault();
            this.showContextMenu(event.clientX, event.clientY, node);
        }
    }

    showContextMenu(x, y, node) {
        const menu = document.getElementById('contextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // Bind context menu actions
        document.getElementById('editText').onclick = () => {
            this.editNodeText(node);
            this.hideContextMenu();
        };
        
        document.getElementById('changeColor').onclick = () => {
            this.selectNode(node);
            this.hideContextMenu();
        };
        
        document.getElementById('deleteItem').onclick = () => {
            this.deleteNode(node);
            this.hideContextMenu();
        };
    }

    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    handleKeyDown(event) {
        if (!this.isEditMode) return;
        
        if (event.key === 'Delete' && this.selectedNode) {
            this.deleteNode(this.selectedNode);
        } else if (event.key === 'Escape') {
            this.clearSelection();
            if (this.isConnectMode) {
                this.toggleConnectMode();
            }
        } else if (event.key === 'Enter' && this.selectedNode) {
            this.editNodeText(this.selectedNode);
        }
    }

    parseCodeStructure(code) {
        // Parse Mermaid code to understand structure
        // This is a simplified parser for basic flowcharts
        this.parsedNodes.clear();
        this.parsedEdges = [];
        
        const lines = code.split('\n').map(line => line.trim()).filter(line => line);
        
        lines.forEach(line => {
            // Parse nodes: A[Text] or A{Text} or A((Text))
            const nodeMatch = line.match(/(\w+)[\[\{\(]+([^\]\}\)]+)[\]\}\)]+/);
            if (nodeMatch) {
                this.parsedNodes.set(nodeMatch[1], {
                    id: nodeMatch[1],
                    text: nodeMatch[2],
                    type: this.getNodeType(line)
                });
            }
            
            // Parse edges: A --> B or A -->|label| B
            const edgeMatch = line.match(/(\w+)\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)/);
            if (edgeMatch) {
                this.parsedEdges.push({
                    from: edgeMatch[1],
                    to: edgeMatch[3],
                    label: edgeMatch[2] || ''
                });
            }
        });
    }

    getNodeType(line) {
        if (line.includes('[') && line.includes(']')) return 'rect';
        if (line.includes('{') && line.includes('}')) return 'diamond';
        if (line.includes('((') && line.includes('))')) return 'circle';
        if (line.includes('(') && line.includes(')')) return 'round';
        return 'rect';
    }

    updateCodeWithNodeChange(node, changeType, newValue) {
        // Update the Mermaid code when a node is modified
        const nodeId = this.getNodeIdFromDOM(node);
        if (!nodeId) return;
        
        let code = document.getElementById('mermaidCode').value;
        const lines = code.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(nodeId + '[') || 
                lines[i].includes(nodeId + '{') || 
                lines[i].includes(nodeId + '((')) {
                
                if (changeType === 'text') {
                    // Replace the text content
                    lines[i] = lines[i].replace(/(\w+[\[\{\(]+)[^\]\}\)]+/, `$1${newValue}`);
                }
                break;
            }
        }
        
        const newCode = lines.join('\n');
        document.getElementById('mermaidCode').value = newCode;
    }

    getNodeIdFromDOM(node) {
        // Extract node ID from DOM - this is a simplified approach
        // In a real implementation, you'd maintain a mapping between DOM nodes and IDs
        const text = this.getNodeText(node);
        for (let [id, nodeData] of this.parsedNodes) {
            if (nodeData.text === text) {
                return id;
            }
        }
        return null;
    }

    resetView() {
        this.clearSelection();
        if (this.isConnectMode) {
            this.toggleConnectMode();
        }
        
        // Reset any transforms
        const nodes = document.querySelectorAll('.node');
        nodes.forEach(node => {
            node.style.transform = '';
            node.style.outline = '';
        });
        
        this.updatePreview();
    }

    // FIXED DOWNLOAD FUNCTIONALITY
    downloadFlowchart() {
        const svgElement = document.querySelector('#mermaidDiagram svg');
        if (!svgElement) {
            alert('No diagram to download. Please create a flowchart first.');
            return;
        }

        // Get format and background color from UI (fallback to defaults if elements don't exist)
        let format, bgColor;
        const formatSelect = document.getElementById('formatSelect');
        const bgColorSelect = document.getElementById('bgColorSelect');
        
        format = formatSelect ? formatSelect.value : 'png';
        bgColor = bgColorSelect ? bgColorSelect.value : '#ffffff';

        try {
            this.downloadMermaidDiagram(format, bgColor);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        }
    }

    downloadMermaidDiagram(format, bgColor) {
        const svgElement = document.querySelector('#mermaidDiagram svg');
        if (!svgElement) {
            alert('No diagram found to download.');
            return;
        }
        
        // Clone SVG and clean it up
        const svgClone = svgElement.cloneNode(true);
        
        // Remove interactive elements and selection indicators
        svgClone.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
        svgClone.querySelectorAll('[style*="outline"]').forEach(el => {
            el.style.outline = '';
        });
        
        // Get SVG dimensions - safer approach
        let width, height;
        try {
            const rect = svgElement.getBoundingClientRect();
            width = rect.width || 800;
            height = rect.height || 600;
        } catch (error) {
            // Fallback dimensions if getBoundingClientRect fails
            width = svgElement.getAttribute('width') || svgElement.clientWidth || 800;
            height = svgElement.getAttribute('height') || svgElement.clientHeight || 600;
        }
        
        // Ensure dimensions are numbers
        width = parseFloat(width) || 800;
        height = parseFloat(height) || 600;
        
        // Set proper SVG attributes for conversion
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        
        // Try to set viewBox if possible
        try {
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                svgClone.setAttribute('viewBox', viewBox);
            } else {
                svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
        } catch (error) {
            svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        
        // For direct SVG download
        if (format === 'svg') {
            this.downloadSVG(svgClone);
            return;
        }
        
        // Convert to other formats
        this.convertSVGToImage(svgClone, format, bgColor, width, height);
    }

    downloadSVG(svgElement) {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'flowchart.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    convertSVGToImage(svgElement, format, bgColor, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size with device pixel ratio for better quality
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(pixelRatio, pixelRatio);
        
        // Set background
        if (bgColor && bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Convert SVG to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        
        // Create blob and object URL
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        // Create image and draw to canvas
        const img = new Image();
        img.onload = () => {
            try {
                ctx.drawImage(img, 0, 0, width, height);
                
                if (format === 'pdf') {
                    this.downloadAsPDF(canvas, width, height);
                } else {
                    this.downloadAsImage(canvas, format);
                }
            } catch (error) {
                console.error('Error drawing image to canvas:', error);
                alert('Failed to convert diagram. Trying alternative method...');
                // Fallback: try without canvas scaling
                this.fallbackDownload(svgString, format);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        
        img.onerror = (error) => {
            console.error('Error loading SVG image:', error);
            URL.revokeObjectURL(url);
            alert('Failed to load diagram for conversion. Downloading as SVG instead.');
            this.downloadSVG(svgElement);
        };
        
        img.src = url;
    }

    fallbackDownload(svgString, format) {
        // Fallback method for when canvas conversion fails
        if (format === 'svg') {
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'flowchart.svg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } else {
            alert(`Unable to convert to ${format}. Please try downloading as SVG.`);
        }
    }

    downloadAsImage(canvas, format) {
        try {
            const quality = format === 'jpeg' ? 0.9 : 1.0;
            const dataURL = canvas.toDataURL(`image/${format}`, quality);
            
            const link = document.createElement('a');
            link.download = `flowchart.${format}`;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image. Please try a different format.');
        }
    }

    downloadAsPDF(canvas, width, height) {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            alert('PDF library not loaded. Please include jsPDF library to enable PDF download.');
            return;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const orientation = width > height ? 'landscape' : 'portrait';
            
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [width, height]
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save('flowchart.pdf');
        } catch (error) {
            console.error('Error creating PDF:', error);
            alert('Failed to create PDF. Please try downloading as PNG instead.');
        }
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Export functionality for external code updates
    updateFromExternalCode(code) {
        document.getElementById('mermaidCode').value = code;
        this.updatePreview();
    }

    getCurrentCode() {
        return document.getElementById('mermaidCode').value;
    }

    // Save/Load functionality (using browser storage)
    saveToStorage(name) {
        const data = {
            code: this.getCurrentCode(),
            timestamp: new Date().toISOString()
        };
        try {
            localStorage.setItem(`flowchart_${name}`, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to storage:', error);
            return false;
        }
    }

    loadFromStorage(name) {
        try {
            const data = localStorage.getItem(`flowchart_${name}`);
            if (data) {
                const parsed = JSON.parse(data);
                this.updateFromExternalCode(parsed.code);
                return true;
            }
        } catch (error) {
            console.error('Failed to load from storage:', error);
        }
        return false;
    }

    getSavedFlowcharts() {
        const saved = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('flowchart_')) {
                    const name = key.replace('flowchart_', '');
                    const data = JSON.parse(localStorage.getItem(key));
                    saved.push({
                        name: name,
                        timestamp: data.timestamp
                    });
                }
            }
            return saved.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Failed to get saved flowcharts:', error);
            return [];
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.flowchartApp = new InteractiveFlowchart();
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InteractiveFlowchart;
}
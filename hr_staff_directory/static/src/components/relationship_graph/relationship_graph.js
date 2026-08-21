/** @odoo-module **/

import { Component, useState, useRef, onMounted, onWillUnmount, onPatched } from "@odoo/owl";
import { loadJS } from "@web/core/assets";

export class StaffDirectoryRelationshipGraph extends Component {
    static template = "hr_staff_directory.RelationshipGraph";
    static props = {
        people: { type: Array },
        openProfile: { type: Function },
        deptKey: { type: Function }
    };

    setup() {
        this.state = useState({
            modes: { reporting: true, peer: true },
            searchQuery: '',
            sidebarSearchQuery: '',
            maxConnections: 0,
            mostConnectedNodes: [],
            bridgeNodes: [],
            isolatedNodes: [],
            insightsExpanded: {
                mostConnected: false,
                bridge: false,
                isolated: false
            },
            loading: true,
            focusedNodeId: null,
            focusedNodeData: null
        });
        
        this.connectedNodeIds = new Set();
        this.cachedLinks = [];

        this.svgRef = useRef("graphSvg");
        this.d3Loaded = false;
        this.simulation = null;
        this._resizeObs = null;

        onMounted(async () => {
            try {
                // Ensure D3 is loaded
                if (!window.d3) {
                    await loadJS("https://d3js.org/d3.v7.min.js");
                }
                this.d3Loaded = true;
                this.state.loading = false;
                this.renderGraph();
                
                const svgEl = this.svgRef.el;
                if (svgEl && svgEl.parentElement) {
                    this._resizeObs = new ResizeObserver(() => {
                        if (!this.d3Loaded || !window.d3 || !this.simulation) return;
                        
                        this.canvasWidth = svgEl.parentElement.clientWidth;
                        this.canvasHeight = svgEl.parentElement.clientHeight;
                        
                        if (this.canvasWidth > 0 && this.canvasHeight > 0) {
                            window.d3.select(svgEl).attr("width", this.canvasWidth).attr("height", this.canvasHeight);
                        }
                    });
                    this._resizeObs.observe(svgEl.parentElement);
                }
            } catch (e) {
                console.error("Failed to load D3 for relationship graph", e);
            }
        });

        onWillUnmount(() => {
            if (this.simulation) {
                this.simulation.stop();
            }
            if (this._resizeObs) {
                this._resizeObs.disconnect();
            }
        });

        let lastHash = this.props.people.map(p => p.id).join(',');
        onPatched(() => {
            const currentHash = this.props.people.map(p => p.id).join(',');
            if (currentHash !== lastHash) {
                lastHash = currentHash;
                if (this.d3Loaded && window.d3) {
                    this.renderGraph(this.props.people);
                }
            }
        });
    }

    // Colors mimicking the requested styling
    getColor(deptName) {
        const key = this.props.deptKey(deptName) || 'default';
        const colors = {
            'design': '#EC4899',       // Pink
            'finance': '#F59E0B',      // Amber/Orange
            'engineering': '#8B5CF6',  // Purple
            'hr': '#F43F5E',           // Rose/Red
            'marketing': '#3B82F6',    // Blue
            'sales': '#10B981',        // Emerald/Green
            'operations': '#6366F1',   // Indigo
            'product': '#06B6D4',      // Cyan
            'default': '#9CA3AF'       // Gray
        };
        return colors[key] || colors['default'];
    }

    getContrastingColor(hexColor) {
        const mapping = {
            '#EC4899': '#F59E0B',
            '#F59E0B': '#8B5CF6',
            '#8B5CF6': '#F59E0B',
            '#F43F5E': '#10B981',
            '#3B82F6': '#F59E0B',
            '#10B981': '#F43F5E',
            '#6366F1': '#EC4899',
            '#06B6D4': '#F43F5E',
            '#9CA3AF': '#8B5CF6' 
        };
        return mapping[hexColor] || '#F59E0B';
    }

    toggleMode(mode) {
        this.state.modes[mode] = !this.state.modes[mode];
        if (this.state.focusedNodeId) {
            this.recalculateConnections(this.state.focusedNodeId);
        }
        this.highlightNodes();
    }

    toggleInsight(section) {
        this.state.insightsExpanded[section] = !this.state.insightsExpanded[section];
    }

    onSearch(ev) {
        this.state.searchQuery = ev.target.value;
        const q = this.state.searchQuery.toLowerCase().trim();
        
        if (!q) {
            this.clearFocus();
            return;
        }

        const nodes = this.simulation ? this.simulation.nodes() : [];
        const match = nodes.find(n => (n.name || '').toLowerCase().includes(q));

        if (match) {
            this.focusNode(match);
        } else {
            this.state.focusedNodeId = null;
            this.state.focusedNodeData = null;
            this.connectedNodeIds.clear();
            this.highlightNodes();
        }
    }

    clearSearch() {
        this.state.searchQuery = '';
        this.clearFocus();
    }

    onSidebarSearch(ev) {
        this.state.sidebarSearchQuery = ev.target.value;
        // Expand all sections if there's a search query
        if (this.state.sidebarSearchQuery.trim()) {
            this.state.insightsExpanded.mostConnected = true;
            this.state.insightsExpanded.bridge = true;
            this.state.insightsExpanded.isolated = true;
        }
    }

    clearSidebarSearch() {
        this.state.sidebarSearchQuery = '';
    }

    getFilteredNodes(nodes) {
        const q = this.state.sidebarSearchQuery.toLowerCase().trim();
        if (!q) return nodes;
        return nodes.filter(n => (n.name || '').toLowerCase().includes(q));
    }

    handleNodeClick(event, d) {
        if (event) event.stopPropagation();
        
        if (this.state.focusedNodeId === d.id) {
            // Deselect if already focused
            this.clearFocus();
            return;
        }

        this.focusNode(d);
    }

    focusNode(d) {
        this.state.focusedNodeId = d.id;
        this.state.focusedNodeData = d;
        this.recalculateConnections(d.id);
        this.highlightNodes();
    }

    recalculateConnections(nodeId) {
        this.connectedNodeIds.clear();
        this.connectedNodeIds.add(nodeId);

        let hasReporting = false;
        let hasPeer = false;

        // Find all connected nodes based on active links
        this.cachedLinks.forEach(link => {
            if (this.state.modes[link.type]) {
                if (link.source.id === nodeId || link.target.id === nodeId) {
                    this.connectedNodeIds.add(link.source.id === nodeId ? link.target.id : link.source.id);
                    if (link.type === 'reporting') hasReporting = true;
                    if (link.type === 'peer') hasPeer = true;
                }
            }
        });
        
        if (this.state.focusedNodeData && this.state.focusedNodeData.id === nodeId) {
            this.state.focusedNodeData.hasReporting = hasReporting;
            this.state.focusedNodeData.hasPeer = hasPeer;
        }
    }

    clearFocus() {
        this.state.focusedNodeId = null;
        this.state.focusedNodeData = null;
        this.connectedNodeIds.clear();
        this.highlightNodes();
    }

    highlightNodes() {
        if (!this.d3Loaded || !window.d3) return;
        const q = this.state.searchQuery.toLowerCase().trim();
        const svg = window.d3.select(this.svgRef.el);
        const focusedId = this.state.focusedNodeId;
        
        if (!q && !focusedId) {
            svg.selectAll(".r_graph-node-group").style("opacity", 1);
            svg.selectAll(".r_graph-link")
                .style("display", d => this.state.modes[d.type] ? "block" : "none")
                .style("opacity", 0.6)
                .style("stroke-width", 1)
                .style("stroke", "#d1d5db");
            svg.selectAll(".r_graph-node-selection").style("opacity", 0);
            return;
        }

        svg.selectAll(".r_graph-node-group").style("opacity", d => {
            if (focusedId) {
                return this.connectedNodeIds.has(d.id) ? 1 : 0.15;
            }
            
            if (q) {
                const name = (d.name || '').toLowerCase();
                return name.includes(q) ? 1 : 0.15;
            }
            
            return 1;
        });
        
        svg.selectAll(".r_graph-link")
            .style("display", d => this.state.modes[d.type] ? "block" : "none")
            .style("opacity", d => {
                if (focusedId) {
                    return (d.source.id === focusedId || d.target.id === focusedId) ? 1 : 0;
                }
                return 0.1; // If there's a search query but no focus, dim all links
            })
            .style("stroke-width", d => {
                if (focusedId && (d.source.id === focusedId || d.target.id === focusedId)) {
                    return 2.5; // Thicker lines for focused node
                }
                return 1; // Default thickness
            })
            .style("stroke", d => {
                if (focusedId && (d.source.id === focusedId || d.target.id === focusedId)) {
                    return "#374151"; // Dark slate/gray for focused lines
                }
                return "#d1d5db"; // Default light gray
            });

        // Toggle selection ring
        svg.selectAll(".r_graph-node-selection").style("opacity", d => {
            return (focusedId && d.id === focusedId) ? 1 : 0;
        });
    }

    buildGraphData(peopleData = this.props.people) {
        const nodes = [];
        const links = [];
        const idMap = new Map();

        // 1. Create nodes
        peopleData.forEach(p => {
            const node = {
                id: p.id,
                name: p.name,
                job_title: p.job_title || 'Employee',
                dept: p.department,
                location: p.work_location || 'Remote / Unassigned',
                color: this.getColor(p.department),
                radius: 15, // Base radius
                connections: 0,
                manager_id: p.manager_id || null,
                is_manager: false
            };
            nodes.push(node);
            idMap.set(p.id, node);
        });

        // 2. Create edges (always create both types so physics layout remains stable when toggling visibility)
        nodes.forEach(n => {
            if (n.manager_id && idMap.has(n.manager_id)) {
                links.push({ source: n.id, target: n.manager_id, type: 'reporting' });
                n.connections++;
                idMap.get(n.manager_id).connections++;
                idMap.get(n.manager_id).is_manager = true;
            }
        });
        
        // Peers: share the same manager. Create a chain instead of a full clique (O(N) instead of O(N^2))
        const mgrGroups = {};
        nodes.forEach(n => {
            const mid = n.manager_id || 'no_manager';
            if (!mgrGroups[mid]) mgrGroups[mid] = [];
            mgrGroups[mid].push(n.id);
        });
        Object.values(mgrGroups).forEach(group => {
            // Connect peers in a simple line/chain to keep them clustered without freezing the browser
            for (let i = 0; i < group.length - 1; i++) {
                links.push({ source: group[i], target: group[i+1], type: 'peer' });
                idMap.get(group[i]).connections++;
                idMap.get(group[i+1]).connections++;
            }
        });

        // 3. Size computation and Graph Insights
        let maxCon = 0;
        let isolatedNodes = [];
        let bridgeNodes = [];

        nodes.forEach(n => {
            // Size mapping based on connections
            if (n.connections === 0) {
                n.radius = 12;
            } else if (n.connections === 1) {
                n.radius = 15;
            } else if (n.connections <= 3) {
                n.radius = 20;
            } else if (n.connections <= 6) {
                n.radius = 26;
            } else {
                n.radius = 32;
            }
            if (n.connections > maxCon) {
                maxCon = n.connections;
            }
            
            if (n.connections <= 1) {
                isolatedNodes.push(n);
                n.ringColor = this.getContrastingColor(n.color);
            }
            if (n.connections > 6) {
                bridgeNodes.push(n);
            }
        });

        const sortedByCon = [...nodes].sort((a, b) => b.connections - a.connections);
        this.state.mostConnectedNodes = sortedByCon.slice(0, 5);
        this.state.bridgeNodes = bridgeNodes.sort((a, b) => b.connections - a.connections);
        this.state.isolatedNodes = isolatedNodes.sort((a, b) => a.connections - b.connections);
        this.state.maxConnections = maxCon;

        return { nodes, links };
    }

    renderGraph(peopleData = this.props.people) {
        if (!this.d3Loaded || !window.d3 || !this.svgRef.el) return;

        const container = this.svgRef.el.parentElement;
        if (!container) return;
        
        this.canvasWidth = container.clientWidth;
        this.canvasHeight = container.clientHeight;
        
        if (this.canvasWidth === 0 || this.canvasHeight === 0) return;

        const data = this.buildGraphData(peopleData);
        const d3 = window.d3;

        const svg = d3.select(this.svgRef.el);
        svg.selectAll("*").remove(); // Clear previous render
        svg.attr("width", this.canvasWidth).attr("height", this.canvasHeight);

        // Cache links for fast neighbor lookup
        this.cachedLinks = data.links;

        // Add a master group for the graph elements
        const g = svg.append("g");
        
        // Background rect to catch clicks for clearing focus
        g.append("rect")
            .attr("width", this.canvasWidth)
            .attr("height", this.canvasHeight)
            .attr("fill", "transparent")
            .on("click", () => this.clearFocus());

        if (this.simulation) {
            this.simulation.stop();
        }

        // Setup physics simulation
        this.simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(120))
            .force("charge", d3.forceManyBody().strength(-600)) // Stronger repulsion to spread nodes out
            .force("center", d3.forceCenter(this.canvasWidth / 2, this.canvasHeight / 2).strength(0.02)) // Very weak center gravity
            .force("collide", d3.forceCollide().radius(d => d.radius + 2).iterations(3));

        // Draw Links
        const link = g.append("g")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", d => d.type === 'reporting' ? "r_graph-link" : "r_graph-link r_graph-link-dashed");

        // Draw Nodes
        const nodeGroup = g.append("g")
            .selectAll(".r_graph-node-group")
            .data(data.nodes)
            .enter().append("g")
            .attr("class", "r_graph-node-group")
            .on("click", (event, d) => this.handleNodeClick(event, d))
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Selection Ring (outermost pink ring)
        nodeGroup.append("circle")
            .attr("class", "r_graph-node-selection")
            .attr("r", d => d.radius + 12)
            .attr("fill", "none")
            .attr("stroke", "#E8368F") // Pink/magenta
            .attr("stroke-width", 3)
            .attr("opacity", 0)
            .style("transition", "opacity 0.2s");

        // Halo Ring (outer stroke)
        nodeGroup.append("circle")
            .attr("class", "r_graph-node-halo")
            .attr("r", d => d.radius + 6)
            .attr("fill", "none")
            .attr("stroke", d => d.color)
            .attr("stroke-width", 3)
            .attr("stroke-opacity", 0.3);

        // Node Circle (inner filled)
        nodeGroup.append("circle")
            .attr("class", "r_graph-node")
            .attr("r", d => d.radius)
            .attr("fill", d => d.color);

        // Node Initials Text
        nodeGroup.append("text")
            .attr("class", "r_graph-node-initials")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .text(d => {
                const parts = d.name.split(' ');
                return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
            });

        // Node Name Label
        nodeGroup.append("text")
            .attr("class", "r_graph-node-label")
            .attr("text-anchor", "middle")
            .attr("dy", d => d.radius + 24)
            .text(d => d.name.split(' ')[0]); // First name

        // Tick function to update positions
        const updatePositions = () => {
            // Keep nodes within bounds gracefully, adding padding for rings and labels
            data.nodes.forEach(d => {
                const paddingX = d.radius + 30; // accounts for halo and selection
                const paddingYTop = d.radius + 30;
                const paddingYBottom = d.radius + 60; // Extra room for the text label and rings
                d.x = Math.max(paddingX, Math.min(this.canvasWidth - paddingX, d.x));
                d.y = Math.max(paddingYTop, Math.min(this.canvasHeight - paddingYBottom, d.y));
            });

            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            nodeGroup
                .attr("transform", d => `translate(${d.x},${d.y})`);
        };

        this.simulation.on("tick", updatePositions);

        // Drag functions
        function dragstarted(event, d) {
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
            d.x = event.x;
            d.y = event.y;
            updatePositions();
        }

        function dragended(event, d) {
            // Leave the node fixed where it was dropped
            d.fx = event.x;
            d.fy = event.y;
        }

        // Apply any active search highlights
        this.highlightNodes();
    }
}

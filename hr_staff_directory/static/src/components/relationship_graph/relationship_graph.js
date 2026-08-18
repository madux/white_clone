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
            modes: { reporting: true, peer: false },
            searchQuery: '',
            mostConnected: 0,
            bridgeEmployees: 0,
            isolated: 0,
            loading: true
        });

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
                        this.renderGraph();
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

        onPatched(() => {
            // Re-render when properties or active mode change, but we have to manage the D3 lifecycle carefully
            // Actually, we should probably manually call renderGraph when props.people changes or mode changes.
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

    toggleMode(mode) {
        this.state.modes[mode] = !this.state.modes[mode];
        this.renderGraph();
    }

    onSearch(ev) {
        this.state.searchQuery = ev.target.value;
        this.highlightNodes();
    }

    clearSearch() {
        this.state.searchQuery = '';
        this.highlightNodes();
    }

    highlightNodes() {
        if (!this.d3Loaded || !window.d3) return;
        const q = this.state.searchQuery.toLowerCase().trim();
        const svg = window.d3.select(this.svgRef.el);
        
        if (!q) {
            svg.selectAll(".r_graph-node-group").style("opacity", 1);
            svg.selectAll(".r_graph-link").style("opacity", 0.6);
            return;
        }

        svg.selectAll(".r_graph-node-group").style("opacity", d => {
            const name = (d.name || '').toLowerCase();
            return name.includes(q) ? 1 : 0.2;
        });
        
        svg.selectAll(".r_graph-link").style("opacity", 0.1);
    }

    buildGraphData() {
        const nodes = [];
        const links = [];
        const idMap = new Map();

        // 1. Create nodes
        this.props.people.forEach(p => {
            const node = {
                id: p.id,
                name: p.name,
                dept: p.department,
                color: this.getColor(p.department),
                radius: 15, // Base radius
                connections: 0,
                manager_id: p.manager_id || null,
                is_manager: false
            };
            nodes.push(node);
            idMap.set(p.id, node);
        });

        // 2. Create edges based on active modes
        if (this.state.modes.reporting) {
            nodes.forEach(n => {
                if (n.manager_id && idMap.has(n.manager_id)) {
                    links.push({ source: n.id, target: n.manager_id, type: 'reporting' });
                    n.connections++;
                    idMap.get(n.manager_id).connections++;
                    idMap.get(n.manager_id).is_manager = true;
                }
            });
        }
        
        if (this.state.modes.peer) {
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
        }

        // 3. Size computation and Graph Insights
        let maxCon = 0;
        let isolatedCount = 0;
        let bridgeCount = 0; // Simple approximation: high connections across departments

        nodes.forEach(n => {
            // Size mapping based on connections
            if (n.connections === 0) {
                n.radius = 12;
                isolatedCount++;
            } else if (n.connections === 1) {
                n.radius = 15;
            } else if (n.connections <= 3) {
                n.radius = 20;
            } else if (n.connections <= 6) {
                n.radius = 26;
            } else {
                n.radius = 32;
                bridgeCount++;
            }
            if (n.connections > maxCon) {
                maxCon = n.connections;
            }
        });

        this.state.mostConnected = maxCon;
        this.state.isolated = isolatedCount;
        this.state.bridgeEmployees = bridgeCount;

        return { nodes, links };
    }

    renderGraph() {
        if (!this.d3Loaded || !window.d3 || !this.svgRef.el) return;

        const container = this.svgRef.el.parentElement;
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        if (width === 0 || height === 0) return;

        const data = this.buildGraphData();
        const d3 = window.d3;

        const svg = d3.select(this.svgRef.el);
        svg.selectAll("*").remove(); // Clear previous render
        svg.attr("width", width).attr("height", height);

        // Add a master group for the graph elements
        const g = svg.append("g");

        if (this.simulation) {
            this.simulation.stop();
        }

        // Setup physics simulation
        this.simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-300)) // Stronger repulsion to push isolated nodes to walls
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05)) // Weak center force so repulsion wins
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
            .on("click", (event, d) => this.props.openProfile(d))
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

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
            .attr("dy", d => d.radius + 12)
            .text(d => d.name.split(' ')[0]); // First name

        // Tick function to update positions
        const updatePositions = () => {
            // Keep nodes within bounds gracefully
            data.nodes.forEach(d => {
                // If a node is fixed by drag (fx), x is already fx, but let's bound it too if needed
                d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
                d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
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

/** @odoo-module **/

import { Component, useState, useRef, onWillUpdateProps } from "@odoo/owl";

export class StaffDirectoryOrgChart extends Component {
    static template = "hr_staff_directory.OrgChart";
    static props = {
        people: { type: Array },
        openProfile: { type: Function }
    };

    setup() {
        this.state = useState({
            orgZoom: 1,
            orgCollapsedNodes: {},
            orgActiveNodeId: null,
            orgSearchQuery: "",
            isDraggingOrg: false,
            isDraggingPopup: false,
            orgSidebarOpen: false,
            isOrgChangesPanelOpen: false
        });
        
        // Non-reactive variables for smooth dragging without triggering re-renders
        this.orgPanX = 0;
        this.orgPanY = 0;
        this.orgPopupOffsetX = 0;
        this.orgPopupOffsetY = 0;

        // References to DOM elements
        this.orgCanvasRef = useRef("orgCanvas");
        this.orgPopupRef = useRef("orgPopup");
        
        // Private variables for drag calculations
        this._lastMouseX = 0;
        this._lastMouseY = 0;

        this.initializeCollapsedState(this.props.people);

        onWillUpdateProps((nextProps) => {
            if (this.props.people !== nextProps.people) {
                // When people change (filters applied), re-initialize collapsed states 
                // for any newly discovered roots/nodes.
                this.initializeCollapsedState(nextProps.people);
            }
        });
    }

    initializeCollapsedState(peopleList) {
        const rootNodes = this.getOrgRootNodes(peopleList);
        
        const setDepths = (personId, currentDepth) => {
            const children = this.getOrgChildren(personId, peopleList);
            
            // Depth 1 (CEO) and Depth 2 (Immediate lower hierarchy) are uncollapsed.
            // Depth 3 and beyond are collapsed by default.
            if (currentDepth > 2) {
                this.state.orgCollapsedNodes[personId] = true;
            } else {
                this.state.orgCollapsedNodes[personId] = false;
            }
            
            children.forEach(child => setDepths(child.id, currentDepth + 1));
        };
        
        rootNodes.forEach(root => setDepths(root.id, 1));
    }

    // ─── Org Chart Computed Properties ───────────────────────────────────

    getOrgRootNodes(peopleList) {
        if (!peopleList || peopleList.length === 0) return [];
        const peopleIds = new Set(peopleList.map(p => p.id));
        let roots = peopleList.filter(p => !p.manager_id || !peopleIds.has(p.manager_id));
        
        if (roots.length > 1) {
            const ceo = roots.find(p => p.job_title && p.job_title.toLowerCase().includes('chief executive'));
            if (ceo) return [ceo];
            roots.sort((a, b) => this.getOrgDirectReportsCount(b.id, peopleList) - this.getOrgDirectReportsCount(a.id, peopleList));
        }
        return roots;
    }

    get orgRootNodes() {
        return this.getOrgRootNodes(this.props.people);
    }
    
    get orgSearchMatches() {
        const query = (this.state.orgSearchQuery || "").trim().toLowerCase();
        if (!query) return null; // null means no active search
        
        const matches = new Set();
        this.props.people.forEach(p => {
            const name = (p.name || "").toLowerCase();
            const role = (p.job_title || "").toLowerCase();
            const dept = (p.department || "").toLowerCase();
            if (name.includes(query) || role.includes(query) || dept.includes(query)) {
                matches.add(p.id);
            }
        });
        return matches;
    }

    getOrgChildren(personId, peopleList = this.props.people) {
        return peopleList.filter(p => p.manager_id === personId);
    }

    getOrgDirectReportsCount(personId, peopleList = this.props.people) {
        return peopleList.filter(p => p.manager_id === personId).length;
    }

    getRoleCode(role) {
        if (!role) return 'EMP';
        const skipWords = ['of', 'and', 'the', 'for', '&'];
        const words = role.split(/[\s-]+/).filter(w => w && !skipWords.includes(w.toLowerCase()));
        return words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
    }

    // ─── Event Handlers ──────────────────────────────────────────────────────

    onOrgSearchInput(ev) {
        this.state.orgSearchQuery = ev.target.value;
        const matches = this.orgSearchMatches;
        
        if (matches && matches.size > 0) {
            // Auto-uncollapse tree to reveal matched nodes
            let currentNodes = Array.from(matches)
                                    .map(id => this.props.people.find(p => p.id === id))
                                    .filter(Boolean);
            
            while (currentNodes.length > 0) {
                let parentIds = new Set();
                currentNodes.forEach(node => {
                    if (node.manager_id) {
                        this.state.orgCollapsedNodes[node.manager_id] = false;
                        parentIds.add(node.manager_id);
                    }
                });
                
                // Get the parent nodes for the next iteration
                currentNodes = Array.from(parentIds)
                                    .map(id => this.props.people.find(p => p.id === id))
                                    .filter(Boolean);
            }
            
            // Wait for DOM to update and user to pause typing, then pan to the matches
            if (this._searchPanTimeout) clearTimeout(this._searchPanTimeout);
            this._searchPanTimeout = setTimeout(() => this.panToSearchMatches(), 300);
        }
    }

    clearOrgSearch() {
        this.state.orgSearchQuery = "";
    }

    toggleOrgChangesPanel() {
        this.state.isOrgChangesPanelOpen = !this.state.isOrgChangesPanelOpen;
    }

    panToSearchMatches() {
        const matches = this.orgSearchMatches;
        if (!matches || matches.size === 0) return;
        if (!this.orgCanvasRef || !this.orgCanvasRef.el) return;
        
        const matchedNodes = [];
        const allCards = this.orgCanvasRef.el.querySelectorAll('.org-chart-node-card');
        
        allCards.forEach(card => {
            const personId = parseInt(card.dataset.personId, 10);
            if (matches.has(personId)) {
                matchedNodes.push(card);
            }
        });
        
        if (matchedNodes.length === 0) return;
        
        // Find the highest-ranking (topmost) matching nodes
        let minTop = Infinity;
        const rects = [];
        matchedNodes.forEach(node => {
            const rect = node.getBoundingClientRect();
            rects.push(rect);
            if (rect.top < minTop) {
                minTop = rect.top;
            }
        });

        // Filter to only the nodes at the very top level of the matches
        const topRects = rects.filter(r => Math.abs(r.top - minTop) < 20);
        
        // Instead of finding the bounding box of potentially many nodes (which might already be centered),
        // we perfectly center on the very first topmost matching node.
        const targetRect = topRects[0];
        const centerX = targetRect.left + (targetRect.width / 2);
        const centerY = targetRect.top + (targetRect.height / 2);
        
        let viewportRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        if (this.orgCanvasRef.el.parentElement) {
            viewportRect = this.orgCanvasRef.el.parentElement.getBoundingClientRect();
        }
        
        const viewportCenterX = viewportRect.left + (viewportRect.width / 2);
        const viewportCenterY = viewportRect.top + (viewportRect.height / 2);
        
        const dx = viewportCenterX - centerX;
        const dy = viewportCenterY - centerY;
        
        this.orgPanX += dx;
        this.orgPanY += dy;
        
        this.orgCanvasRef.el.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
        this.orgCanvasRef.el.style.transform = `translateX(-50%) translate(${this.orgPanX}px, ${this.orgPanY}px) scale(${this.state.orgZoom})`;
        
        setTimeout(() => {
            if (this.orgCanvasRef && this.orgCanvasRef.el) {
                this.orgCanvasRef.el.style.transition = 'none';
            }
        }, 400);
    }

    // ─── Org Chart Actions ─────────────────────────────────────────────

    onOrgCanvasWheel(ev) {
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -0.1 : 0.1;
        let newZoom = this.state.orgZoom + delta;
        if (newZoom < 0.2) newZoom = 0.2;
        if (newZoom > 3) newZoom = 3;
        this.state.orgZoom = newZoom;
    }

    onOrgCanvasMouseDown(ev) {
        if (ev.target.closest('.org-chart-node') || ev.target.closest('.org-chart-popup')) return;
        this.state.isDraggingOrg = true;
        this._lastMouseX = ev.clientX;
        this._lastMouseY = ev.clientY;
    }

    onOrgCanvasMouseMove(ev) {
        if (this.state.isDraggingOrg) {
            const dx = ev.clientX - this._lastMouseX;
            const dy = ev.clientY - this._lastMouseY;
            this.orgPanX += dx;
            this.orgPanY += dy;
            this._lastMouseX = ev.clientX;
            this._lastMouseY = ev.clientY;
            
            // Bypass Owl reactivity for smooth 60fps drag
            if (this.orgCanvasRef.el) {
                this.orgCanvasRef.el.style.transform = `translateX(-50%) translate(${this.orgPanX}px, ${this.orgPanY}px) scale(${this.state.orgZoom})`;
            }
        } else if (this.state.isDraggingPopup) {
            const dx = ev.clientX - this._lastMouseX;
            const dy = ev.clientY - this._lastMouseY;
            this.orgPopupOffsetX += dx;
            this.orgPopupOffsetY += dy;
            this._lastMouseX = ev.clientX;
            this._lastMouseY = ev.clientY;
            
            if (this.orgPopupRef.el) {
                this.orgPopupRef.el.style.transform = `translate(${this.orgPopupOffsetX}px, ${this.orgPopupOffsetY}px)`;
            }
        }
    }

    onOrgCanvasMouseUp(ev) {
        this.state.isDraggingOrg = false;
        this.state.isDraggingPopup = false;
    }

    zoomOrgIn() {
        let newZoom = this.state.orgZoom + 0.1;
        if (newZoom > 3) newZoom = 3;
        this.state.orgZoom = newZoom;
    }

    zoomOrgOut() {
        let newZoom = this.state.orgZoom - 0.1;
        if (newZoom < 0.2) newZoom = 0.2;
        this.state.orgZoom = newZoom;
    }

    resetOrgZoomPan() {
        this.state.orgZoom = 1;
        this.orgPanX = 0;
        this.orgPanY = 0;
        if (this.orgCanvasRef.el) {
            this.orgCanvasRef.el.style.transform = `translateX(-50%) translate(0px, 0px) scale(1)`;
        }
    }

    panOrgDirection(dir) {
        const step = 50;
        if (dir === 'up') this.orgPanY += step;
        if (dir === 'down') this.orgPanY -= step;
        if (dir === 'left') this.orgPanX += step;
        if (dir === 'right') this.orgPanX -= step;
        if (this.orgCanvasRef.el) {
            this.orgCanvasRef.el.style.transform = `translateX(-50%) translate(${this.orgPanX}px, ${this.orgPanY}px) scale(${this.state.orgZoom})`;
        }
    }

    toggleOrgNodeCollapse(id) {
        this.state.orgCollapsedNodes[id] = !this.state.orgCollapsedNodes[id];
    }

    toggleOrgSidebar() {
        this.state.orgSidebarOpen = !this.state.orgSidebarOpen;
    }

    openOrgNodePopup(personId, ev, centerCanvas = false) {
        if (ev) ev.stopPropagation();
        this.state.orgActiveNodeId = personId;
        
        let targetNode = null;
        if (this.orgCanvasRef && this.orgCanvasRef.el) {
            targetNode = this.orgCanvasRef.el.querySelector(`.org-chart-node-card[data-person-id="${personId}"]`);
        }
        
        if (targetNode) {
            const cardRect = targetNode.getBoundingClientRect();
            let viewportRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            
            if (this.orgCanvasRef && this.orgCanvasRef.el && this.orgCanvasRef.el.parentElement) {
                viewportRect = this.orgCanvasRef.el.parentElement.getBoundingClientRect();
            }
            
            let finalCardRect = cardRect;
            
            if (centerCanvas) {
                const viewportCenterX = viewportRect.left + (viewportRect.width / 2);
                const viewportCenterY = viewportRect.top + (viewportRect.height / 2);
                
                // Offset the X target so the card + popup combo is perfectly centered
                // Combo width: 190 (card) + 20 (gap) + 310 (popup) = 520. Half is 260.
                const targetCardLeft = viewportCenterX - 260; 
                const targetCardTop = viewportCenterY - (cardRect.height / 2);
                
                const dx = targetCardLeft - cardRect.left;
                const dy = targetCardTop - cardRect.top;
                
                this.orgPanX += dx;
                this.orgPanY += dy;
                
                if (this.orgCanvasRef.el) {
                    this.orgCanvasRef.el.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
                    this.orgCanvasRef.el.style.transform = `translateX(-50%) translate(${this.orgPanX}px, ${this.orgPanY}px) scale(${this.state.orgZoom})`;
                    setTimeout(() => {
                        if (this.orgCanvasRef && this.orgCanvasRef.el) {
                            this.orgCanvasRef.el.style.transition = 'none';
                        }
                    }, 400);
                }
                
                finalCardRect = {
                    left: targetCardLeft,
                    right: targetCardLeft + cardRect.width,
                    top: targetCardTop,
                    bottom: targetCardTop + cardRect.height,
                    width: cardRect.width,
                    height: cardRect.height
                };
            }
            
            // Pop up 20px to the right of the clicked node
            let left = (finalCardRect.right - viewportRect.left) + 20;
            let top = (finalCardRect.top - viewportRect.top);
            
            // If it spills off the right edge, pop up to the left instead
            if (left + 310 > viewportRect.width) {
                left = (finalCardRect.left - viewportRect.left) - 310 - 20;
            }
            
            // Keep within top and bottom bounds
            const approxPopupHeight = 490; // Ensure enough clearance for the ~466px popup
            const maxBottom = Math.min(viewportRect.height, window.innerHeight - viewportRect.top);
            
            // If popping down cuts off the bottom, shift it up
            if (top + approxPopupHeight > maxBottom) {
                top = maxBottom - approxPopupHeight - 20;
            }
            
            // Absolute failsafe to not cut off the top either
            if (top < 20) top = 20;
            
            this.orgPopupOffsetX = left;
            this.orgPopupOffsetY = top;
        } else {
            this.orgPopupOffsetX = 100;
            this.orgPopupOffsetY = 100;
        }
    }

    closeOrgPopup(ev) {
        if (ev) ev.stopPropagation();
        this.state.orgActiveNodeId = null;
    }


    onPopupDragStart(ev) {
        this.state.isDraggingPopup = true;
        this._lastMouseX = ev.clientX;
        this._lastMouseY = ev.clientY;
    }
}

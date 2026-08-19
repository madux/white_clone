/** @odoo-module **/

import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";

const SVG_W = 950;
const SVG_H = 620;
const LEGEND_COLORS = ['#FCE7F3', '#FBCFE8', '#F9A8D4', '#F472B6', '#EC4899'];

export class StaffDirectoryGeographicMap extends Component {
    static template = "hr_staff_directory.StaffDirectoryGeographicMap";
    
    static props = {
        people: { type: Array },
        openFilterModal: { type: Function },
        avatarColor: { type: Function },
        initials: { type: Function },
        openProfile: { type: Function },
        setOrgView: { type: Function }
    };

    setup() {
        this.state = useState({
            hoveredLocation: null,
            selectedLocation: null,
            searchQuery: ""
        });
        this.mapCanvas = useRef("mapCanvas");
        this.mapBg = useRef("mapBg");
        this.svgRect = useState({
            ready: false,
            canvasW: 0,
            canvasH: 0,
            originX: 0,
            originY: 0,
            renderedW: 0,
            renderedH: 0,
        });
        this._resizeObs = null;

        onMounted(() => {
            this._updateSvgRect();
            const el = this.mapCanvas.el;
            if (el) {
                this._resizeObs = new ResizeObserver(() => this._updateSvgRect());
                this._resizeObs.observe(el);
            }
        });

        onWillUnmount(() => {
            if (this._resizeObs) {
                this._resizeObs.disconnect();
            }
        });
    }

    _updateSvgRect() {
        const canvasEl = this.mapCanvas.el;
        if (!canvasEl) return;
        const cw = canvasEl.clientWidth;
        const ch = canvasEl.clientHeight;
        if (!cw || !ch) return;

        const bgW = cw - 40;
        const bgH = ch - 40;
        const svgAspect = SVG_W / SVG_H;
        const bgAspect = bgW / bgH;

        let renderedW, renderedH, offX, offY;
        if (bgAspect > svgAspect) {
            renderedH = bgH;
            renderedW = bgH * svgAspect;
            offX = (bgW - renderedW) / 2;
            offY = 0;
        } else {
            renderedW = bgW;
            renderedH = bgW / svgAspect;
            offX = 0;
            offY = (bgH - renderedH) / 2;
        }

        this.svgRect.ready = true;
        this.svgRect.canvasW = cw;
        this.svgRect.canvasH = ch;
        this.svgRect.originX = 20 + offX;
        this.svgRect.originY = 20 + offY;
        this.svgRect.renderedW = renderedW;
        this.svgRect.renderedH = renderedH;
    }

    get locationData() {
        const groups = {};
        for (const p of this.props.people) {
            const loc = p.work_location || 'Remote — Global';
            if (!groups[loc]) {
                groups[loc] = { count: 0, lat: p.work_location_lat || 0, lng: p.work_location_lng || 0 };
            }
            groups[loc].count++;
        }

        const sr = this.svgRect.ready ? this.svgRect : null;
        const data = Object.keys(groups).map(loc => {
            const g = groups[loc];
            let x, y;

            if (sr) {
                const svgX = (g.lng + 180) / 360 * SVG_W;
                const svgY = (90 - g.lat) / 180 * SVG_H;
                x = (sr.originX + (svgX / SVG_W) * sr.renderedW) / sr.canvasW * 100;
                y = (sr.originY + (svgY / SVG_H) * sr.renderedH) / sr.canvasH * 100;
            } else {
                x = (g.lng + 180) / 360 * 100;
                y = (90 - g.lat) / 180 * 100;
            }

            if (g.lat === 0 && g.lng === 0) {
                x = 5; y = 80;
            }

            let size = 20;
            if (g.count > 30) size = 60;
            else if (g.count > 20) size = 50;
            else if (g.count > 10) size = 40;
            else if (g.count > 1) size = 30;

            let colorIdx;
            if (g.count <= 1) colorIdx = 0;
            else if (g.count <= 5) colorIdx = 1;
            else if (g.count <= 15) colorIdx = 2;
            else if (g.count <= 30) colorIdx = 3;
            else colorIdx = 4;
            
            const unmapped = g.lat === 0 && g.lng === 0;
            
            return {
                name: loc,
                count: g.count,
                x: x,
                y: y,
                size: size,
                color: unmapped ? '#9ca3af' : LEGEND_COLORS[colorIdx],
                unmapped: unmapped,
            };
        });

        data.sort((a, b) => b.count - a.count);
        return data;
    }

    getHoveredLocationData() {
        if (!this.state.hoveredLocation) return null;
        return this.locationData.find(l => l.name === this.state.hoveredLocation);
    }

    get selectedPeople() {
        if (!this.state.selectedLocation) return [];
        return this.props.people.filter(p => {
            const loc = p.work_location || 'Remote — Global';
            return loc === this.state.selectedLocation;
        });
    }

    get filteredPeople() {
        const people = this.selectedPeople;
        if (!this.state.searchQuery) return people;
        const query = this.state.searchQuery.toLowerCase();
        return people.filter(p => p.name && p.name.toLowerCase().includes(query));
    }

    onSearchInput(ev) {
        this.state.searchQuery = ev.target.value;
    }

    clearSearch() {
        this.state.searchQuery = "";
    }


    get tooltipPositionClass() {
        const hoverLoc = this.getHoveredLocationData();
        if (!hoverLoc) return '';
        let cls = '';
        if (hoverLoc.y < 35) {
            cls += ' sdir-map-tt-down';
        } else {
            cls += ' sdir-map-tt-up';
        }
        if (hoverLoc.x < 25) {
            cls += ' sdir-map-tt-shift-right';
        } else if (hoverLoc.x > 75) {
            cls += ' sdir-map-tt-shift-left';
        }
        return cls;
    }

    hoverLocation(locName) {
        if (!this.state.selectedLocation) {
            this.state.hoveredLocation = locName;
        }
    }

    selectLocation(locName) {
        this.state.hoveredLocation = null;
        this.state.selectedLocation = locName;
    }

    clearSelection() {
        this.state.selectedLocation = null;
    }
    
    openProfile(person) {
        this.props.openProfile(person);
    }
}

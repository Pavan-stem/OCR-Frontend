import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mapCalibration from '../data/map_calibration.json';
import mandalCalibration from '../data/mandal_calibration.json';
import { MapPin, Home, Info, RefreshCw, Filter, Search, RotateCcw, RotateCw, Trash2, Copy, Check, Download, Eraser, MousePointer2, Target } from 'lucide-react';
import { API_BASE } from '../utils/apiConfig';

const InteractiveAPMap = ({ summary = {}, filters = {}, onDistrictSelect, onMandalSelect }) => {
    const [svgContent, setSvgContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(filters.district || null);
    const [hoveredDistrict, setHoveredDistrict] = useState(null);
    const [viewBox, setViewBox] = useState("0 0 3509 2482");
    const [editMode, setEditMode] = useState(false);
    const [editSelectedDistrict, setEditSelectedDistrict] = useState(null);
    const [toolMode, setToolMode] = useState('assign'); // 'assign' or 'ignore'
    const [isPainting, setIsPainting] = useState(false);
    const [manualMapping, setManualMapping] = useState(mapCalibration || {}); // d -> districtName or "IGNORE"
    const [history, setHistory] = useState([mapCalibration || {}]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0, visible: false });
    const svgRef = useRef(null);

    // Mandal Placement State
    const [mandalMode, setMandalMode] = useState(false); // Are we in mandal placement mode?
    const [mandalPositions, setMandalPositions] = useState(mandalCalibration || {}); // { "district|mandal": { x, y } }
    const [availableMandals, setAvailableMandals] = useState([]); // Mandals for selected district
    const [selectedMandal, setSelectedMandal] = useState(null); // Currently selected mandal to place
    const [draggingMandal, setDraggingMandal] = useState(null); // Which mandal is being dragged
    const [mandalCopied, setMandalCopied] = useState(false);

    const isDeveloper = useMemo(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const role = (user?.role || '').toLowerCase();
            return role.includes('developer');
        } catch {
            return false;
        }
    }, []);

    // Constants for color categories
    const COLOR_CATEGORIES = useMemo(() => ({
        RED: ['#EF5135', '#DC143C', '#EE3E2D', '#F26522', '#F05033', '#E06249'],
        ORANGE: ['#F58C5A', '#F49265', '#FF7F50', '#F59163', '#F09163', '#EF9163', '#EF9162', '#EE9E7A', '#EC9467', '#EC956B', '#EB986E', '#EA9E7B'],
        TAN: ['#F8D37E', '#D2B48C', '#FAD184', '#FDFBE2', '#FDFCCC', '#FDFBCE', '#FDFCC9', '#FDFCCC', '#FDFCCF', '#FDFCD0', '#FDFCD3', '#FDFCD5', '#FDFDC9', '#FDFDCD', '#FDFDCF', '#FDFDD8'],
        BLUE: ['#1D90CE', '#6CCEF5', '#C7EAFC', '#88CFEB', '#7ACCEC', '#76CDF1', '#3F92C3', '#3691C8', '#398FC0', '#5CA5D2', '#C7EAFC', '#B0C4DE', '#4B0082', '#ADD8E6', '#B0E0E6'],
        GREEN: ['#D1DF49', '#9BCB4F', '#A0CC4E', '#D3DF4B', '#A1CB5D', '#CEDA63', '#ACCC6F', '#D4DF63', '#D4DF72', '#A3C769', '#A8CA6A', '#9BCB4F', '#ADFF2F', '#7CFC00'],
        PINK: ['#ED579E', '#F1ABCB', '#CE99BD', '#D5A3C4', '#DBA9C9', '#D9679C', '#E0689F', '#E169A0', '#E072A3', '#DF74A5', '#FF1493'],
        YELLOW: ['#F2EC43', '#E0D93F', '#F2EC45', '#DFDA51', '#F1EB54', '#D0C45D', '#DED968', '#EFEA63', '#DED95C', '#F0EC76', '#EFEB6E', '#FFFDD0'],
        BACKGROUND: ['#FEFEFE', '#F5F4F1', '#8D8D8D', '#8B8B8A', '#868687', '#868586', '#838383', '#828282', '#868786', '#8F8F8F', '#7D7C7D', '#89898A', '#898888', '#818181', '#808080', '#817F80', '#7F7F7F', '#959291']
    }), []);

    const DISTRICT_CENTROIDS = useMemo(() => [
        { name: "Srikakulam", x: 3100, y: 250, color: "BLUE" },
        { name: "Vizianagaram", x: 2850, y: 350, color: "BLUE" },
        { name: "Visakhapatnam", x: 2750, y: 550, color: "BLUE" },
        { name: "Parvathipuram Manyam", x: 2750, y: 200, color: "TAN" },
        { name: "Alluri Sitharama Raju", x: 2400, y: 500, color: "TAN" },
        { name: "Anakapalli", x: 2550, y: 750, color: "ORANGE" },
        { name: "Kakinada", x: 2400, y: 950, color: "BLUE" },
        { name: "East Godavari", x: 2200, y: 1050, color: "BLUE" },
        { name: "Konaseema", x: 2300, y: 1250, color: "BLUE" },
        { name: "Eluru", x: 1750, y: 1100, color: "RED" },
        { name: "West Godavari", x: 2150, y: 1200, color: "BLUE" },
        { name: "NTR", x: 1750, y: 1250, color: "PINK" },
        { name: "Krishna", x: 1850, y: 1000, color: "GREEN" },
        { name: "Palnadu", x: 1450, y: 1450, color: "ORANGE" },
        { name: "Guntur", x: 1650, y: 1550, color: "GREEN" },
        { name: "Bapatla", x: 1650, y: 1750, color: "RED" },
        { name: "Prakasam", x: 1350, y: 1850, color: "TAN" },
        { name: "SPSR Nellore", x: 1450, y: 2150, color: "RED" },
        { name: "Kurnool", x: 650, y: 1250, color: "RED" },
        { name: "Nandyal", x: 850, y: 1450, color: "ORANGE" },
        { name: "Anantapur", x: 550, y: 1850, color: "TAN" },
        { name: "Sri Sathya Sai", x: 650, y: 2100, color: "RED" },
        { name: "YSR Kadapa", x: 1050, y: 1850, color: "YELLOW" },
        { name: "Annamayya", x: 1150, y: 2150, color: "TAN" },
        { name: "Chittoor", x: 1050, y: 2350, color: "TAN" },
        { name: "Tirupati", x: 1350, y: 2350, color: "ORANGE" }
    ], []);

    const hexToRgb = useCallback((hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }, []);

    const getColorCategory = useCallback((hex) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        let minDistance = Infinity;
        let bestCategory = null;
        for (const [cat, hexes] of Object.entries(COLOR_CATEGORIES)) {
            for (const catHex of hexes) {
                const catRgb = hexToRgb(catHex);
                if (!catRgb) continue;
                const dist = Math.sqrt(Math.pow(rgb.r - catRgb.r, 2) + Math.pow(rgb.g - catRgb.g, 2) + Math.pow(rgb.b - catRgb.b, 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    bestCategory = cat;
                }
            }
        }
        return minDistance < 60 ? bestCategory : null;
    }, [COLOR_CATEGORIES, hexToRgb]);

    const classifyPath = useCallback((pathElement) => {
        if (!pathElement) return null;
        const d = pathElement.getAttribute('d');
        if (manualMapping[d]) return manualMapping[d];
        const fill = pathElement.getAttribute('fill');
        const transform = pathElement.getAttribute('transform');
        if (!fill) return null;
        const rgb = hexToRgb(fill);
        if (rgb && rgb.r > 240 && rgb.g > 240 && rgb.b > 240) return 'BORDER';
        const cat = getColorCategory(fill);
        if (cat === 'BACKGROUND') return 'BORDER';
        if (!cat) return null;
        let tx = 0, ty = 0;
        if (transform && transform.includes('translate')) {
            const parts = transform.match(/translate\(([\d\.-]+)\s?,?\s?([\d\.-]+)\)/);
            if (parts) {
                tx = parseFloat(parts[1]);
                ty = parseFloat(parts[2]);
            }
        } else {
            try {
                const bbox = pathElement.getBBox();
                tx = bbox.x + bbox.width / 2;
                ty = bbox.y + bbox.height / 2;
            } catch (e) { return null; }
        }
        let minOrientDist = Infinity;
        let bestDistrict = null;
        DISTRICT_CENTROIDS.forEach(d => {
            if (d.color === cat) {
                const dist = Math.sqrt(Math.pow(d.x - tx, 2) + Math.pow(d.y - ty, 2));
                if (dist < minOrientDist) {
                    minOrientDist = dist;
                    bestDistrict = d.name;
                }
            }
        });
        return minOrientDist < 1200 ? bestDistrict : null;
    }, [manualMapping, getColorCategory, DISTRICT_CENTROIDS, hexToRgb]);

    const updateMapping = useCallback((newMapping) => {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push(newMapping);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        setManualMapping(newMapping);
    }, [history, historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            setManualMapping(prev);
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            setManualMapping(next);
        }
    }, [history, historyIndex]);

    const zoomToDistrict = useCallback((district) => {
        if (svgRef.current) {
            const paths = svgRef.current.querySelectorAll('path');
            paths.forEach(p => p.removeAttribute('data-selected'));
        }
        if (!district) {
            setViewBox("0 0 3509 2482");
            return;
        }
        setTimeout(() => {
            const container = svgRef.current;
            if (!container) return;
            const paths = Array.from(container.querySelectorAll('path'));

            const components = [];
            paths.forEach(p => {
                const name = classifyPath(p);
                if (name === district) {
                    try {
                        const bbox = p.getBBox();
                        const transform = p.getAttribute('transform');
                        let tx = 0, ty = 0;
                        if (transform && transform.includes('translate')) {
                            const parts = transform.match(/translate\(([\d\.-]+)\s?,?\s?([\d\.-]+)\)/);
                            if (parts) { tx = parseFloat(parts[1]); ty = parseFloat(parts[2]); }
                        }
                        if (bbox.width > 5 && bbox.height > 5) {
                            components.push({
                                path: p,
                                area: bbox.width * bbox.height,
                                x: bbox.x + tx,
                                y: bbox.y + ty,
                                x2: bbox.x + bbox.width + tx,
                                y2: bbox.y + bbox.height + ty,
                                centerX: bbox.x + tx + bbox.width / 2,
                                centerY: bbox.y + ty + bbox.height / 2
                            });
                            p.removeAttribute('data-selected');
                        }
                    } catch (e) { }
                } else {
                    p.removeAttribute('data-selected');
                }
            });

            if (components.length > 0) {
                // Determine Principal Landmass (the largest path)
                const principal = components.reduce((prev, curr) => prev.area > curr.area ? prev : curr);

                // For visual emphasis, we apply 'data-selected' to ALL assigned fragments
                components.forEach(c => c.path.setAttribute('data-selected', 'true'));

                // For BBox, we consider all pieces but we can weight them or cap the impact of distant tiny ones
                // Let's use all pieces that aren't extreme outliers or are significant in size
                const piecesForBBox = components.filter(c => {
                    if (editMode) return true;
                    if (c.area > principal.area * 0.05) return true; // Significant size
                    const dist = Math.sqrt(Math.pow(c.centerX - principal.centerX, 2) + Math.pow(c.centerY - principal.centerY, 2));
                    return dist < 800; // Reasonable proximity for map context
                });

                let minX = Math.min(...piecesForBBox.map(c => c.x));
                let minY = Math.min(...piecesForBBox.map(c => c.y));
                let maxX = Math.max(...piecesForBBox.map(c => c.x2));
                let maxY = Math.max(...piecesForBBox.map(c => c.y2));

                const width = maxX - minX;
                const height = maxY - minY;
                const centerX = minX + width / 2;
                const centerY = minY + height / 2;
                const targetRatio = 3509 / 2482;
                const zoomFactor = 1.05; // Tighter zoom to fill viewport with district

                let viewWidth = width * zoomFactor;
                let viewHeight = height * zoomFactor;
                if (viewWidth / viewHeight > targetRatio) {
                    viewHeight = viewWidth / targetRatio;
                } else {
                    viewWidth = viewHeight * targetRatio;
                }

                setViewBox(`${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`);
            }
        }, 50);
    }, [classifyPath, editMode]); // Added editMode to dependencies

    useEffect(() => {
        if (svgRef.current) {
            const svgElement = svgRef.current.querySelector('svg');
            if (svgElement) svgElement.setAttribute('viewBox', viewBox);
        }
    }, [viewBox, svgContent]);

    // Zoom sync for normal Dashboard mode
    useEffect(() => {
        if (!editMode) {
            if (filters.district && filters.district !== 'all') {
                setSelectedDistrict(filters.district);
                zoomToDistrict(filters.district);
            } else if (filters.district === 'all') {
                setSelectedDistrict(null);
                zoomToDistrict(null);
            }
        }
    }, [filters.district, zoomToDistrict, editMode]);

    // Zoom sync for Calibration/Edit mode
    useEffect(() => {
        if (editMode && editSelectedDistrict) {
            zoomToDistrict(editSelectedDistrict);
        }
    }, [editSelectedDistrict, editMode, zoomToDistrict]);

    useEffect(() => {
        const loadSvg = async () => {
            try {
                setLoading(true);
                const response = await fetch('/Test/ap-districts-map.svg');
                if (!response.ok) throw new Error('Failed to load map data');
                let text = await response.text();
                // Inject SVG Filters for unifying fragmented regions and creating outlines
                const filters = `
                    <defs>
                        <!-- Filter for Hover: Merges and brightens -->
                        <filter id="hover-merge-filter" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
                            <feComponentTransfer in="gooey" result="bright">
                                <feFuncR type="linear" slope="1.3" />
                                <feFuncG type="linear" slope="1.3" />
                                <feFuncB type="linear" slope="1.3" />
                            </feComponentTransfer>
                            <feComposite in="bright" in2="SourceGraphic" operator="atop" />
                        </filter>

                        <!-- Filter for Selection: Creates a unified outer glowing border -->
                        <filter id="selection-outline-filter" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" result="mask" />
                            
                            <!-- Dilate to create the outer stroke thickness -->
                            <feMorphology in="mask" operator="dilate" radius="3" result="dilated" />
                            
                            <!-- Coloring the stroke (Indigo-ish white) -->
                            <feFlood flood-color="#4f46e5" flood-opacity="1" result="color" />
                            <feComposite in="color" in2="dilated" operator="in" result="outline" />
                            
                            <!-- Remove the original center to keep it just an outline -->
                            <feComposite in="outline" in2="mask" operator="out" result="final-outline" />
                            
                            <!-- Merge with original graphic -->
                            <feMerge>
                                <feMergeNode in="final-outline" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                `;
                if (!text.includes('viewBox')) {
                    text = text.replace('<svg', `<svg viewBox="0 0 3509 2482" preserveAspectRatio="xMidYMid meet" id="ap-actual-svg"`);
                } else {
                    text = text.replace('<svg', '<svg id="ap-actual-svg"');
                }
                text = text.replace('>', `>${filters}`);
                setSvgContent(text);
                setLoading(false);
            } catch (err) {
                console.error("SVG Loading Error:", err);
                setError(err.message);
                setLoading(false);
            }
        };
        loadSvg();
    }, []);

    // Effect to tag paths as interactive, selected, and handle painting state
    useEffect(() => {
        if (!svgContent || !svgRef.current) return;
        const paths = svgRef.current.querySelectorAll('path');
        paths.forEach(p => {
            const name = classifyPath(p);
            const d = p.getAttribute('d');
            const isBorder = name === "BORDER";
            const isIgnored = manualMapping[d] === "IGNORE";
            const isAssigned = manualMapping[d] && !isIgnored;

            p.setAttribute('data-ignored', isIgnored ? 'true' : 'false');
            p.setAttribute('data-border', isBorder ? 'true' : 'false');
            if (name && name !== "BORDER") p.setAttribute('data-district', name);

            if (name && name !== "BORDER" && !isIgnored) {
                p.setAttribute('data-interactive', 'true');
            } else {
                p.removeAttribute('data-interactive');
                p.style.pointerEvents = (editMode || isBorder) ? 'auto' : 'none';
            }

            // Sync visual selected state in edit mode
            if (editMode) {
                // Reset styles before applying new ones
                p.style.fill = '';
                p.style.stroke = '';
                p.style.display = '';

                if (isIgnored) {
                    p.setAttribute('data-selected', 'false');
                    p.style.fill = 'rgba(239, 68, 68, 0.4)'; // Red tint for ignored
                    p.style.stroke = '#ef4444';
                    p.style.strokeWidth = '1px';
                } else if (isAssigned) {
                    // Do not set data-selected here!
                    // It is handled by zoomToDistrict which handles outlier filtering.
                } else {
                    p.removeAttribute('data-selected');
                    // Unassigned paths show a subtle hint in edit mode
                    p.style.stroke = 'rgba(255,255,255,0.1)';
                    p.style.strokeWidth = '0.5px';
                }
            } else {
                p.style.fill = '';
                p.style.stroke = '';
                if (isIgnored) p.style.display = 'none';
                else p.style.display = '';
            }
        });
    }, [svgContent, classifyPath, editMode, manualMapping]);

    const handlePathAction = useCallback((path) => {
        if (!editMode || !path) return;
        const pathD = path.getAttribute('d');
        const newMapping = { ...manualMapping };

        // Fix: Use the effective classification (including centroids) to determine if it belongs to the district
        const effectiveName = classifyPath(path);
        const currentManualMapping = manualMapping[pathD];

        if (toolMode === 'assign' && editSelectedDistrict) {
            // OVERWRITE PROTECTION: Only paint if it's currently unassigned or IGNORED in manual mapping
            // or if it doesn't belong to another district via classification
            if (!currentManualMapping || currentManualMapping === "IGNORE") {
                newMapping[pathD] = editSelectedDistrict;
            } else {
                return;
            }
        } else if (toolMode === 'ignore') {
            // LOCKED CLEANING: Erase if either it's manually assigned to this district
            // OR if it's automatically classified as this district.
            if (effectiveName === editSelectedDistrict) {
                newMapping[pathD] = "IGNORE";
            } else {
                return;
            }
        } else if (toolMode === 'remove') {
            delete newMapping[pathD];
        }

        if (manualMapping[pathD] !== newMapping[pathD]) {
            updateMapping(newMapping);
        }
    }, [editMode, editSelectedDistrict, toolMode, manualMapping, updateMapping, classifyPath]);

    const handleSvgMouseDown = (e) => {
        if (!editMode) return;
        setIsPainting(true);
        const path = e.target.closest('path');
        if (path) handlePathAction(path);
    };

    const handleSvgMouseUp = () => {
        setIsPainting(false);
    };

    const handleSvgMouseMove = (e) => {
        if (editMode) {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                visible: true
            });
            if (isPainting) {
                const path = e.target.closest('path');
                if (path) handlePathAction(path);
            }
        } else {
            handleHover(e);
        }
    };

    const handleSvgClick = (e) => {
        if (editMode) return; // Handled by mouseDown/Up in edit mode
        const path = e.target.closest('path');
        if (!path) {
            resetView();
            return;
        }
        const districtName = classifyPath(path);
        if (districtName && manualMapping[path.getAttribute('d')] !== "IGNORE") {
            setSelectedDistrict(districtName);
            if (onDistrictSelect) onDistrictSelect(districtName);
            zoomToDistrict(districtName);
        } else {
            resetView();
        }
    };

    const handleHover = (e) => {
        const path = e.target.closest('path');
        const container = svgRef.current;
        if (!container) return;

        const districtName = path?.getAttribute('data-district');
        const isIgnored = path?.getAttribute('data-ignored') === 'true';

        // OPTIMIZED STATE RESET: Only clear if we are moving to a different district or nothing
        if (hoveredDistrict && hoveredDistrict !== districtName) {
            container.querySelectorAll(`path[data-hovered="true"]`).forEach(p => p.removeAttribute('data-hovered'));
        }

        if (!path || isIgnored || !districtName) {
            if (hoveredDistrict) setHoveredDistrict(null);
            return;
        }

        if (districtName !== hoveredDistrict) {
            setHoveredDistrict(districtName);
            // APPLY HOVER TO ALL FRAGMENTS FAST
            container.querySelectorAll(`path[data-district="${districtName}"]`).forEach(p => p.setAttribute('data-hovered', 'true'));
        }
    };

    const resetView = () => {
        zoomToDistrict(null);
        setSelectedDistrict(null);
        if (onDistrictSelect) onDistrictSelect(null);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(manualMapping, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Fetch mandals when district is selected in edit mode
    useEffect(() => {
        if (editMode && mandalMode && editSelectedDistrict) {
            const fetchMandals = async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/mandals?district=${editSelectedDistrict}`);
                    const data = await response.json();
                    if (data.success) {
                        setAvailableMandals(data.mandals || []);
                        if ((data.mandals || []).length === 0) {
                            console.warn("No mandals found for district:", editSelectedDistrict);
                        }
                    } else {
                        console.error("Failed to fetch mandals:", data.message);
                        setAvailableMandals([]);
                    }
                } catch (error) {
                    console.error('Failed to fetch mandals:', error);
                    setAvailableMandals([]);
                }
            };
            fetchMandals();
        } else {
            setAvailableMandals([]);
            setSelectedMandal(null);
        }
    }, [editMode, mandalMode, editSelectedDistrict]);

    const handleMandalCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(mandalPositions, null, 2));
        setMandalCopied(true);
        setTimeout(() => setMandalCopied(false), 2000);
    };

    const handleMandalClick = (e) => {
        if (!editMode || !mandalMode || !selectedMandal || !editSelectedDistrict) return;

        // Get SVG coordinates
        const svg = svgRef.current?.querySelector('svg');
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        const key = `${editSelectedDistrict}|${selectedMandal}`;
        setMandalPositions(prev => ({
            ...prev,
            [key]: { x: svgP.x, y: svgP.y }
        }));
    };

    const handleMandalMouseDown = (e, key) => {
        if (!editMode || !mandalMode) return;
        e.stopPropagation();
        setDraggingMandal(key);
    };

    const handleMandalDrag = (e) => {
        if (!draggingMandal) return;

        const svg = svgRef.current?.querySelector('svg');
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        setMandalPositions(prev => ({
            ...prev,
            [draggingMandal]: { x: svgP.x, y: svgP.y }
        }));
    };

    const handleMandalMouseUp = () => {
        setDraggingMandal(null);
    };


    if (loading) return (
        <div className="flex items-center justify-center p-20 bg-slate-900/50 rounded-xl border border-slate-700">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mr-3" />
            <span className="text-blue-400 font-medium">Analyzing Geography...</span>
        </div>
    );

    if (error) return (
        <div className="p-10 bg-red-900/20 border border-red-500/50 rounded-xl text-center">
            <Info className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-red-400 font-bold mb-2">Interface Offline</h3>
            <p className="text-red-300/70 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors">Retry Connection</button>
        </div>
    );

    return (
        <div className="relative w-full mx-auto bg-white/40 backdrop-blur-md rounded-[40px] overflow-hidden border border-white/20 shadow-xl select-none">
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 p-6 border-b border-white/10 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur shadow-lg border border-white/30">
                        <Filter className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">Andhra Pradesh</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white font-bold tracking-widest leading-none">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse mr-1" />
                                LIVE
                            </span>
                            <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{selectedDistrict || 'State View'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative z-10">
                    {isDeveloper && (
                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={`p-2 rounded-lg border transition-all ${editMode ? 'bg-yellow-500 border-yellow-400 text-slate-950' : 'bg-white/10 border-white/20 text-white'}`}
                            title="Calibration Mode"
                        >
                            {editMode ? <Search className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                        </button>
                    )}
                    <button
                        onClick={resetView}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-bold transition-all active:scale-95 group"
                    >
                        <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                        RESET VIEW
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 h-auto min-h-[500px]">
                <div className="lg:col-span-3 bg-indigo-50/30 relative p-4 group cursor-crosshair overflow-hidden">
                    <div
                        className="relative z-10 w-full h-[500px] flex items-center justify-center overflow-hidden"
                        onMouseDown={(e) => {
                            if (mandalMode && editMode) {
                                // Check if clicking on a mandal marker
                                const target = e.target;
                                if (target.hasAttribute('data-mandal-key')) {
                                    handleMandalMouseDown(e, target.getAttribute('data-mandal-key'));
                                }
                            } else {
                                handleSvgMouseDown(e);
                            }
                        }}
                        onMouseUp={() => {
                            if (mandalMode && editMode) {
                                handleMandalMouseUp();
                            } else {
                                handleSvgMouseUp();
                            }
                        }}
                        onMouseLeave={() => {
                            handleSvgMouseUp();
                            handleMandalMouseUp();
                            setMousePos(prev => ({ ...prev, visible: false }));
                            setHoveredDistrict(null);
                            svgRef.current?.querySelectorAll('path[data-hovered="true"]').forEach(p => p.removeAttribute('data-hovered'));
                        }}
                        onMouseMove={(e) => {
                            if (mandalMode && editMode && draggingMandal) {
                                handleMandalDrag(e);
                            } else {
                                handleSvgMouseMove(e);
                            }
                        }}
                        onClick={(e) => {
                            if (mandalMode && editMode && !draggingMandal) {
                                if (selectedMandal) {
                                    handleMandalClick(e);
                                } else {
                                    // Select district if no mandal is selected for placement
                                    const path = e.target.closest('path');
                                    if (path) {
                                        const district = classifyPath(path);
                                        if (district) {
                                            setEditSelectedDistrict(district);
                                        }
                                    }
                                }
                            } else if (!editMode) {
                                handleSvgClick(e);
                            }
                        }}
                    >
                        {editMode && mousePos.visible && !mandalMode && (
                            <div
                                className="absolute pointer-events-none z-[100] transition-transform duration-75 flex items-center justify-center"
                                style={{
                                    left: mousePos.x,
                                    top: mousePos.y,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                <div className={`w-8 h-8 rounded-full border-2 ${toolMode === 'ignore' ? 'border-red-500 bg-red-500/20' : 'border-blue-500 bg-blue-500/20'} animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]`} />
                                <div className="absolute top-full mt-2 bg-slate-900/90 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/20 uppercase tracking-tighter">
                                    {toolMode === 'ignore' ? 'CLEANING' : 'PAINTING'}
                                </div>
                            </div>
                        )}
                        {editMode && isPainting && (
                            <div className="absolute top-4 right-4 bg-yellow-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-pulse z-50 shadow-lg">
                                BRUSH ACTIVE
                            </div>
                        )}
                        <div
                            ref={svgRef}
                            id="ap-map-container"
                            className="w-full h-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:max-h-full"
                            dangerouslySetInnerHTML={{ __html: svgContent }}
                        />

                        {/* Render Mandal Markers */}
                        {/* Render Mandal Markers */}
                        {Object.entries(mandalPositions).map(([key, pos]) => {
                            const svg = svgRef.current?.querySelector('svg');
                            if (!svg) return null;

                            const [district, mandal] = key.split('|');

                            // Only show mandals for the currently focused district (edit or view mode)
                            const activeDistrict = editMode ? editSelectedDistrict : selectedDistrict;
                            if (district !== activeDistrict) return null;

                            // Convert SVG coordinates to screen coordinates
                            const pt = svg.createSVGPoint();
                            pt.x = pos.x;
                            pt.y = pos.y;
                            let screenPt;
                            try {
                                screenPt = pt.matrixTransform(svg.getScreenCTM());
                            } catch {
                                return null;
                            }

                            const rect = svg.getBoundingClientRect();
                            const x = screenPt.x - rect.left;
                            const y = screenPt.y - rect.top;

                            const isinteractive = !editMode;

                            return (
                                <div
                                    key={key}
                                    data-mandal-key={key}
                                    onClick={(e) => {
                                        if (editMode) return;
                                        e.stopPropagation();
                                        if (onMandalSelect) onMandalSelect(mandal);
                                    }}
                                    className={`absolute pointer-events-auto z-50 ${editMode ? (draggingMandal === key ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}`}
                                    style={{
                                        left: `${x}px`,
                                        top: `${y}px`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title={`${district} - ${mandal}`}
                                >
                                    <div className="relative group">
                                        <div className={`w-2 h-2 rounded-full border-2 shadow-sm transition-all duration-300
                                            ${editMode && draggingMandal === key ? 'scale-150 bg-green-500 border-white' : ''}
                                            ${!editMode && filters.mandal === mandal ? 'bg-indigo-600 scale-150 border-white ring-4 ring-indigo-400/50 z-50' : 'bg-white border-slate-900 hover:scale-125 hover:bg-indigo-500 hover:border-white'}
                                        `} />
                                        <div className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-xl backdrop-blur-sm border border-white/20 pointer-events-none transition-all duration-300 ${editMode ? 'opacity-0 group-hover:opacity-100' : 'opacity-100 translate-y-0'}`}>
                                            {mandal}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <style>{`
                            #ap-map-container svg { transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1); }
                            #ap-map-container path {
                                cursor: default;
                                transition: filter 0.3s ease, opacity 0.3s ease;
                                stroke: none !important; /* Removes internal patches/lines */
                                pointer-events: none;
                            }
                            #ap-map-container path[data-interactive="true"] {
                                pointer-events: auto;
                                cursor: pointer;
                            }
                            #ap-map-container path[data-hovered="true"] {
                                filter: url(#hover-merge-filter) brightness(1.2);
                                opacity: 1 !important;
                                z-index: 20;
                            }
                            #ap-map-container path[data-selected="true"] {
                                filter: url(#selection-outline-filter);
                                opacity: 1 !important;
                                z-index: 30;
                            }
                            #ap-map-container path[data-ignored="true"] {
                                opacity: 0;
                                pointer-events: none;
                            }
                             #ap-map-container path[data-border="true"] {
                                fill: none !important;
                                stroke: #94a3b8 !important;
                                stroke-width: 1.5px !important;
                                pointer-events: none;
                                opacity: 0.3 !important; /* Made even more subtle to let the unified look shine */
                            }
                            ${editMode ? `
                                #ap-map-container path {
                                    pointer-events: auto !important;
                                    stroke: rgba(255,255,255,0.2) !important;
                                }
                                #ap-map-container path[data-ignored="true"] {
                                    opacity: 0.6 !important;
                                    stroke: #ef4444 !important;
                                }
                                #ap-map-container path[data-border="true"] {
                                    opacity: 0.4 !important;
                                    fill: rgba(255,255,255,0.1) !important;
                                    stroke: rgba(255,255,255,0.3) !important;
                                }
                            ` : ''}
                        `}</style>
                    </div>
                    {hoveredDistrict && (
                        <div className="absolute top-2 left-2 pointer-events-none z-50">
                            <div className={`px-2 py-1 rounded border font-bold text-[10px] shadow-lg uppercase ${hoveredDistrict === "EXCLUDED ARTIFCACT" ? "bg-red-500 text-white border-red-400" : "bg-white text-slate-950 border-red-500"}`}>
                                {hoveredDistrict}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl border-l border-white/20 p-6 flex flex-col gap-6 overflow-y-auto max-h-[600px]">
                    <div>
                        <span className="text-[10px] font-black text-indigo-500 tracking-[0.2em] uppercase mb-1 block">Regional Intelligence</span>
                        <h3 className="text-2xl font-black text-gray-900 leading-tight flex items-center gap-3">
                            <MapPin className="w-6 h-6 text-red-500 fill-red-500" />
                            {selectedDistrict || "STATE VIEW"}
                        </h3>
                    </div>

                    {editMode && isDeveloper ? (
                        <div className="flex-1 space-y-3">
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-yellow-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                        Calibration Paint
                                    </h4>
                                    <div className="flex gap-1">
                                        <button onClick={handleUndo} disabled={historyIndex === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><RotateCcw className="w-4 h-4 text-white" /></button>
                                        <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><RotateCw className="w-4 h-4 text-white" /></button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-1">
                                    <button
                                        onClick={() => setToolMode('assign')}
                                        className={`py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all ${toolMode === 'assign' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50'}`}
                                    >
                                        <MousePointer2 className="w-3 h-3" /> PAINT
                                    </button>
                                    <button
                                        onClick={() => setToolMode('ignore')}
                                        className={`py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all ${toolMode === 'ignore' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/50'}`}
                                    >
                                        <Eraser className="w-3 h-3" /> CLEAN
                                    </button>
                                    <button
                                        onClick={() => setToolMode('remove')}
                                        className={`py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all ${toolMode === 'remove' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'}`}
                                    >
                                        <RotateCcw className="w-3 h-3" /> RESET
                                    </button>
                                </div>

                                <select
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-700 text-xs font-bold"
                                    value={editSelectedDistrict || ''}
                                    onChange={(e) => setEditSelectedDistrict(e.target.value)}
                                >
                                    <option value="">Brush District...</option>
                                    {DISTRICT_CENTROIDS.map(d => (
                                        <option key={d.name} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Mandal Placement Mode */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-3 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-green-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                        <Target className="w-3 h-3" /> Mandal Placement
                                    </h4>
                                    <button
                                        onClick={() => {
                                            setMandalMode(!mandalMode);
                                            if (mandalMode) {
                                                setSelectedMandal(null);
                                                setAvailableMandals([]);
                                            }
                                        }}
                                        className={`px-2 py-1 rounded text-[9px] font-black transition-all ${mandalMode ? 'bg-green-600 text-white' : 'bg-white/10 text-white/50'}`}
                                    >
                                        {mandalMode ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>

                                {mandalMode && (
                                    <>
                                        <select
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-700 text-xs font-bold"
                                            value={editSelectedDistrict || ''}
                                            onChange={(e) => setEditSelectedDistrict(e.target.value)}
                                        >
                                            <option value="">Select District...</option>
                                            {DISTRICT_CENTROIDS.map(d => (
                                                <option key={d.name} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>

                                        {availableMandals.length > 0 ? (
                                            <select
                                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-700 text-xs font-bold"
                                                value={selectedMandal || ''}
                                                onChange={(e) => setSelectedMandal(e.target.value)}
                                            >
                                                <option value="">Select Mandal to Place...</option>
                                                {availableMandals.map(m => (
                                                    <option key={m.id || m.name} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        ) : editSelectedDistrict ? (
                                            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                                                <p className="text-[10px] font-bold text-red-500">No mandals found for {editSelectedDistrict}</p>
                                                <p className="text-[9px] text-red-400 mt-1">Check API connection or district data.</p>
                                            </div>
                                        ) : null}

                                        {selectedMandal && (
                                            <p className="text-[9px] text-green-600 italic font-bold bg-green-50 p-2 rounded">
                                                Click on map to place "{selectedMandal}"
                                            </p>
                                        )}

                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={handleMandalCopy} className="py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2">
                                                {mandalCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                                {mandalCopied ? "COPIED" : "COPY JSON"}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const blob = new Blob([JSON.stringify(mandalPositions, null, 2)], { type: 'application/json' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = 'mandal_calibration.json';
                                                    a.click();
                                                }}
                                                className="py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-3 h-3" /> DOWNLOAD
                                            </button>
                                        </div>

                                        <p className="text-[9px] text-white/30 italic">Mandals placed: {Object.keys(mandalPositions).length}</p>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleCopy} className="py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2">
                                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    {copied ? "COPIED" : "COPY JSON"}
                                </button>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([JSON.stringify(manualMapping, null, 2)], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'map_calibration.json';
                                        a.click();
                                    }}
                                    className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2"
                                >
                                    <Download className="w-3 h-3" /> DOWNLOAD
                                </button>
                            </div>
                            <p className="text-[9px] text-white/30 italic">Complex regions cleaned: {Object.values(manualMapping).filter(v => v === "IGNORE").length}</p>
                        </div>
                    ) : selectedDistrict ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* VO Operations Section */}
                            <div className="bg-indigo-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-indigo-900 uppercase mb-3">VO Operations</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Uploaded</span>
                                        <span className="text-lg font-black text-indigo-600">{summary[selectedDistrict]?.uploaded || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Pending</span>
                                        <span className="text-lg font-black text-amber-600">{summary[selectedDistrict]?.pending || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Total</span>
                                        <span className="text-lg font-black text-gray-900">{summary[selectedDistrict]?.total || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* CC Actions Section */}
                            <div className="bg-emerald-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-emerald-900 uppercase mb-3">CC Actions</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Approved</span>
                                        <span className="text-lg font-black text-green-600">{summary[selectedDistrict]?.approved || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Rejected</span>
                                        <span className="text-lg font-black text-red-600">{summary[selectedDistrict]?.rejected || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Pending</span>
                                        <span className="text-lg font-black text-amber-600">{summary[selectedDistrict]?.pending || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Digital Conversion Section */}
                            <div className="bg-purple-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-purple-900 uppercase mb-3">Digital Conversion</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Converted</span>
                                        <span className="text-lg font-black text-purple-600">{summary[selectedDistrict]?.converted || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Failed</span>
                                        <span className="text-lg font-black text-red-600">{summary[selectedDistrict]?.failed || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Finance Overview Section (Simplified) */}
                            {summary[selectedDistrict]?.financeStats && (
                                <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-2xl p-5 border border-indigo-100/30 shadow-sm relative overflow-hidden group">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-indigo-100/50">
                                        <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Finance Overview</h4>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        <div className="flex justify-between items-center group/item">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight group-hover/item:text-indigo-600 transition-colors">Total Collections</span>
                                            <span className="text-xs font-black text-indigo-700">
                                                ₹{(summary[selectedDistrict].financeStats.totalLoanRecovered || 0).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group/item">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight group-hover/item:text-emerald-600 transition-colors">Member Deposits</span>
                                            <span className="text-xs font-black text-emerald-700">
                                                ₹{(summary[selectedDistrict].financeStats.totalSavings || 0).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center group/item pt-2 border-t border-indigo-50">
                                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight group-hover/item:text-rose-700 transition-colors">Total Disbursements</span>
                                            <span className="text-xs font-black text-rose-700">
                                                ₹{(summary[selectedDistrict].financeStats.outgoing || 0).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-colors duration-700"></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* State Level VO Operations Section */}
                            <div className="bg-indigo-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-indigo-900 uppercase mb-3">Statewide VO Operations</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Uploaded</span>
                                        <span className="text-lg font-black text-indigo-600">{summary.all?.uploaded || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Pending</span>
                                        <span className="text-lg font-black text-amber-600">{summary.all?.pending || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Total</span>
                                        <span className="text-lg font-black text-gray-900">{summary.all?.total || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* State Level CC Actions Section */}
                            <div className="bg-emerald-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-emerald-900 uppercase mb-3">Statewide CC Actions</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Approved</span>
                                        <span className="text-lg font-black text-green-600">{summary.all?.approved || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Rejected</span>
                                        <span className="text-lg font-black text-red-600">{summary.all?.rejected || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Pending</span>
                                        <span className="text-lg font-black text-amber-600">{summary.all?.ccPending || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* State Level Digital Conversion Section */}
                            <div className="bg-purple-50 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-purple-900 uppercase mb-3">Statewide Digital Conversion</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Converted</span>
                                        <span className="text-lg font-black text-purple-600">{summary.all?.converted || 0}</span>
                                    </div>
                                    <div className="bg-white/80 p-3 rounded-xl">
                                        <span className="block text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Failed</span>
                                        <span className="text-lg font-black text-red-600">{summary.all?.failed || 0}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InteractiveAPMap;

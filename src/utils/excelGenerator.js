import * as XLSX from 'xlsx';

/**
 * Financial column definitions for SHG report
 * Each entry: { key: statsFieldName, header: columnLabel }
 * Order matches the analytics cards shown in the UI.
 */
const FINANCIAL_COLUMNS = [
    { key: 'totalSavings', header: 'ఈ నెల పొదుపు (Monthly Savings)' },
    { key: 'shgInternal', header: 'SHG అంతర్గత అప్పు కట్టిన మొత్తం (SHG Internal)' },
    { key: 'bankLoan', header: 'బ్యాంక్ అప్పు కట్టిన మొత్తం (Bank Loan Repaid)' },
    { key: 'streenidhiMicro', header: 'స్త్రీనిధి మైక్రో అప్పు కట్టిన మొత్తం (Streenidhi Micro)' },
    { key: 'streenidhiTenni', header: 'స్త్రీనిధి టెన్నీ అప్పు కట్టిన మొత్తం (Streenidhi Tenny)' },
    { key: 'unnatiSCSP', header: 'ఉన్నతి (SCSP) అప్పు కట్టిన మొత్తం (Unnati SCSP)' },
    { key: 'unnatiTSP', header: 'ఉన్నతి (TSP) అప్పు కట్టిన మొత్తం (Unnati TSP)' },
    { key: 'cif', header: 'CIF అప్పు కట్టిన మొత్తం (CIF Loan)' },
    { key: 'voInternal', header: 'VO అంతర్గత అప్పు కట్టిన మొత్తం (VO Internal)' },
    { key: 'totalCollections', header: 'మొత్తం వసూళ్లు (Total Collections)' },
    { key: 'totalLoansTaken', header: 'మొత్తం (New Loans / Loans Sanctioned)' },
    { key: 'totalPenalties', header: 'జరిమానా రకం (Penalties)' },
    { key: 'totalReturned', header: 'సభ్యులకు తిరిగి ఇచ్చిన మొత్తం (Savings Withdrawal)' },
    { key: 'otherSavings', header: 'సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు) (Other Savings)' },
];

const HEADERS = ['S.No', 'ID', 'Name', ...FINANCIAL_COLUMNS.map(c => c.header)];


/**
 * Build a data row array for the spreadsheet.
 * @param {number|string} rowNum  - Row number (1-based)
 * @param {string} id             - Entity ID
 * @param {string} name           - Entity name
 * @param {object} stats          - Financial stats object from breakdown API
 */
const buildRow = (rowNum, id, name, stats = {}) => [
    rowNum,
    id ?? '',
    name ?? '',
    ...FINANCIAL_COLUMNS.map(col => {
        // totalCollections is derived: sum of loan-repaid columns
        if (col.key === 'totalCollections') {
            const computed = (
                (stats.bankLoan || 0) +
                (stats.shgInternal || 0) +
                (stats.streenidhiMicro || 0) +
                (stats.streenidhiTenni || 0) +
                (stats.unnatiSCSP || 0) +
                (stats.unnatiTSP || 0) +
                (stats.cif || 0) +
                (stats.voInternal || 0)
            );
            // Prefer the pre-computed value if it's non-zero, else use our derivation
            return stats.totalCollections || computed || 0;
        }
        return stats[col.key] ?? 0;
    })
];


/**
 * Export detailed unit performance breakdown to Excel.
 *
 * Layout:
 *   Row 1 : Header row
 *   Row 2 : PARENT row  (APM / CC / VO) showing aggregated total of all children
 *   Row 3+ : CHILDREN rows (CCs for APM, VOs for CC, SHGs for VO)
 *
 * @param {Array}  breakdownData  - Data from /api/payments/breakdown
 * @param {string} level          - Grouping level (clusterID, voID, shg_mbk_id, …)
 * @param {Array}  allUnits       - Master list from hierarchy (for APM to look up CC names)
 * @param {Object} parentUnit     - Metadata about the parent unit being downloaded
 */
export const exportPerformanceExcel = (breakdownData, level, allUnits = [], parentUnit = null) => {
    const rows = breakdownData || [];

    // ── 1. Compute aggregated totals to use for the parent summary row ──────
    const parentStats = rows.reduce((acc, item) => {
        FINANCIAL_COLUMNS.forEach(col => {
            if (col.key === 'totalCollections') return; // derived, skip
            acc[col.key] = (acc[col.key] || 0) + (item.stats?.[col.key] || 0);
        });
        // Re-derive totalCollections
        acc.totalCollections = (
            (acc.bankLoan || 0) + (acc.shgInternal || 0) + (acc.streenidhiMicro || 0) +
            (acc.streenidhiTenni || 0) + (acc.unnatiSCSP || 0) + (acc.unnatiTSP || 0) +
            (acc.cif || 0) + (acc.voInternal || 0)
        );
        return acc;
    }, {});

    // ── 2. Build sheet data ─────────────────────────────────────────────────
    const sheetData = [HEADERS];

    // Children rows
    rows.forEach((item, idx) => {
        sheetData.push(buildRow(idx + 1, item.id ?? '', item.name ?? '', item.stats ?? {}));
    });

    // Parent summary row (overall totals)
    if (parentUnit) {
        const pId = parentUnit.userID || parentUnit.clusterID || parentUnit.voID || parentUnit.id || '';
        sheetData.push([])
        sheetData.push(buildRow('TOTAL', pId, `[${parentUnit.role}] ${parentUnit.name}`, parentStats));
    }

    // ── 3. Create Worksheet ─────────────────────────────────────────────────
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Style: auto-width for all columns
    const colWidths = HEADERS.map((h, colIdx) => {
        let maxLen = h.length;
        // Telugu characters render wider
        if (/[\u0c00-\u0c7f]/.test(h)) maxLen = Math.max(maxLen * 1.8, 32);
        sheetData.forEach(row => {
            const cell = row[colIdx];
            if (cell != null) {
                const text = String(cell);
                const isTelugu = /[\u0c00-\u0c7f]/.test(text);
                const cellLen = isTelugu ? text.length * 1.8 : text.length;
                if (cellLen > maxLen) maxLen = cellLen;
            }
        });
        return { wch: Math.min(maxLen + 4, 60) };
    });
    worksheet['!cols'] = colWidths;

    // ── 4. Write file ───────────────────────────────────────────────────────
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const roleLabel = parentUnit?.role || level?.toUpperCase() || 'UNIT';
    const nameLabel = (parentUnit?.name || 'Report').replace(/\s+/g, '_').replace(/[^\w_]/g, '');
    const fileName = `${roleLabel}_${nameLabel}_Report.xlsx`;

    XLSX.writeFile(workbook, fileName);
};


/**
 * Export multi-month cumulative financial summary to Excel.
 * @param {Array} historyData - Processed data from CumulativeFinanceSummary component
 */
export const exportCumulativeExcel = (historyData) => {
    const headers = [
        'Month',
        'Opening Balance (₹)',
        'Total Inflow (₹)',
        'Total Outflow (₹)',
        'Closing Balance (₹)',
    ];

    const rows = historyData.map(item => [
        getMonthName(item.month) + ' ' + item.year,
        item.opening ?? 0,
        item.inflow ?? 0,
        item.outflow ?? 0,
        item.closing ?? 0,
    ]);

    const sheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!cols'] = headers.map(h => ({ wch: h.length + 12 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Summary');

    XLSX.writeFile(workbook, `Cumulative_Financial_Report_${new Date().getFullYear()}.xlsx`);
};


const getMonthName = (m) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[(m - 1)] || String(m);
};

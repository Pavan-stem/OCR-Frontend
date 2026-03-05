import * as XLSX from 'xlsx';

/**
 * Mapping of internal stat keys to Telugu titles for SHG financial data
 */
const TELUGU_HEADERS = {
    totalSavings: "నెలవారీ డిపాజిట్లు (Monthly Deposits)",
    totalCollections: "మొత్తం వసూళ్లు (Total Collections)",
    shgInternal: "SHG అంతర్గత అప్పు కట్టిన మొత్తం",
    bankLoan: "బ్యాంక్ అప్పు కట్టిన మొత్తం",
    streenidhiMicro: "స్త్రీనిధి మైక్రో అప్పు కట్టిన మొత్తం",
    streenidhiTenni: "స్త్రీనిధి టెన్నీ అప్పు కట్టిన మొత్తం",
    unnatiSCSP: "ఉన్నతి (SCSP) అప్పు కట్టిన మొత్తం",
    unnatiTSP: "ఉన్నతి (TSP) అప్పు కట్టిన మొత్తం",
    cif: "CIF అప్పు కట్టిన మొత్తం",
    voInternal: "VO అంతర్గత అప్పు కట్టిన మొత్తం",
    totalLoansTaken: "మొత్తం అప్పు (Total Amount)",
    totalPenalties: "జరిమానా రకం",
    totalReturned: "సభ్యులకు తిరిగి ఇచ్చిన మొత్తం",
    otherSavings: "సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు)"
};

/**
 * Export detailed unit performance breakdown to Excel
 * @param {Array} breakdownData - Data from /api/payments/breakdown
 * @param {string} level - Geographic level (district, mandal, voID, shg_mbk_id)
 * @param {Array} allUnits - Optional master list of units from hierarchy
 * @param {Object} parentUnit - Metadata about the parent unit being exported
 */
export const exportPerformanceExcel = (breakdownData, level, allUnits = [], parentUnit = null) => {
    const FINANCIAL_HEADERS = [
        "నెలవారీ డిపాజిట్లు (Monthly Deposits)",
        "SHG అంతర్గత అప్పు కట్టిన మొత్తం",
        "బ్యాంక్ అప్పు కట్టిన మొత్తం",
        "స్త్రీనిధి మైక్రో అప్పు కట్టిన మొత్తం",
        "స్త్రీనిధి టెన్నీ అప్పు కట్టిన మొత్తం",
        "ఉన్నతి (SCSP) అప్పు కట్టిన మొత్తం",
        "ఉన్నతి (TSP) అప్పు కట్టిన మొత్తం",
        "CIF అప్పు కట్టిన మొత్తం",
        "VO అంతర్గత అప్పు కట్టిన మొత్తం",
        "మొత్తం వసూళ్లు (Total Collections)",
        "మొత్తం (కొత్త అప్పు)",
        "జరిమానా రకం",
        "సభ్యులకు తిరిగి ఇచ్చిన మొత్తం",
        "సభ్యుల ఇతర పొదుపు (విరాళం ఇతరములు)"
    ];
    const FINANCIAL_KEYS = [
        'totalSavings', 'shgInternal', 'bankLoan', 'streenidhiMicro',
        'streenidhiTenni', 'unnatiSCSP', 'unnatiTSP', 'cif', 'voInternal',
        'totalCollections', 'totalLoansTaken', 'totalPenalties', 'totalReturned', 'otherSavings'
    ];

    const headers = ["ID", "Name", ...FINANCIAL_HEADERS];

    const buildRow = (id, name, stats) => [
        id, name,
        ...FINANCIAL_KEYS.map(k => stats?.[k] || 0)
    ];

    // Build stats map from breakdownData (keyed by id)
    const statsMap = {};
    (breakdownData || []).forEach(item => { statsMap[String(item.id)] = item.stats; });

    const dataRows = [];

    // 1. PARENT ROW (always show parent's aggregated stats = sum of its children from breakdownData)
    if (parentUnit) {
        const pId = parentUnit.userID || parentUnit.clusterID || parentUnit.voID || parentUnit.id;
        // Sum children for parent stats
        const parentStats = (breakdownData || []).reduce((acc, item) => {
            FINANCIAL_KEYS.forEach(k => { acc[k] = (acc[k] || 0) + (item.stats?.[k] || 0); });
            return acc;
        }, {});
        dataRows.push(buildRow(pId, parentUnit.name, parentStats));
    }

    // 2. CHILDREN ROWS from breakdownData (these are the summed groups: CCs, VOs, or SHGs)
    (breakdownData || []).forEach(item => {
        dataRows.push(buildRow(item.id, item.name, item.stats));
    });

    const finalData = [headers, ...dataRows];
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    // PRECISE AUTO-WIDTH CALCULATION
    const colWidths = headers.map((h, i) => {
        let maxLen = h.toString().length;
        if (/[\u0c00-\u0c7f]/.test(h)) maxLen = Math.max(maxLen * 2.5, 30);
        finalData.forEach(row => {
            if (row[i]) {
                const text = row[i].toString();
                const isTelugu = /[\u0c00-\u0c7f]/.test(text);
                const len = isTelugu ? text.length * 2.5 : text.length;
                if (len > maxLen) maxLen = len;
            }
        });
        return { wch: Math.min(maxLen + 6, 60) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const fileName = parentUnit
        ? `${parentUnit.role}_${parentUnit.name.replace(/\s+/g, '_')}_Report.xlsx`
        : `Performance_Report_${level.toUpperCase()}.xlsx`;

    XLSX.writeFile(workbook, fileName);
};

/**
 * Export multi-month cumulative financial summary to Excel
 * @param {Array} historyData - Data from /api/payments/history
 */
export const exportCumulativeExcel = (historyData) => {
    const headers = [
        "Month",
        "Opening Balance",
        "Inflow",
        "Outflow",
        "Closing Balance",
        "Next Month Opening"
    ];

    let runningBalance = 0; // Starts from 0 in January
    const rows = historyData.map(item => {
        const opening = runningBalance;
        const inflow = item.inflow || 0;
        const outflow = item.outflow || 0;
        const closing = opening + inflow - outflow;

        const row = [
            getMonthName(item.month),
            opening.toLocaleString('en-IN'),
            inflow.toLocaleString('en-IN'),
            outflow.toLocaleString('en-IN'),
            closing.toLocaleString('en-IN'),
            closing.toLocaleString('en-IN') // Next month opening is current closing
        ];

        runningBalance = closing;
        return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Summary");

    // Auto-size columns
    const wscols = headers.map(h => ({ wch: h.length + 15 }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "Cumulative_Financial_Report.xlsx");
};

const getMonthName = (m) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[m - 1] || m;
};

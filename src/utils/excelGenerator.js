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
    
    // Page 2 Financial Ledger Columns
    { key: 'savings', header: 'Savings (₹)' },
    { key: 'vo_shared_capital', header: 'VO Shared Capital (₹)' },
    { key: 'vo_savings', header: 'VO Savings (₹)' },
    { key: 'revolving_fund', header: 'Revolving Fund (₹)' },
    { key: 'strinidi_savings', header: 'Streenidhi Savings (₹)' },
    { key: 'aadhar_grants', header: 'Aadhar Grants (₹)' },
    { key: 'bank_deposit', header: 'Bank Deposit (₹)' },
    { key: 'returned_shared_capital', header: 'Returned Shared Capital (₹)' },
    { key: 'entrance_fee', header: 'Entrance Fee (₹)' },
    { key: 'returned_vo_savings', header: 'Returned VO Savings (₹)' },
    { key: 'fines_paid', header: 'Fines Paid (₹)' },
    { key: 'returned_strinidi_savings', header: 'Returned Streenidhi Savings (₹)' },
    { key: 'honorarium', header: 'Honorarium (₹)' },
    { key: 'returned_bank_deposit', header: 'Returned Bank Deposit (₹)' },
    { key: 'other_expenses', header: 'Other Expenses (₹)' },
    { key: 'stationary', header: 'Stationary (₹)' },
    { key: 'audit_fees', header: 'Audit Fees (₹)' },
    { key: 'bank_charges', header: 'Bank Charges (₹)' },
    { key: 'bank_interest', header: 'Bank Interest (₹)' },
    { key: 'banck_loan_payment', header: 'Bank Loan Payment (₹)' },
    { key: 'strinidi_micro_payment', header: 'Streenidhi Micro Payment (₹)' },
    { key: 'strinidi_teni_payment', header: 'Streenidhi Tenny Payment (₹)' },
    { key: 'scsp_payment', header: 'SCSP Payment (₹)' },
    { key: 'tsp_payment', header: 'TSP Payment (₹)' },
    { key: 'cif_payment', header: 'CIF Payment (₹)' },
    { key: 'vo_internal_payments', header: 'VO Internal Payments (₹)' }
];

const HEADERS = ['S.No', 'ID', 'Name', ...FINANCIAL_COLUMNS.map(c => c.header)];


/**
 * Build a data row array for the spreadsheet.
 */
const buildRow = (rowNum, id, name, stats = {}, isSynced = false) => [
    rowNum,
    id ?? '',
    name ?? '',
    ...FINANCIAL_COLUMNS.map(col => {
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
            return stats.totalCollections || computed || 0;
        }
        return stats[col.key] ?? 0;
    })
];


/**
 * Export detailed unit performance to Excel.
 */
export const exportPerformanceExcel = (data, level, children = [], parent = null) => {
    try {
        const rows = [];
        
        // 1. Root Level Summary
        const totals = { ...data[0]?.stats || {} }; // Default if empty
        const allStats = data.map(d => d.stats || {});
        
        // Sum up all columns including Page 2
        FINANCIAL_COLUMNS.forEach(col => {
            totals[col.key] = allStats.reduce((acc, curr) => acc + (curr[col.key] || 0), 0);
        });

        // 1. Individual Unit Rows
        data.forEach((item, idx) => {
            rows.push(buildRow(idx + 1, item.id, item.name, item.stats, item.isSynced));
        });

        // 2. Root Level Summary (Moved to end)
        const parentName = parent?.name || (level === 'apm' ? 'APM Scope' : 'Summary');
        const parentId = parent?.userID || parent?.voID || parent?.clusterID || parent?.id || (level === 'apm' ? 'APM' : 'ALL');
        rows.push(buildRow('TOTAL', parentId, parentName, totals, true));

        // 3. Create Workbook
        const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Unit Performance");

        // Column widths
        worksheet['!cols'] = [
            { wch: 8 },  // S.No
            { wch: 15 }, // ID
            { wch: 35 }, // Name
            ...FINANCIAL_COLUMNS.map(() => ({ wch: 18 }))
        ];

        // 4. Download
        const cleanName = (parent?.name || level).replace(/[^a-z0-9]/gi, '_');
        const filename = `${cleanName}_Performance_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, filename);
    } catch (err) {
        console.error("Excel Export Error:", err);
        alert("Failed to generate Excel report.");
    }
};

/**
 * Export cumulative financial summary history to Excel.
 */
export const exportCumulativeExcel = (history) => {
    try {
        const headers = ['Month', 'Year', 'Opening Balance', 'Inflow (+)', 'Outflow (-)', 'Closing Balance'];
        const rows = history.map(item => [
            new Date(0, item.month - 1).toLocaleString('default', { month: 'long' }),
            item.year,
            item.opening || 0,
            item.inflow || 0,
            item.outflow || 0,
            item.closing || 0
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Financial History");
        
        worksheet['!cols'] = [
            { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
        ];

        XLSX.writeFile(workbook, `Cumulative_Financial_History_${new Date().getFullYear()}.xlsx`);
    } catch (err) {
        console.error("Cumulative Excel Error:", err);
        alert("Failed to export summary.");
    }
};

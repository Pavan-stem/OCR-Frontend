export const formatDate = (dateStringOrDate) => {
    if (!dateStringOrDate) return '-';
    try {
        const date = dateStringOrDate instanceof Date ? dateStringOrDate : new Date(dateStringOrDate);
        if (isNaN(date.getTime())) return '-';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
    } catch (e) {
        return '-';
    }
};

export const formatDateTime = (dateStringOrDate) => {
    if (!dateStringOrDate) return '-';
    try {
        // Ensure timestamp is treated as UTC if it's an ISO string without Z/offset
        let sanitizedTs = dateStringOrDate;
        if (typeof dateStringOrDate === 'string' && dateStringOrDate.includes('T') && !dateStringOrDate.endsWith('Z') && !dateStringOrDate.includes('+')) {
            sanitizedTs = dateStringOrDate + 'Z';
        }

        const date = sanitizedTs instanceof Date ? sanitizedTs : new Date(sanitizedTs);
        if (isNaN(date.getTime())) return '-';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
        return '-';
    }
};

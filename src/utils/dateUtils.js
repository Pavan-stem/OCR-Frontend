/**
 * Formats a date string or Date object into DD/MM/YYYY
 * @param {string|Date} dateString 
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
    if (!dateString) return "-";

    let date;
    try {
        // Basic sanitization for common ISO string issues in this codebase
        let sanitizedDate = dateString;
        if (typeof dateString === 'string' && dateString.includes('T') && !dateString.endsWith('Z') && !dateString.includes('+')) {
            sanitizedDate = dateString + 'Z';
        }
        date = new Date(sanitizedDate);
        if (isNaN(date.getTime())) return dateString;
    } catch (e) {
        return dateString;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
};

/**
 * Formats a date string or Date object into DD/MM/YYYY, HH:MM AM/PM
 * @param {string|Date} dateString 
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (dateString) => {
    if (!dateString) return "-";

    let date;
    try {
        let sanitizedDate = dateString;
        if (typeof dateString === 'string' && dateString.includes('T') && !dateString.endsWith('Z') && !dateString.includes('+')) {
            sanitizedDate = dateString + 'Z';
        }
        date = new Date(sanitizedDate);
        if (isNaN(date.getTime())) return dateString;
    } catch (e) {
        return dateString;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strTime = String(hours).padStart(2, "0") + ":" + minutes + " " + ampm;

    return `${day}/${month}/${year}, ${strTime}`;
};

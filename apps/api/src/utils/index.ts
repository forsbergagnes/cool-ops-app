
/**
 * Extracts the name (if present) as well as the email address from a
 * Gmail sender
 * 
 * Example 1: Theo <theo@mail.com> => { name: "Theo", email: "theo@mail.com" }
 * Example 2: theo@mail.com => { email: "theo@mail.com" }
 */
export const extractNameAndMail = (value: string): { name?: string, emails: string[] } | undefined => {
    const regex = /(?:([^<]+)\s*)?<([^>]+)>|([^<>\s]+)/;
    const match = value.toLowerCase().match(regex);

    if (!match) return;

    if (match[1] && match[2]) {
        const trimmedName = match[1].trim().match(/"([^"]+)"/)
        return {
            name: trimmedName ? trimmedName[1] || trimmedName[0] : match[1].trim(),
            emails: match[2].trim().split(",")
        }
    }

    if (match[3]) {
        return {
            emails: match[3].trim().split(",")
        }
    }
};
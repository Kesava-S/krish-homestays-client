/**
 * Utility for safe API calls and response parsing.
 * Prevents "Unexpected token '<', '<!DOCTYPE ...' is not valid JSON" crashes
 * by safely extracting JSON or clean error messages from non-JSON / HTML server responses.
 */

export async function parseApiResponse(res, defaultError = 'Request failed') {
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        const clean = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        throw new Error(clean || `Server error (${res.status} ${res.statusText || 'Error'})`);
    }

    if (!res.ok || (data && typeof data === 'object' && data.success === false)) {
        throw new Error(data?.error || data?.message || defaultError);
    }

    return data;
}

export async function safeFetch(url, options = {}, defaultError = 'Request failed') {
    const res = await fetch(url, options);
    return parseApiResponse(res, defaultError);
}

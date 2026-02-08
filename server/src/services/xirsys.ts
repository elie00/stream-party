/**
 * Xirsys TURN credentials service
 * 
 * Xirsys provides dynamic TURN credentials via API.
 * This service fetches fresh credentials for each request.
 * 
 * Required environment variables:
 * - XIRSYS_IDENT: Your Xirsys username
 * - XIRSYS_SECRET: Your Xirsys secret key
 * - XIRSYS_CHANNEL: Channel name (e.g., "stream-party")
 */

interface XirsysCredentials {
    urls: string;
    username: string;
    credential: string;
}

interface XirsysResponse {
    v: XirsysCredentials[];
    s: string; // status
}

const XIRSYS_API_URL = 'https://global.xirsys.net/_turn';

export async function getXirsysTurnCredentials(): Promise<XirsysCredentials[] | null> {
    const ident = process.env.XIRSYS_IDENT;
    const secret = process.env.XIRSYS_SECRET;
    const channel = process.env.XIRSYS_CHANNEL || 'stream-party';

    if (!ident || !secret) {
        console.log('Xirsys credentials not configured, TURN disabled');
        return null;
    }

    try {
        const auth = Buffer.from(`${ident}:${secret}`).toString('base64');

        const response = await fetch(`${XIRSYS_API_URL}/${channel}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ format: 'urls' }),
        });

        if (!response.ok) {
            console.error('Xirsys API error:', response.status, await response.text());
            return null;
        }

        const data: XirsysResponse = await response.json();

        if (data.s !== 'ok') {
            console.error('Xirsys returned error status:', data.s);
            return null;
        }

        return data.v;
    } catch (error) {
        console.error('Failed to fetch Xirsys credentials:', error);
        return null;
    }
}

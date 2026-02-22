import express from 'express';

export async function proxyRequestHandler(endpoint : string, req: express.Request, res: express.Response, 
    upstreams: Array<{id: string, url: string }>, availableUpstreams: Array<{name: string}>) { 
    console.log(`Received request for endpoint: ${endpoint} at time ${new Date().toISOString()}`);

    // Pick the first available upstream for now -> later load balancing or least connections
    const upstream = availableUpstreams[0];
    const currUpstream = upstreams.find(u => u.id === upstream?.name);

    if (!currUpstream) {
        res.status(502).send('No upstream server available');
        return;
    }

    try {
        // Forward the request to the upstream server
        const upstreamUrl = `${currUpstream.url}${req.originalUrl}`;
        console.log(`Forwarding request to upstream: ${upstreamUrl} at time ${new Date().toISOString()}`);

        const response = await fetch(upstreamUrl, {
            method: req.method,
            headers: {
                'Content-Type': req.get('Content-Type') || 'application/json',
            },
        });

        const body = await response.text();
        res.status(response.status).send(body);
    } catch (error) {
        res.status(502).send('Bad Gateway');
    }
}

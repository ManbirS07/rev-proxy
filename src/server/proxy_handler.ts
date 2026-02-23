import express from 'express';
import type { Server } from 'node:http';
import type { Upstream } from '../types/upstreams.js';
import { globalRequestMap } from './server.js';

export async function proxyRequestHandler(balancer: any, strategy: string, req: express.Request, res: express.Response, 
    upstreams: Upstream[], httpServer: Server) { 

    const upstreamId = balancer.getNextUpstream(req); // pass req so ip-hash can read req.ip
    if (!upstreamId) {
        res.status(502).send('No upstream available');
        return;
    }

    // logging which upstream was picked and current active request counts
    const activeSnapshot: Record<string, number> = {};
    for (const [key, value] of globalRequestMap) {
        activeSnapshot[key] = value;
    }
    console.log(`Received request for endpoint: ${req.path} | strategy: ${strategy} → ${upstreamId} | active: ${JSON.stringify(activeSnapshot)}`);



    const release = balancer.onRequestStart(upstreamId); //increment the active request count for that upstream, and get the release function to decrement it later
    try {
        const upstream = upstreams.find(u => u.id === upstreamId);

        if (!upstream?.url) {
            res.status(502).send('Bad Gateway');
            return;
        }

        const upstreamUrl = `${upstream.url}${req.originalUrl}`;
        console.log(`Forwarding request to upstream: ${upstreamUrl}`);

        const response = await fetch(upstreamUrl, {
            method: req.method,
            headers: {
                'Content-Type': req.get('Content-Type') || 'application/json',
            },
        });

        const body = await response.text();
        res.status(response.status).send(body);

    } catch (error) {
        console.error(`Error forwarding to ${upstreamId}: ${error}`);
        res.status(502).send('Bad Gateway');
    }
    finally {
        release(); //decrement the active request count for that upstream
    }
}


// creating a load balancer per upstream pool
//   upstream_groups:
//   api_pool: [server1, server2]
//   main_pool: [server1, server2, server3]
//   admin_pool: [server3]

// endpoints:
//   - path: /
//     upstream_group: main_pool
//   - path: /api
//     upstream_group: api_pool
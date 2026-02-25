import express from 'express';
import type { Server } from 'node:http';
import type { Upstream } from '../types/upstreams.js';

//CREATING A NEW GLOBAL MAP FOR STORING GLOBAL REQUESTS TO EACH UPSTREAM SERVER
export const globalRequestMap = new Map<string, number>(); //key is the upstream id and value is the number of requests currently being handled by that upstream server

export async function proxyRequestHandler(balancer: any, strategy: string, req: express.Request, res: express.Response, 
    upstreams: Upstream[], httpServer: Server) { 

    const upstreamId = balancer.getNextUpstream(req); // pass req so ip-hash can read req.ip
    if (!upstreamId) {
        res.status(502).send('No upstream available');
        return;
    }

    // logging which upstream was picked and current active request counts
    const release = balancer.onRequestStart(upstreamId); //increment the active request count for that upstream, and get the release function to decrement it later
    const activeSnapshot: Record<string, number> = {};
    for (const [key, value] of globalRequestMap) {
        activeSnapshot[key] = value;
    }
    console.log(`Received request for endpoint: ${req.path} | strategy: ${strategy} → ${upstreamId} | active: ${JSON.stringify(activeSnapshot)}`);

    try {
        const upstream = upstreams.find(u => u.id === upstreamId);

        if (!upstream?.url) {
            res.status(502).send('Bad Gateway');
            return;
        }

        const upstreamUrl = `${upstream.url}${req.originalUrl}`;
        console.log(`Forwarding request to upstream: ${upstreamUrl}`);

        // Simulated delay to test least-connections with concurrent requests.
        //because the upstreams react in microseconds

        //so what happens here is:
        //1. 10 requests come in at the same time, all hitting the least-connections endpoint
        // 1st request starts processing, picks the upstream with least connections (all are 0, so it picks the first one), increments that upstream's count to 1
        //then hits this artificial delay, during which the other 9 requests arrive and all see that this upstream has 1 active connection, so they all pick the next upstream (which now has the least connections at 0), and increment its count to 1
        //after this promise is resolved, the first request releases its upstream, decrementing its count back to 0, so the next request that comes in will see that this upstream has 0 connections and pick it again. This simulates how least-connections should work under concurrent load.

        // The await new Promise(resolve => setTimeout(resolve, 5000)) pauses the async function for 5 seconds
        // before the fetch. During that pause, Node.js yields control back to the event loop,
        // allowing other incoming requests to run their handlers.
        // Those subsequent requests will see elevated counts and pick server2/server3.
        await new Promise(resolve => setTimeout(resolve, 5000));

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
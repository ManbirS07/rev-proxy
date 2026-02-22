//for the master process
import express from 'express';
import { main } from '../index.js';
import { proxyRequestHandler } from './proxy_handler.js';

export async function startServer(config: Awaited<ReturnType<typeof main>>) {
    const app = express();
    const port = config?.server.listen

    if (!port) {
        console.error('Master port not defined in config');
        process.exit(1);
    }

    app.listen(port, () => {
        console.log(`Master server is running on port ${port}`);
    })
    
    app.get('/ping', async (req, res) => {
        res.send('pong');
    })
    return app; //returning the proxy server instance
}

export async function forwardRequesttoProxyHandler() {
    const config = await main(); 
    const app = await startServer(config); //router for the master server

    const upstreams = config?.server.upstreams; //get the upstreams from the config file
    if (!upstreams) {
        console.error('Upstreams not defined in config');
        process.exit(1);
    }
    const endpoints = config?.server.endpoints; //get the endpoints from the config file
    if (!endpoints) {
        console.error('Endpoints not defined in config');
        process.exit(1);
    }

    for(const endpoint of endpoints) {
        const route = endpoint.path; //get the path for the endpoint
        const availableUpstreams = endpoint.upstreams.map(upstream => ({ name: upstream })); //get the available upstreams for the endpoint

        app.all(route, async (req, res) => {
            //forward the request to the proxy handler
            await proxyRequestHandler(route, req, res, upstreams, availableUpstreams);
        })
    }

    // 404 catch-all — must be registered after all other routes
    app.use((req, res) => {
        res.status(404).send(`Invalid Route: ${req.originalUrl}`);
    });
}

//for the master process
import express from 'express';
import { main } from '../index.js';
import { proxyRequestHandler } from './proxy_handler.js';
import { createBalancer } from './balancers/balancerFactory.js';


export async function startServer(config: Awaited<ReturnType<typeof main>>) {
    const app = express();
    const port = config?.server.listen

    if (!port) {
        console.error('Master port not defined in config');
        process.exit(1);
    }

    const httpServer = app.listen(port, () => {
        console.log(`Master server is running on port ${port}`);
    })
    
    app.get('/ping', async (req, res) => {
        res.send('pong');
    })
    return {app, httpServer}; //app is just for routing, httpServer is for load balancing and worker management
}

export async function forwardRequesttoProxyHandler() {
    const config = await main(); 
    const {app, httpServer} = await startServer(config); //router for the master server

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

    //tracking TCP connections on the underlying http server
    let activeTcpConnections = 0;
    httpServer.on('connection', (socket) => {
        activeTcpConnections++;
        console.log(`Client TCP connected from ${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? 'unknown'} | active connections: ${activeTcpConnections}`);

        socket.on('close', () => {
            activeTcpConnections = Math.max(0, activeTcpConnections - 1);
            console.log(`Client TCP disconnected | active connections: ${activeTcpConnections}`);
        });
    });



    for(const endpoint of endpoints) {
        const balancer = createBalancer(endpoint.strategy, endpoint.upstreams); //created ONCE per endpoint, lives across all requests
        app.all(endpoint.path, async (req, res) => {
            //forward the request to the proxy handler
            await proxyRequestHandler(balancer, endpoint.strategy, req, res, upstreams, httpServer);
        })
    }

    // 404 catch-all — must be registered after all other routes
    app.use((req, res) => {
        res.status(404).send(`Invalid Route: ${req.originalUrl}`);
    });
}

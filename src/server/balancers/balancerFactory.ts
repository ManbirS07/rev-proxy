//factory design pattern to create different load balancers based on the strategy defined in the config file
//for each endpoint, I'll take the id of upstreams and the strategy defined 
//then return a balancer object based on the strategy defined in the config file

import RoundRobinBalancer from "./roundRobin.js";
import LeastConnectionsBalancer from "./leastConnections.js";
import IpHashBalancer from "./ipHash.js";
import type { Endpoint } from "../../types/endpoints.js";

export function createBalancer(strategy: string, availableUpstreams: Endpoint['upstreams']) {
    switch(strategy) {
        case "round-robin":
            return new RoundRobinBalancer(availableUpstreams);
        case "least-connections":
            return new LeastConnectionsBalancer(availableUpstreams);
        case "ip-hash":
            return new IpHashBalancer(availableUpstreams);
        default:
            throw new Error(`Unknown load balancing strategy: ${strategy}`);
    }
}
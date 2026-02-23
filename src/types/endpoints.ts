export type Endpoint = {
    path: string,
    strategy: 'round-robin' | 'least-connections' | 'ip-hash',
    upstreams: string[] //array of upstream ids, we will match these ids with the upstreams defined in the config file and then forward the request to the corresponding upstream url
}
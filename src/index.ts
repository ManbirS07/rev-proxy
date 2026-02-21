import { program } from 'commander'; // to work with the cli
import { loadConfig, validateConfig } from './config.js';

async function main() {
    program.option('--config <path>') //asking for the config file path
    program.parse(); //parsing the command line arguments

    const options = program.opts(); 
    //if valid config path provided, parse and validate it
    if(options && options.config) {
        const receivedConfigFile = await loadConfig(options.config); //load the config file
        const validatedConfig = await validateConfig(receivedConfigFile); //validate the config file
        console.log('Validated Config:', validatedConfig);
    }
}

main()
// docker-compose → starts rev-proxy container
// rev-proxy container → runs the Node app
// Node app → reads config.yaml
// config.yaml → tells proxy how to route

// Docker does NOT read config.yaml
// Node app reads config.yaml -> which is inside the rev proxy container

// flow
// Browser →  PC port 8000
// Docker forwards → rev-proxy container port 8000
// Node app is listening on 8000 
// Proxy sees the routing in node app
// Proxy forwards to server1:8001 etc
// Docker DNS resolves server names
// 7Response comes back
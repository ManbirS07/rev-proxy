import yaml from 'js-yaml';
import { promises as fs } from 'fs'
import rootConfigSchema from './config-schema.js';

export async function loadConfig(filePath: string) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const config = yaml.load(fileContent) as object //directly returns a javascript object
        return config //to remove any undefined values from the config object, because yaml.load can return undefined for missing fields, and we want to ensure that our config object only contains defined values.
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}

//user apni khud ki config.yaml file bana ke usme apni settings daal sakta hai, jaise ki database connection details, API keys, etc. Aur phir us file ka path loadConfig function me pass karke config ko load kar sakta hai.
//toh we need to validate the config file before using it, we can create a function that checks if the required fields are present in the config object and if they have the correct data types.
// This way we can ensure that our application has all the necessary information to run properly.
export async function validateConfig(config: object) {
    const validatedSchema = await rootConfigSchema.parseAsync(config);
    return validatedSchema;
}
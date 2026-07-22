import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function curlCffiFetch(url, headers = {}) {
    try {
        const scriptPath = path.join(__dirname, 'python', 'curl_cffi_fetcher.py');
        const isWin = process.platform === 'win32';
        let pythonExecutable = isWin 
            ? path.join(__dirname, '..', '..', 'venv', 'Scripts', 'python.exe')
            : path.join(__dirname, '..', '..', 'venv', 'bin', 'python');
            
        if (!fs.existsSync(pythonExecutable)) {
            pythonExecutable = isWin ? 'python' : 'python3';
        }
        
        // Escape arguments properly for shell execution
        const escapedUrl = `"${url.replace(/"/g, '\\"')}"`;
        const escapedHeaders = `"${JSON.stringify(headers).replace(/"/g, '\\"')}"`;
        
        const command = `"${pythonExecutable}" "${scriptPath}" ${escapedUrl} ${escapedHeaders}`;
        
        const out = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
        const data = JSON.parse(out);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
    } catch (e) {
        console.error('curlCffiFetch Error:', e.message);
        throw e;
    }
}

/**
 * Call a tool on the Astrato MCP server from the command line.
 *
 *   ASTRATO_MCP_URL=https://<your-tenant-host>/mcp ASTRATO_PAT=<token> node tools/mcp.mjs <tool> '<json-args>'
 *   node tools/mcp.mjs <tool> @args.json      # read the arguments from a file
 *   node tools/mcp.mjs                        # list the tool names
 *
 * ASTRATO_PAT is a personal access token with the scopes the tool needs (sl:write for layer
 * authoring, data:query for queries). It is read from the environment and never printed.
 */
import { readFileSync } from 'node:fs';

const URL_MCP = process.env.ASTRATO_MCP_URL;
const token = process.env.ASTRATO_PAT;
if (!URL_MCP || !token) throw new Error('Set ASTRATO_MCP_URL (your tenant\'s /mcp endpoint) and ASTRATO_PAT.');

let session;
let id = 0;
const headers = () => ({
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${token}`,
  ...(session ? { 'mcp-session-id': session } : {}),
});

async function rpc(method, params) {
  const response = await fetch(URL_MCP, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  session ??= response.headers.get('mcp-session-id') ?? undefined;
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
  const payload = dataLine ? JSON.parse(dataLine.slice(5)) : JSON.parse(text);
  if (payload.error) throw new Error(`${method} -> ${JSON.stringify(payload.error).slice(0, 400)}`);
  return payload.result;
}

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'astrato-playbook-cli', version: '1.0.0' } });
await fetch(URL_MCP, { method: 'POST', headers: headers(), body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });

const [tool, rawArgs] = process.argv.slice(2);
if (!tool) {
  const { tools } = await rpc('tools/list', {});
  console.log(tools.map((entry) => entry.name).join('\n'));
} else {
  const argsText = rawArgs?.startsWith('@') ? readFileSync(rawArgs.slice(1), 'utf8') : rawArgs;
  const result = await rpc('tools/call', { name: tool, arguments: argsText ? JSON.parse(argsText) : {} });
  const body = result.content?.find((item) => item.type === 'text')?.text ?? JSON.stringify(result);
  if (result.isError) {
    console.error('REFUSED:', body);
    process.exitCode = 1;
  } else {
    console.log(body);
  }
}

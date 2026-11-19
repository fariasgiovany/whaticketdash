import { createInterface } from "node:readline";

const base = process.env.WHATICKET_URL?.replace(/\/+$/, "");
let token;
let tokenExpires = 0;

function configuration() {
  if (!base || !process.env.WHATICKET_EMAIL || !process.env.WHATICKET_PASSWORD) {
    throw new Error("Configure WHATICKET_URL, WHATICKET_EMAIL e WHATICKET_PASSWORD no ambiente do cliente MCP.");
  }
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\]|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})$/.test(url.hostname))) {
    throw new Error("Use HTTPS ou HTTP apenas em localhost/IP da rede Headscale (100.64.0.0/10).");
  }
}

async function login() {
  configuration();
  const response = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.WHATICKET_EMAIL, password: process.env.WHATICKET_PASSWORD })
  });
  if (!response.ok) throw new Error(`Login falhou (HTTP ${response.status}).`);
  const data = await response.json();
  if (!data.token) throw new Error("Login não retornou token.");
  token = data.token;
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  tokenExpires = payload.exp ? payload.exp * 1000 : Date.now() + 10 * 60 * 1000;
}

async function api(method, path, body) {
  configuration();
  if (!token || Date.now() > tokenExpires - 60_000) await login();
  const request = () => fetch(`${base}${path}`, {
    method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let response = await request();
  if (response.status === 401 || response.status === 403) { await login(); response = await request(); }
  if (!response.ok) throw new Error(`Whaticket retornou HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.status === 204 ? { ok: true } : response.json();
}

const integer = { type: "integer", minimum: 1 };
const tools = [
  { name: "listar_tickets", description: "Lista tickets visíveis para a conta configurada.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "pending", "closed"] }, busca: { type: "string" }, pagina: integer }, additionalProperties: false } },
  { name: "ver_ticket", description: "Mostra um ticket por ID.", inputSchema: { type: "object", properties: { id: integer }, required: ["id"], additionalProperties: false } },
  { name: "editar_ticket", description: "Altera status, fila ou responsável de um ticket existente. Fechar um ticket pode enviar mensagem de despedida.", inputSchema: { type: "object", properties: { id: integer, status: { type: "string", enum: ["open", "pending", "closed"] }, queueId: integer, userId: integer }, required: ["id"], additionalProperties: false } },
  { name: "listar_cards", description: "Lista todas as listas e cards do quadro.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "criar_card", description: "Cria um card no quadro.", inputSchema: { type: "object", properties: { title: { type: "string", minLength: 1 }, tag: { type: "string" }, listId: integer }, required: ["title"], additionalProperties: false } },
  { name: "editar_card", description: "Altera um card. Concluir um card ligado a ticket pode fechar o ticket e enviar mensagem de despedida.", inputSchema: { type: "object", properties: { id: integer, title: { type: "string", minLength: 1 }, tag: { type: "string" }, listId: { anyOf: [integer, { type: "null" }] }, completed: { type: "boolean" }, position: { type: "number" } }, required: ["id"], additionalProperties: false } },
  { name: "comentar_card", description: "Adiciona comentário a um card.", inputSchema: { type: "object", properties: { id: integer, body: { type: "string", minLength: 1 } }, required: ["id", "body"], additionalProperties: false } }
];

function validate(name, args) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}`);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Argumentos inválidos.");
  for (const field of tool.inputSchema.required || []) if (args[field] === undefined) throw new Error(`Falta ${field}.`);
  for (const [key, value] of Object.entries(args)) {
    const spec = tool.inputSchema.properties[key];
    if (!spec) throw new Error(`Campo não permitido: ${key}`);
    if (value === null && spec.anyOf) continue;
    const type = spec.anyOf ? spec.anyOf[0].type : spec.type;
    if (type === "integer" && (!Number.isSafeInteger(value) || value < 1)) throw new Error(`${key} deve ser um inteiro positivo.`);
    if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`${key} deve ser um número.`);
    if (type === "boolean" && typeof value !== "boolean") throw new Error(`${key} deve ser booleano.`);
    if (type === "string" && (typeof value !== "string" || (spec.minLength && !value.trim()))) throw new Error(`${key} deve ser texto válido.`);
    if (spec.enum && !spec.enum.includes(value)) throw new Error(`${key} inválido.`);
  }
  if (["editar_ticket", "editar_card"].includes(name) && Object.keys(args).length === 1) throw new Error("Informe ao menos um campo para alterar.");
  return args;
}

async function call(name, input) {
  const { id, ...args } = validate(name, input);
  switch (name) {
    case "listar_tickets": {
      const query = new URLSearchParams();
      const queues = await api("GET", "/queue");
      if (Array.isArray(queues)) query.set("queueIds", JSON.stringify(queues.map(queue => queue.id)));
      if (args.status) query.set("status", args.status);
      if (args.busca) query.set("searchParam", args.busca);
      if (args.pagina) query.set("pageNumber", String(args.pagina));
      return api("GET", `/tickets?${query}`);
    }
    case "ver_ticket": return api("GET", `/tickets/${id}`);
    case "editar_ticket": return api("PUT", `/tickets/${id}`, args);
    case "listar_cards": return api("GET", "/cards");
    case "criar_card": return api("POST", "/cards", args);
    case "editar_card": return api("PUT", `/cards/${id}`, args);
    case "comentar_card": return api("POST", `/cards/${id}/comments`, args);
  }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.id === undefined) continue;
    let result;
    if (request.method === "initialize") result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "whaticket-mcp", version: "0.1.0" } };
    else if (request.method === "ping") result = {};
    else if (request.method === "tools/list") result = { tools };
    else if (request.method === "tools/call") {
      try { result = { content: [{ type: "text", text: JSON.stringify(await call(request.params?.name, request.params?.arguments || {})) }] }; }
      catch (error) { result = { content: [{ type: "text", text: error.message }], isError: true }; }
    } else throw new Error(`Método desconhecido: ${request.method}`);
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
  } catch (error) {
    if (request?.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32600, message: error.message } }) + "\n");
  }
}

const http = require('http');
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
const PORT = 3333;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

// ── tool definitions exposed to Claude ──────────────────────────────────────

const TOOLS = [
  {
    name: 'execute_sql',
    description: 'Execute any SQL against the Cortex database. Use for SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE, CREATE INDEX. Returns rows for queries, row count for mutations.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The SQL to execute' },
        note:  { type: 'string', description: 'Brief plain-text description of what this does (shown to user)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_schema',
    description: 'List all tables in the database with their column names and types.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'write_memory',
    description: 'Create or update a memory thread (knowledge note).',
    input_schema: {
      type: 'object',
      properties: {
        id:      { type: 'string', description: 'Unique slug ID for this thread (e.g. "sales-methodology")' },
        title:   { type: 'string' },
        tag:     { type: 'string', description: 'Category: Research, Sales, System, CRM, Personal, Wiki, etc.' },
        content: { type: 'string', description: 'The knowledge content to store' },
      },
      required: ['id', 'title', 'content'],
    },
  },
  {
    name: 'write_wiki',
    description: 'Create or update a wiki page in the wiki_pages table. Creates the table if it does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        slug:     { type: 'string', description: 'URL-safe slug (e.g. "onboarding-guide")' },
        title:    { type: 'string' },
        category: { type: 'string' },
        body:     { type: 'string', description: 'Full wiki page content in plain text' },
      },
      required: ['slug', 'title', 'body'],
    },
  },
  {
    name: 'read_table',
    description: 'Read rows from any table. Optionally filter by a column value.',
    input_schema: {
      type: 'object',
      properties: {
        table:        { type: 'string' },
        limit:        { type: 'number', description: 'Max rows to return (default 20)' },
        filter_col:   { type: 'string' },
        filter_val:   { type: 'string' },
      },
      required: ['table'],
    },
  },
];

// ── tool executor ────────────────────────────────────────────────────────────

async function runTool(name, input) {
  const client = await pool.connect();
  try {
    if (name === 'list_schema') {
      const { rows } = await client.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);
      const schema = {};
      for (const r of rows) {
        if (!schema[r.table_name]) schema[r.table_name] = [];
        schema[r.table_name].push(`${r.column_name} (${r.data_type})`);
      }
      return JSON.stringify(schema, null, 2);
    }

    if (name === 'execute_sql') {
      const { rows, rowCount, command } = await client.query(input.query);
      if (rows.length > 0) return JSON.stringify(rows.slice(0, 50), null, 2);
      return `${command} — ${rowCount} row(s) affected`;
    }

    if (name === 'read_table') {
      const limit = input.limit ?? 20;
      let q = `SELECT * FROM "${input.table}" LIMIT ${limit}`;
      if (input.filter_col && input.filter_val) {
        q = `SELECT * FROM "${input.table}" WHERE "${input.filter_col}" = $1 LIMIT ${limit}`;
        const { rows } = await client.query(q, [input.filter_val]);
        return JSON.stringify(rows, null, 2);
      }
      const { rows } = await client.query(q);
      return JSON.stringify(rows, null, 2);
    }

    if (name === 'write_memory') {
      const now = new Date().toISOString();
      await client.query(`
        INSERT INTO memory_threads (id, title, tag, atoms, updated_at)
        VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (id) DO UPDATE SET title=$2, tag=$3, updated_at=$4
      `, [input.id, input.title, input.tag ?? 'General', now]);

      // store content as a kb_atom if the table exists
      try {
        await client.query(`
          INSERT INTO kb_atoms (thread_id, content) VALUES ($1, $2)
        `, [input.id, input.content]);
        await client.query(`
          UPDATE memory_threads SET atoms = (
            SELECT COUNT(*) FROM kb_atoms WHERE thread_id = $1
          ) WHERE id = $1
        `, [input.id]);
      } catch (_) { /* kb_atoms may not exist yet */ }

      return `Memory thread "${input.title}" saved with id "${input.id}"`;
    }

    if (name === 'write_wiki') {
      // ensure wiki_pages table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS wiki_pages (
          slug text primary key,
          title text not null,
          category text,
          body text not null,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        )
      `);
      const now = new Date().toISOString();
      await client.query(`
        INSERT INTO wiki_pages (slug, title, category, body, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO UPDATE SET title=$2, category=$3, body=$4, updated_at=$5
      `, [input.slug, input.title, input.category ?? 'General', input.body, now]);
      return `Wiki page "${input.title}" saved at slug "${input.slug}"`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err.message}`;
  } finally {
    client.release();
  }
}

// ── agentic loop: run Claude + tools until end_turn ─────────────────────────

async function runAgent(messages, systemPrompt) {
  let current = [...messages];
  let finalText = '';

  for (let i = 0; i < 10; i++) { // max 10 tool rounds
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages: current,
    });

    const apiRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      }, resolve);
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    let raw = '';
    await new Promise((resolve) => { apiRes.on('data', c => raw += c); apiRes.on('end', resolve); });
    const data = JSON.parse(raw);

    if (data.error) throw new Error(data.error.message);

    // add assistant turn to history
    current.push({ role: 'assistant', content: data.content });

    if (data.stop_reason === 'end_turn') {
      finalText = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
      break;
    }

    if (data.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;
        const result = await runTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
      current.push({ role: 'user', content: toolResults });
    }
  }

  return finalText;
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }

  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    try {
      const { messages, system } = JSON.parse(body);
      const reply = await runAgent(messages, system);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: reply }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => console.log(`Cortex proxy + tools running on http://localhost:${PORT}`));

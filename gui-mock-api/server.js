import path from 'path';
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import bodyParser from 'body-parser';
import createError from 'http-errors';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

import { buildRuntimeRouter } from './router-runtime.js';
import {
  allEndpoints,
  getEndpoint,
  upsertEndpoint,
  deleteEndpoint,
  listVars,
  upsertVar,
  deleteVar,
  listLogs,
  getLog
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ADMIN_TOKEN || process.env.ADMIN_SECRET || '';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return next();
  }

  const provided = req.query.key || req.get('x-admin-key');
  if (provided && provided === ADMIN_KEY) {
    res.locals.adminKey = provided;
    return next();
  }

  if (req.accepts('json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(401).send('Unauthorized');
}

function endpointDefaults() {
  return {
    id: '',
    name: '',
    description: '',
    method: 'GET',
    path: '/',
    enabled: true,
    match_headers: '{}',
    response_status: 200,
    response_headers: '{}',
    response_body: '',
    response_is_json: false,
    response_delay_ms: 0,
    template_enabled: false
  };
}

function persistAdminKey(req) {
  const key = req.query.key || req.body?.key;
  return key ? `?key=${encodeURIComponent(key)}` : '';
}

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin', requireAdmin, (req, res) => {
  const list = allEndpoints();
  res.render('admin_list', { list, query: req.query });
});

app.get('/admin/new', requireAdmin, (req, res) => {
  const endpoint = { ...endpointDefaults(), id: nanoid(12) };
  res.render('admin_edit', {
    title: 'Create Endpoint',
    endpoint,
    route: endpoint,
    query: req.query
  });
});

app.get('/admin/:id/edit', requireAdmin, (req, res) => {
  const endpoint = getEndpoint(req.params.id);
  if (!endpoint) {
    return res.status(404).send('Not found');
  }

  res.render('admin_edit', {
    title: 'Edit Endpoint',
    endpoint,
    route: endpoint,
    query: req.query
  });
});

app.post('/admin/save', requireAdmin, (req, res) => {
  const keyQuery = persistAdminKey(req);
  const payload = {
    id: req.body.id || nanoid(12),
    name: (req.body.name || '').trim(),
    description: (req.body.description || '').trim(),
    method: (req.body.method || 'GET').toUpperCase(),
    path: req.body.path || '/',
    enabled: ['true', 'on', '1', 'yes'].includes(String(req.body.enabled).toLowerCase()),
    match_headers: String(req.body.match_headers || '{}'),
    response_status: Number(req.body.response_status || 200),
    response_headers: String(req.body.response_headers || '{}'),
    response_body: String(req.body.response_body ?? ''),
    response_is_json: ['true', 'on', '1', 'yes'].includes(String(req.body.response_is_json).toLowerCase()),
    response_delay_ms: Number(req.body.response_delay_ms || 0),
    template_enabled: ['true', 'on', '1', 'yes'].includes(String(req.body.template_enabled).toLowerCase())
  };

  upsertEndpoint(payload);
  res.redirect(`/admin${keyQuery}`);
});

app.post('/admin/:id/delete', requireAdmin, (req, res) => {
  const endpoint = getEndpoint(req.params.id);
  if (endpoint) {
    deleteEndpoint(endpoint.id);
  }
  const keyQuery = persistAdminKey(req);
  res.redirect(`/admin${keyQuery}`);
});

// Variables CRUD
app.get('/admin/:id/vars', requireAdmin, (req, res) => {
  const e = getEndpoint(req.params.id);
  if (!e) return res.status(404).send('Not found');
  const vars = listVars(e.id);
  res.render('admin_vars', { e, vars, query: req.query });
});

app.post('/admin/:id/vars/save', requireAdmin, (req, res) => {
  const e = getEndpoint(req.params.id);
  if (!e) return res.status(404).send('Not found');
  const entries = Array.isArray(req.body.k)
    ? req.body.k.map((k, i) => ({ k, v: req.body.v[i] }))
    : [{ k: req.body.k, v: req.body.v }];
  for (const {k, v} of entries) {
    if (!k) continue;
    upsertVar({ id: nanoid(12), endpoint_id: e.id, k: String(k), v: String(v ?? '') });
  }
  res.redirect(`/admin/${e.id}/vars?key=${encodeURIComponent(req.query.key || '')}`);
});

app.post('/admin/:id/vars/delete', requireAdmin, (req, res) => {
  const e = getEndpoint(req.params.id);
  if (!e) return res.status(404).send('Not found');
  const k = String(req.body.k || '');
  if (k) deleteVar(e.id, k);
  res.redirect(`/admin/${e.id}/vars?key=${encodeURIComponent(req.query.key || '')}`);
});

// Logs
app.get('/admin/:id/logs', requireAdmin, (req, res) => {
  const e = getEndpoint(req.params.id);
  if (!e) return res.status(404).send('Not found');
  const page = Number(req.query.page || 1);
  const limit = 50, offset = (page - 1) * limit;
  const logs = listLogs(e.id, limit, offset);
  res.render('admin_logs', { e, logs, page, query: req.query });
});

app.get('/admin/logs/:logId', requireAdmin, (req, res) => {
  const log = getLog(req.params.logId);
  if (!log) return res.status(404).send('Not found');
  res.render('admin_log_detail', { log, query: req.query });
});

app.use(buildRuntimeRouter());

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status);
  if (req.accepts('json')) {
    res.json({ error: err.message || 'Unknown error' });
    return;
  }

  res.render('admin_edit', {
    title: `Error ${status}`,
    route: null,
    error: err,
    query: req.query
  });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`GUI Mock API server listening on port ${PORT}`);
  });
}

export default app;

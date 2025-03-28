const express = require('express');
const bodyParser = require('body-parser');
const mustacheExpress = require('mustache-express');
const { Client } = require('pg');
const { parse } = require('pg-connection-string');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

let client = null;
let dbReady = false;
const PORT = process.env.PORT || 8080;

const run = async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const config = parse(dbUrl);

      if (config.host.includes("amazonaws.com")) {
        config.ssl = { rejectUnauthorized: false };
      }

      client = new Client(config);
      await client.connect();
      dbReady = true;
      console.log('✅ Connected to the database.');
    } else {
      console.warn('⚠️ DATABASE_URL is not set. Running without database.');
    }

    app.listen(PORT, () => {
      console.log('🚀 Server started on PORT ${PORT}');
    });
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
};

// Health check route
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Root route
app.get('/', async (req, res) => {
  if (!dbReady) return res.status(503).send('Database not connected.');
  try {
    const result = await client.query('SELECT DESCRIPTION FROM TASKS');
    const alltasks = { tasks: result.rows };
    res.render('main', alltasks);
    console.log('📋 Displaying ${alltasks.tasks.length} tasks.');
  } catch (e) {
    console.error('❌ Error in GET /:', e);
    res.status(500).send('Internal server error');
  }
});

// Add task route
app.post('/task', async (req, res) => {
  if (!dbReady) return res.status(503).send('Database not connected.');

  const taskDescription = req.body.task;
  try {
    await client.query('INSERT INTO tasks (DESCRIPTION) VALUES ($1)', [taskDescription]);
    console.log('➕ Added task "${taskDescription}"');
    res.redirect('/');
  } catch (e) {
    console.error('❌ Error adding task:', e);
    res.sendStatus(500);
  }
});

run();

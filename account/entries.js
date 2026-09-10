const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "LedgerEntries";
const PARTITION_KEY = "entry"; // single partition is fine at this scale

function getTableClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  return TableClient.fromConnectionString(connectionString, TABLE_NAME, {
    allowInsecureConnection: false,
  });
}

async function ensureTable(client) {
  await client.createTable().catch((err) => {
    // 409 = table already exists, which is fine
    if (err.statusCode !== 409) throw err;
  });
}

// GET /api/entries - list all entries
app.http("getEntries", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "entries",
  handler: async (request, context) => {
    const client = getTableClient();
    await ensureTable(client);

    const entries = [];
    for await (const entity of client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    })) {
      entries.push({
        id: entity.rowKey,
        amount: entity.amount,
        category: entity.category,
        timestamp: entity.timestamp,
      });
    }
    entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return { jsonBody: entries };
  },
});

// POST /api/entries - create an entry. Body: { amount, category }
app.http("createEntry", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "entries",
  handler: async (request, context) => {
    const body = await request.json();
    const amount = Number(body.amount);
    const category = String(body.category || "");

    if (!amount || !category) {
      return { status: 400, jsonBody: { error: "amount (non-zero) and category are required" } };
    }

    const client = getTableClient();
    await ensureTable(client);

    const rowKey = Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8);
    const timestamp = new Date().toISOString();

    await client.createEntity({
      partitionKey: PARTITION_KEY,
      rowKey,
      amount,
      category,
      timestamp,
    });

    return { status: 201, jsonBody: { id: rowKey, amount, category, timestamp } };
  },
});

// PATCH /api/entries/{id} - edit an entry's amount and/or category.
// Amount may be negative to record a refund/partial payback against a category
// without deleting the original entry's history.
app.http("updateEntry", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "entries/{id}",
  handler: async (request, context) => {
    const id = request.params.id;
    const client = getTableClient();
    await ensureTable(client);

    let existing;
    try {
      existing = await client.getEntity(PARTITION_KEY, id);
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: "Entry not found" } };
      }
      throw err;
    }

    const body = await request.json();
    const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;
    const category = body.category !== undefined ? String(body.category) : existing.category;

    if (!amount || !category) {
      return { status: 400, jsonBody: { error: "amount (non-zero) and category are required" } };
    }

    await client.updateEntity(
      {
        partitionKey: PARTITION_KEY,
        rowKey: id,
        amount,
        category,
        timestamp: existing.timestamp,
      },
      "Replace"
    );

    return { status: 200, jsonBody: { id, amount, category, timestamp: existing.timestamp } };
  },
});

// DELETE /api/entries/{id} - remove an entry
app.http("deleteEntry", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "entries/{id}",
  handler: async (request, context) => {
    const id = request.params.id;
    const client = getTableClient();
    await ensureTable(client);

    await client.deleteEntity(PARTITION_KEY, id).catch((err) => {
      if (err.statusCode !== 404) throw err;
    });

    return { status: 204 };
  },
});

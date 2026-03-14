// One-time script to create the places_vectors collection in Astra
// Run with: node scripts/init-astra.mjs

import { readFileSync } from "fs";
import { resolve } from "path";
import { DataAPIClient } from "@datastax/astra-db-ts";

// Read .env manually
const env = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
const vars = Object.fromEntries(
  env
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [
        l.slice(0, idx).trim(),
        l
          .slice(idx + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);

const TOKEN = vars.ASTRA_DB_APPLICATION_TOKEN;
const ENDPOINT = vars.ASTRA_API_ENDPOINT;
const KEYSPACE = vars.ASTRA_DB_KEYSPACE || "default_keyspace";

if (!TOKEN || !ENDPOINT) {
  console.error(
    "Missing ASTRA_DB_APPLICATION_TOKEN or ASTRA_API_ENDPOINT in .env",
  );
  process.exit(1);
}

const url = `${ENDPOINT}/api/json/v1/${KEYSPACE}`;

async function createCollection(name, dimension) {
  console.log(`\nCreating collection "${name}" (${dimension} dims)...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cassandra-token": TOKEN,
      Token: TOKEN,
    },
    body: JSON.stringify({
      createCollection: {
        name,
        options: {
          vector: {
            dimension,
            metric: "cosine",
          },
        },
      },
    }),
  });

  const data = await res.json();
  if (data.status?.ok === 1) {
    console.log(`✓ Collection "${name}" created successfully.`);
  } else if (JSON.stringify(data).includes("already")) {
    console.log(`✓ Collection "${name}" already exists.`);
  } else {
    console.error(
      `✗ Failed to create collection:`,
      JSON.stringify(data, null, 2),
    );
  }
}

async function listCollections() {
  console.log("\nListing existing collections...");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cassandra-token": TOKEN,
      Token: TOKEN,
    },
    body: JSON.stringify({ findCollections: {} }),
  });
  const data = await res.json();
  console.log(
    "Collections:",
    JSON.stringify(data?.status?.collections ?? data, null, 2),
  );
}

// --- helper functions ------------------------------------------------------
// The REST API for Astra doesn’t support a generic `delete` command; the
// previous implementation attempted to send `{ delete: { … } }` and failed with
// "Provided command unknown".  Instead we’ll use the official SDK which has
// convenient methods for removing documents.

const sdkClient = new DataAPIClient(TOKEN);
const sdkDb = sdkClient.db(ENDPOINT, { keyspace: KEYSPACE });

/**
 * Delete a single document by matching field value.
 *
 * @param collection name of the collection (e.g. "places_vectors")
 * @param idField field to filter on (e.g. "place_id")
 * @param id value to match
 */
async function deleteDocumentById(collection, idField, id) {
  console.log(
    `\nDeleting document from "${collection}" where ${idField}=${id}`,
  );
  const coll = sdkDb.collection(collection);
  const res = await coll.deleteOne({ [idField]: id });
  console.log("SDK deleteOne result:", res);
  return res;
}

/**
 * Clear all documents in the given collection. (Does not drop the collection.)
 */
async function deleteAllDocuments(collection) {
  console.log(`\nDeleting all documents from "${collection}"`);
  const coll = sdkDb.collection(collection);
  const res = await coll.deleteMany({});
  console.log("SDK deleteMany result:", res);
  return res;
}

// ---------------------------------------------------------------
// run helpers below when needed (uncomment to execute)
// ---------------------------------------------------------------
// example: delete a specific place by its `place_id` field
// await deleteDocumentById("places_vectors", "place_id", "13");
//
// example: wipe the collection entirely
await deleteAllDocuments("places_vectors");

// await listCollections();
// await createCollection("places_vectors", 3072);
// await listCollections();

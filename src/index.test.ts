import { expect, describe, it } from 'vitest';
import { tomlJSONPathReplacer, JSONPath } from './index';

type Replacements = Array<{ path: JSONPath, value: unknown }>;

const toml = `
# Top-level configuration
name = "my-worker"
main = "src/index.js"
"compatibility_date" = "2022-07-12"

workers_dev = false

# route comment top
route = { pattern = "example.org/*", zone_name = "example.org" } # route comment inline

# kv comment top
kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # kv comment inline
]

queues.producers = [
  { binding = "<BINDING_NAME1>", queue = "<QUEUE_NAME1>" } # inline queue comment
]

# table comment top
[limits] # table comment on key
cpu_ms = 100 # table comment on body

# db comment top
[[d1_databases]] # db comment on key
binding = "<BINDING_NAME_1>" # db comment on body
database_name = "<DATABASE_NAME_1>"
database_id = "<DATABASE_ID_1>"

[[d1_databases]]
binding = "<BINDING_NAME_2>" # second db
database_name = "<DATABASE_NAME_2>"
database_id = "<DATABASE_ID_3>"

[[r2_buckets]]
binding = "<BINDING_NAME1>"
bucket_name = "<BUCKET_NAME1>"

[[r2_buckets]]
binding = "<BINDING_NAME2>"
bucket_name = "<BUCKET_NAME2>"

[env.staging]
# Overrides above
name = "my-worker-staging"
route = { pattern = "staging.example.org/*", zone_name = "example.org" }

kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<STAGING_KV_ID>" }
]

[env.production]
name = "<PROD_WORKER_NAME>"

[env.production.limits]
cpu_ms = 500

[[env.production.d1_databases]]
binding = "<BINDING_NAME_1>" # first db
database_name = "<DATABASE_NAME_1>"
database_id = "<DATABASE_ID_1>"
`;

describe('tomlJSONPathReplacer', () => {

  it('performs targeted replacements of complex values', () => {

    const replacements: Replacements = [
      { // inline table
        path: ['route'],
        value: { pattern: 'example.com/*', zone_name: 'example_com' },
      },
      { // array
        path: ['kv_namespaces'],
        value: [
          {
            binding: 'KV_NAMESPACE_1',
            id: 'kv-namespace-id-1',
          },
          {
            binding: 'KV_NAMESPACE_2',
            id: 'kv-namespace-id-2',
          },
        ],
      },
      { // table
        path: ['limits'],
        value: { cpu_ms: 200 },
      },
      { // table array
        path: ['d1_databases'],
        value: [
          {
            binding: 'DB_1',
            database_name: 'db-1-name',
            database_id: 'db-1-id',
          },
        ],
      },
      { // table array element
        path: ['r2_buckets', 1],
        value: {
          binding: 'BUCKET_2',
          bucket_name: 'bucket-2',
        },
      },
      { // table array element
        path: ['queues', 'producers', 0],
        value: {
          binding: 'QUEUE_1',
          bucket_name: 'queue-1',
        },
      },
      { // nested inline table
        path: ['env', 'staging', 'route'],
        value: { pattern: 'example.com/*', zone_name: 'example_com' },
      },
      { // nested array
        path: ['env', 'staging', 'kv_namespaces'],
        value: [
          {
            binding: 'KV_NAMESPACE_1',
            id: 'kv-namespace-id-1',
          },
          {
            binding: 'KV_NAMESPACE_2',
            id: 'kv-namespace-id-2',
          },
        ],
      },
      { // nested table
        path: ['env', 'production', 'limits'],
        value: { cpu_ms: 200 },
      },
      { // nested table array
        path: ['env', 'production', 'd1_databases', 0],
        value: {
          binding: 'DB_1',
          database_name: 'db-1-name',
          database_id: 'db-1-id',
        },
      },
    ];

    const updatedTOML = replacements.reduce(
      (newTOML, { path, value }) => tomlJSONPathReplacer(newTOML, path, value),
      toml,
    );
    expect(updatedTOML).toMatchInlineSnapshot(`
      "
      # Top-level configuration
      name = "my-worker"
      main = "src/index.js"
      "compatibility_date" = "2022-07-12"

      workers_dev = false

      # route comment top
      route = { pattern = "example.com/*", zone_name = "example_com" } # route comment inline

      # kv comment top
      kv_namespaces = [
        { binding = "KV_NAMESPACE_1", id = "kv-namespace-id-1" },
        { binding = "KV_NAMESPACE_2", id = "kv-namespace-id-2" }
      ]

      queues.producers = [
        { binding = "QUEUE_1", bucket_name = "queue-1" } # inline queue comment
      ]

      # table comment top
      [limits]
      cpu_ms = 200 # table comment on body

      # db comment top

      [[d1_databases]]
      binding = "DB_1"
      database_name = "db-1-name"
      database_id = "db-1-id"

      [[r2_buckets]]
      binding = "<BINDING_NAME1>"
      bucket_name = "<BUCKET_NAME1>"

      [[r2_buckets]]
      binding = "BUCKET_2"
      bucket_name = "bucket-2"

      [env.staging]
      # Overrides above
      name = "my-worker-staging"
      route = { pattern = "example.com/*", zone_name = "example_com" }

      kv_namespaces = [
        { binding = "KV_NAMESPACE_1", id = "kv-namespace-id-1" },
        { binding = "KV_NAMESPACE_2", id = "kv-namespace-id-2" }
      ]

      [env.production]
      name = "<PROD_WORKER_NAME>"

      [env.production.limits]
      cpu_ms = 200

      [[env.production.d1_databases]]
      binding = "DB_1"
      database_name = "db-1-name"
      database_id = "db-1-id"
      "
    `);

  });

  it('performs targeted replacements of scalar values', () => {

    const replacements: Replacements = [
      {
        path: ['name'],
        value: 'my-new-worker',
      },
      {
        path: ['compatibility_date'],
        value: '2025-04-25',
      },
      {
        path: ['workers_dev'],
        value: true,
      },
      {
        path: ['route', 'pattern'],
        value: 'example.com/*',
      },
      {
        path: ['route', 'zone_name'],
        value: 'example.com',
      },
      {
        path: ['limits', 'cpu_ms'],
        value: 50,
      },
      {
        path: ['kv_namespaces', 0, 'id'],
        value: 'new-kv-id',
      },
      {
        path: ['d1_databases', 1, 'database_name'],
        value: 'new-db-name',
      },
      {
        path: ['env', 'staging', 'route', 'pattern'],
        value: 'api.staging.example.org/*',
      },
      {
        path: ['env', 'staging', 'kv_namespaces', 0, 'id'],
        value: 'new-staging-id',
      },
    ];

    const updatedTOML = replacements.reduce(
      (newTOML, { path, value }) => tomlJSONPathReplacer(newTOML, path, value),
      toml,
    );
    expect(updatedTOML).toMatchInlineSnapshot(`
      "
      # Top-level configuration
      name = "my-new-worker"
      main = "src/index.js"
      "compatibility_date" = "2025-04-25"

      workers_dev = true

      # route comment top
      route = { pattern = "example.com/*", zone_name = "example.com" } # route comment inline

      # kv comment top
      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "new-kv-id" } # kv comment inline
      ]

      queues.producers = [
        { binding = "<BINDING_NAME1>", queue = "<QUEUE_NAME1>" } # inline queue comment
      ]

      # table comment top
      [limits] # table comment on key
      cpu_ms = 50 # table comment on body

      # db comment top
      [[d1_databases]] # db comment on key
      binding = "<BINDING_NAME_1>" # db comment on body
      database_name = "<DATABASE_NAME_1>"
      database_id = "<DATABASE_ID_1>"

      [[d1_databases]]
      binding = "<BINDING_NAME_2>" # second db
      database_name = "new-db-name"
      database_id = "<DATABASE_ID_3>"

      [[r2_buckets]]
      binding = "<BINDING_NAME1>"
      bucket_name = "<BUCKET_NAME1>"

      [[r2_buckets]]
      binding = "<BINDING_NAME2>"
      bucket_name = "<BUCKET_NAME2>"

      [env.staging]
      # Overrides above
      name = "my-worker-staging"
      route = { pattern = "api.staging.example.org/*", zone_name = "example.org" }

      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "new-staging-id" }
      ]

      [env.production]
      name = "<PROD_WORKER_NAME>"

      [env.production.limits]
      cpu_ms = 500

      [[env.production.d1_databases]]
      binding = "<BINDING_NAME_1>" # first db
      database_name = "<DATABASE_NAME_1>"
      database_id = "<DATABASE_ID_1>"
      "
    `);
  });

  it('performs insertions when the path does not exist', () => {

    const replacements: Replacements = [
      { // new table item
        path: ['route', 'zone_id'],
        value: 'my-zone-id',
      },
      { // new array element
        path: ['kv_namespaces', 1],
        value: {
          binding: 'KV_NAMESPACE_1',
          id: 'kv-namespace-id-1',
        },
      },
      { // new table item nested
        path: ['limits', 'foo', 'bar'],
        value: { a: 'b' },
      },
      { // new table
        path: ['assets'],
        value: { directory: './public', binding: 'ASSETS' },
      },
      { // new nested table item
        path: ['assets', 'run_worker_first'],
        value: [
          '/api/*',
          '!/api/docs/*',
        ],
      },
      { // new table array item
        path: ['d1_databases', 2],
        value: {
          binding: 'DB_3',
          database_name: 'db-3-name',
          database_id: 'db-3-id',
        },
      },
      { // table array nested
        path: ['d1_databases', 2, 'preview_database_id'],
        value: 'db-2-name',
      },
      { // very nested
        path: ['r2_buckets', 1, 'foo', 'bar'],
        value: {
          a: { b: 'c' },
        },
      },
      { // new array
        path: ['queues', 'consumers'],
        value: [
          {
            queue: 'queue-1',
          },
        ],
      },
      { // add to single line array
        path: ['queues', 'consumers', 1],
        value: {
          queue: 'queue-2',
        },
      },
      {
        path: ['env', 'dev'],
        value: {
          vars: { x: 'y' },
        },
      },
    ];

    const updatedTOML = replacements.reduce(
      (newTOML, { path, value }) => tomlJSONPathReplacer(newTOML, path, value),
      toml,
    );

    expect(updatedTOML).toMatchInlineSnapshot(`
      "
      # Top-level configuration
      name = "my-worker"
      main = "src/index.js"
      "compatibility_date" = "2022-07-12"

      workers_dev = false

      # route comment top
      route = { pattern = "example.org/*", zone_name = "example.org", zone_id = "my-zone-id" } # route comment inline

      # kv comment top
      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "<KV_ID>" },
      { binding = "KV_NAMESPACE_1", id = "kv-namespace-id-1" }]

      queues.producers = [
        { binding = "<BINDING_NAME1>", queue = "<QUEUE_NAME1>" } # inline queue comment
      ]

      # table comment top
      [limits] # table comment on key
      cpu_ms = 100
      foo.bar = { a = "b" } # table comment on body

      # db comment top
      [[d1_databases]] # db comment on key
      binding = "<BINDING_NAME_1>" # db comment on body
      database_name = "<DATABASE_NAME_1>"
      database_id = "<DATABASE_ID_1>"

      [[d1_databases]]
      binding = "<BINDING_NAME_2>" # second db
      database_name = "<DATABASE_NAME_2>"
      database_id = "<DATABASE_ID_3>"

      [[d1_databases]]
      binding = "DB_3"
      database_name = "db-3-name"
      database_id = "db-3-id"
      preview_database_id = "db-2-name"

      [[r2_buckets]]
      binding = "<BINDING_NAME1>"
      bucket_name = "<BUCKET_NAME1>"

      [[r2_buckets]]
      binding = "<BINDING_NAME2>"
      bucket_name = "<BUCKET_NAME2>"
      foo.bar = { a = { b = "c" } }

      [env.staging]
      # Overrides above
      name = "my-worker-staging"
      route = { pattern = "staging.example.org/*", zone_name = "example.org" }

      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "<STAGING_KV_ID>" }
      ]

      [env.production]
      name = "<PROD_WORKER_NAME>"

      [env.production.limits]
      cpu_ms = 500

      [[env.production.d1_databases]]
      binding = "<BINDING_NAME_1>" # first db
      database_name = "<DATABASE_NAME_1>"
      database_id = "<DATABASE_ID_1>"

      [assets]
      directory = "./public"
      binding = "ASSETS"
      run_worker_first = [ "/api/*", "!/api/docs/*" ]

      [[queues.consumers]]
      queue = "queue-1"

      [[queues.consumers]]
      queue = "queue-2"

      [env.dev]
      vars = { x = "y" }"
    `);
  });
});

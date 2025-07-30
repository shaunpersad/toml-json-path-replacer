import { expect, describe, it } from 'vitest';
import { tomlJSONPathReplacer, JSONPath } from './index';

const toml = `
# Top-level configuration
name = "my-worker"
main = "src/index.js"
"compatibility_date" = "2022-07-12"

workers_dev = false

route = { pattern = "example.org/*", zone_name = "example.org" }

kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # some comment
]

[limits]
cpu_ms = 100

[[d1_databases]]
binding = "<BINDING_NAME_1>" # first db
database_name = "<DATABASE_NAME_1>"
database_id = "<DATABASE_ID_1>"

[[d1_databases]]
binding = "<BINDING_NAME_2>" # second db
database_name = "<DATABASE_NAME_2>"
database_id = "<DATABASE_ID_3>"

[env.staging]
# Overrides above
name = "my-worker-staging"
route = { pattern = "staging.example.org/*", zone_name = "example.org" }

kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<STAGING_KV_ID>" }
]

[env.production]
name = "<PROD_WORKER_NAME>"
`;

describe('tomlJSONPathReplacer', () => {

  it('performs targeted replacements of values', () => {

    const replacements = [
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
      {
        path: ['env', 'production'],
        value: {
          name: 'prod-worker-name',
        },
      },
    ] satisfies Array<{ path: JSONPath, value: unknown }>;

    const updatedTOML = replacements.reduce(
      (newTOML, { path, value }) => {
        return tomlJSONPathReplacer(newTOML, path, value);
      },
      toml,
    );
    expect(updatedTOML).toMatchInlineSnapshot();
  });

  it('returns the string unchanged if the path is not found', () => {
    const updatedTOML = tomlJSONPathReplacer(toml, ['foo'], 'bar');
    expect(updatedTOML).toEqual(toml);
  });

  it('performs insertions when the path does not exist', () => {

  });
});

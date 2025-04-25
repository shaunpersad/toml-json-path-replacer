import { expect, describe, it } from 'vitest';
import tomlJSONPathReplacer, { JSONPath } from './index';

const toml = `
# Top-level configuration
name = "my-worker"
main = "src/index.js"
"compatibility_date" = "2022-07-12"

workers_dev = false

route = { pattern = "example.org/*", zone_name = "example.org" }

[limits]
cpu_ms = 100

kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # some comment
]

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
`;

describe('tomlJSONPathReplacer', () => {

  it('performs targeted replacements of scalar values', () => {

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
    ] satisfies Array<{ path: JSONPath, value: unknown }>;

    const updatedTOML = replacements.reduce(
      (newTOML, { path, value }) => {
        return tomlJSONPathReplacer(newTOML, path, value);
      },
      toml,
    );
    expect(updatedTOML).toMatchInlineSnapshot(`
      "
      # Top-level configuration
      name = "my-new-worker"
      main = "src/index.js"
      "compatibility_date" = "2025-04-25"

      workers_dev = true

      route = { pattern = "example.com/*", zone_name = "example.com" }

      [limits]
      cpu_ms = 50

      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # some comment
      ]

      [[d1_databases]]
      binding = "<BINDING_NAME_1>" # first db
      database_name = "<DATABASE_NAME_1>"
      database_id = "<DATABASE_ID_1>"

      [[d1_databases]]
      binding = "<BINDING_NAME_2>" # second db
      database_name = "new-db-name"
      database_id = "<DATABASE_ID_3>"

      [env.staging]
      # Overrides above
      name = "my-worker-staging"
      route = { pattern = "api.staging.example.org/*", zone_name = "example.org" }

      kv_namespaces = [
        { binding = "<MY_NAMESPACE>", id = "new-staging-id" }
      ]
      "
    `);
  });

  it('returns the string unchanged if the path is not found', () => {
    const updatedTOML = tomlJSONPathReplacer(toml, ['foo'], 'bar');
    expect(updatedTOML).toEqual(toml);
  });

  it('throws an error if a non-scalar value is used', () => {
    expect(() => tomlJSONPathReplacer(toml, ['name'], {}))
      .toThrowErrorMatchingInlineSnapshot('[Error: Non-scalar values are not allowed.]');
    expect(() => tomlJSONPathReplacer(toml, ['name'], []))
      .toThrowErrorMatchingInlineSnapshot('[Error: Non-scalar values are not allowed.]');
  });
});

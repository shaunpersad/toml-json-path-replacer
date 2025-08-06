import { expect, describe, it } from 'vitest';
import { tomlJSONPathReplacer, JSONPath } from './index';

type Replacements = Array<{ path: JSONPath, value: unknown }>;

describe('tomlJSONPathReplacer', () => {

  describe('common scenarios', () => {
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
`.trim();

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
        "# Top-level configuration
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
        database_id = "db-1-id""
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
        "# Top-level configuration
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
        database_id = "<DATABASE_ID_1>""
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
        "# Top-level configuration
        name = "my-worker"
        main = "src/index.js"
        "compatibility_date" = "2022-07-12"

        workers_dev = false

        # route comment top
        route = { pattern = "example.org/*", zone_name = "example.org", zone_id = "my-zone-id" } # route comment inline

        # kv comment top
        kv_namespaces = [
          { binding = "<MY_NAMESPACE>", id = "<KV_ID>" }, # kv comment inline
          { binding = "KV_NAMESPACE_1", id = "kv-namespace-id-1" }
        ]

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

  describe('inline tables', () => {
    const tomlWithInlineTable = `
# route comment top
route = { pattern = "example.org/*", zone_name = "example.org" } # route comment inline
`;

    it('replaces existing inline tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithInlineTable,
        ['route'],
        { pattern: 'example.com/*', zone_name: 'example.com' },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # route comment top
        route = { pattern = "example.com/*", zone_name = "example.com" } # route comment inline
        "
      `);
    });

    it('replaces items inside inline tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithInlineTable,
        ['route', 'pattern'],
        'api.example.org/*',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # route comment top
        route = { pattern = "api.example.org/*", zone_name = "example.org" } # route comment inline
        "
      `);
    });

    it('adds new items to inline tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithInlineTable,
        ['route', 'foo'],
        {
          bar: ['baz'],
        },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # route comment top
        route = { pattern = "example.org/*", zone_name = "example.org", foo = { bar = [ "baz" ] } } # route comment inline
        "
      `);
    });

    it('updates nested items in inline tables', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithInlineTable,
        ['route', 'foo'],
        {
          bar: ['baz'],
        },
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['route', 'foo', 'bar', 0],
        'boom',
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "
        # route comment top
        route = { pattern = "example.org/*", zone_name = "example.org", foo = { bar = [ "boom" ] } } # route comment inline
        "
      `);
    });

    describe('empty inline tables', () => {
      it('adds new inline tables to a blank toml', () => {
        const updatedTOML = tomlJSONPathReplacer(
          '',
          ['route'],
          {},
        );
        expect(updatedTOML).toMatchInlineSnapshot('"route = { }"');
      });
      it('replaces blank inline tables', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          '',
          ['route'],
          {},
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['route'],
          { pattern: 'example.com/*', zone_name: 'example.com' },
        );
        expect(updatedTOML2).toMatchInlineSnapshot('"route = { pattern = "example.com/*", zone_name = "example.com" }"');
      });
      it('inserts into blank inline tables', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          '',
          ['route'],
          {},
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['route', 'pattern'],
          'example.com/*',
        );
        expect(updatedTOML2).toMatchInlineSnapshot('"route = { pattern = "example.com/*" }"');
      });
    });
  });

  describe('arrays', () => {
    const tomlWithArray = `
# array
compatibility_flags = [ "formdata_parser_supports_files", "nodejs_compat" ]    
`;
    it('adds new arrays to a blank toml', () => {
      const updatedTOML = tomlJSONPathReplacer(
        '',
        ['compatibility_flags'],
        [
          'formdata_parser_supports_files',
          'nodejs_compat',
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(
        '"compatibility_flags = [ "formdata_parser_supports_files", "nodejs_compat" ]"',
      );
    });

    it('adds new arrays with existing arrays', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['crons'],
        [ '*/3 * * * *', '0 15 1 * *', '59 23 LW * *' ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

        # array
        compatibility_flags = [ "formdata_parser_supports_files", "nodejs_compat" ]"
      `);
    });

    it('replaces existing arrays', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags'],
        [
          'nodejs_als',
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ "nodejs_als" ]    
        "
      `);
    });

    it('replaces items inside arrays', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 1],
        'nodejs_als',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ "formdata_parser_supports_files", "nodejs_als" ]    
        "
      `);
    });

    it('adds new items to arrays', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 2],
        'nodejs_als',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ "formdata_parser_supports_files", "nodejs_compat", "nodejs_als" ]    
        "
      `);
    });

    it('adds nested items to arrays', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 2, 'foo'],
        'bar',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ "formdata_parser_supports_files", "nodejs_compat", { foo = "bar" } ]    
        "
      `);
    });

    it('does not allow skipping array indexes', () => {
      expect(() => tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 3],
        'nodejs_als',
      )).toThrowErrorMatchingInlineSnapshot('[Error: Cannot skip array elements when inserting.]');
    });

    it('allows mixing array item types', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 1],
        { foo: 'bar' },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ "formdata_parser_supports_files", { foo = "bar" } ]    
        "
      `);
    });

    it('does not convert arrays to table arrays if given an array of objects', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags'],
        [
          { foo: 'bar' },
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ { foo = "bar" } ]    
        "
      `);
    });

    it('replaces nested items inside array elements', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags'],
        [
          { foo: { bar: 'baz' } },
        ],
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['compatibility_flags', 0, 'foo', 'bar'],
        [
          'hello',
        ],
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = [ { foo = { bar = [ "hello" ] } } ]    
        "
      `);
    });

    it('converts the array to an object if a non-numeric index is given', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArray,
        ['compatibility_flags', 'foo', 'bar'],
        'baz',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "
        # array
        compatibility_flags = { foo = { bar = "baz" } }    
        "
      `);
    });

    describe('multi-line arrays', () => {
      const tomlWithMultiLineArray = `
# array
kv_namespaces = [
  # comment inside array
  { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # comment inline
] 
`;

      it('replaces existing arrays', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces'],
          [
            { binding: 'MY_KV', id: 'my-kv-id' },
          ],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [ { binding = "MY_KV", id = "my-kv-id" } ] 
          "
        `);
      });

      it('replaces items inside arrays', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 0],
          { binding: 'MY_KV', id: 'my-kv-id' },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [
            # comment inside array
            { binding = "MY_KV", id = "my-kv-id" } # comment inline
          ] 
          "
        `);
      });

      it('adds new items to arrays', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 1],
          { binding: 'ANOTHER_KV', id: 'another-kv-id' },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [
            # comment inside array
            { binding = "<MY_NAMESPACE>", id = "<KV_ID>" }, # comment inline
            { binding = "ANOTHER_KV", id = "another-kv-id" }
          ] 
          "
        `);
      });

      it('adds nested items to arrays', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 1, 'binding'],
          'ANOTHER_KV',
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['kv_namespaces', 1, 'id'],
          'another-kv-id',
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [
            # comment inside array
            { binding = "<MY_NAMESPACE>", id = "<KV_ID>" }, # comment inline
            { binding = "ANOTHER_KV", id = "another-kv-id" }
          ] 
          "
        `);
      });

      it('does not allow skipping array indexes', () => {
        expect(() => tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 3],
          'nodejs_als',
        )).toThrowErrorMatchingInlineSnapshot('[Error: Cannot skip array elements when inserting.]');
      });

      it('allows mixing array item types', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 1],
          'foo',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [
            # comment inside array
            { binding = "<MY_NAMESPACE>", id = "<KV_ID>" }, # comment inline
            "foo"
          ] 
          "
        `);
      });

      it('replaces nested items inside array elements', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 0, 'binding'],
          'MY_KV',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = [
            # comment inside array
            { binding = "MY_KV", id = "<KV_ID>" } # comment inline
          ] 
          "
        `);
      });

      it('converts the array to an object if a non-numeric index is given', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithMultiLineArray,
          ['kv_namespaces', 'foo', 'bar'],
          'baz',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          kv_namespaces = { foo = { bar = "baz" } } 
          "
        `);
      });
    });

    describe('empty arrays', () => {
      const tomlWithEmptyArray = `
# array
compatibility_flags = [] # inline comment
`;
      it('adds an empty array to a blank toml', () => {
        const updatedTOML = tomlJSONPathReplacer(
          '',
          ['compatibility_flags'],
          [],
        );
        expect(updatedTOML).toMatchInlineSnapshot('"compatibility_flags = [ ]"');
      });

      it('replaces an existing array with an empty array', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithArray,
          ['compatibility_flags'],
          [],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ ]    
          "
        `);
      });

      it('replaces empty arrays', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithEmptyArray,
          ['compatibility_flags'],
          ['nodejs_compat'],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ "nodejs_compat" ] # inline comment
          "
        `);
      });

      it('adds a new item to an empty array', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithEmptyArray,
          ['compatibility_flags', 0],
          'nodejs_compat',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ "nodejs_compat" ] # inline comment
          "
        `);
      });
    });

    describe('empty multi-line arrays', () => {
      const tomlWithEmptyMultiLineArray = `
# array
compatibility_flags = [ # array start
# todo fill up array
] # array end
`;
      it('replaces an existing array with an empty array', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithEmptyMultiLineArray,
          ['compatibility_flags'],
          [],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ ] # array end
          "
        `);
      });

      it('replaces empty arrays', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithEmptyMultiLineArray,
          ['compatibility_flags'],
          ['nodejs_compat'],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ "nodejs_compat" ] # array end
          "
        `);
      });

      it('adds a new item to an empty array', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithEmptyMultiLineArray,
          ['compatibility_flags', 0],
          'nodejs_compat',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "
          # array
          compatibility_flags = [ "nodejs_compat" ] # array end
          "
        `);
      });
    });
  });

  describe('standard tables', () => {
    const tomlWithStandardTable = `
# table
[limits] # key
# table body
cpu_ms = 100 # value
`.trim();
    it('adds new tables to a blank toml', () => {
      const updatedTOML = tomlJSONPathReplacer(
        '',
        ['limits'],
        { cpu_ms: 100 },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "[limits]
        cpu_ms = 100"
      `);
    });

    it('adds new tables with existing tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['another_one'],
        { another: 'one' },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = 100 # value

        [another_one]
        another = "one""
      `);
    });

    it('replaces existing tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits'],
        {
          wall_time: 60,
          something: { else: [{ inner: 'foo' }] },
        },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits]
        wall_time = 60
        something = { else = [ { inner = "foo" } ] } # value"
      `);
    });

    it('replaces kv pairs inside tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'cpu_ms'],
        500,
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = 500 # value"
      `);
    });

    it('converts a table to a kv pair if needed', () => {
      const updatedTOML = tomlJSONPathReplacer(tomlWithStandardTable, ['limits'], 500);
      expect(updatedTOML).toMatchInlineSnapshot(`
        "limits = 500

        # table # value"
      `);
    });

    it('puts kv pairs on top of the file', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['another_one'],
        { another: 'one' },
      );
      const updatedTOML2 = tomlJSONPathReplacer(updatedTOML1, ['another_one'], 'hello');
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "another_one = "hello"

        # table
        [limits] # key
        # table body
        cpu_ms = 100 # value"
      `);
    });

    it('converts a kv pair inside of a table from one type to another', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'cpu_ms'],
        { time: 1000 },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = { time = 1_000 } # value"
      `);
    });

    it('updates a nested key', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'cpu_ms'],
        { time: 1000, units: 'ms' },
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['limits', 'cpu_ms', 'time'],
        2000,
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = { time = 2_000, units = "ms" } # value"
      `);
    });

    it('adds new kv pairs inside tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'flags'],
        ['unlimited', 'internal'],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = 100
        flags = [ "unlimited", "internal" ] # value"
      `);
    });

    it('adds nested kv pairs inside tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'flags', 'internal'],
        ['unlimited'],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = 100
        flags.internal = [ "unlimited" ] # value"
      `);
    });

    it('adds nested kv pairs inside tables when ancestor already exists', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithStandardTable,
        ['limits', 'flags', 'internal'],
        ['unlimited'],
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['limits', 'flags', 'external'],
        [],
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "# table
        [limits] # key
        # table body
        cpu_ms = 100
        flags.internal = [ "unlimited" ]
        flags.external = [ ] # value"
      `);
    });

    describe('nested tables', () => {
      const tomlWithNestedStandardTable = `
# nested table
[env.production.limits] # key
# table body
cpu_ms = 100 # value
`.trim();
      it('adds new tables to a blank toml', () => {
        const updatedTOML = tomlJSONPathReplacer(
          '',
          ['env', 'production', 'limits'],
          { cpu_ms: 100 },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "[env.production.limits]
          cpu_ms = 100"
        `);
      });

      it('adds new tables with existing tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'another_one'],
          { another: 'one' },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = 100 # value

          [env.production.another_one]
          another = "one""
        `);
      });

      it('replaces existing tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits'],
          {
            wall_time: 60,
            something: { else: [{ inner: 'foo' }] },
          },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits]
          wall_time = 60
          something = { else = [ { inner = "foo" } ] } # value"
        `);
      });

      it('replaces kv pairs inside tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'cpu_ms'],
          500,
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = 500 # value"
        `);
      });

      it('reduces the table if needed', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits'],
          500,
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table # value

          [env.production]
          limits = 500"
        `);
      });

      it('converts a kv pair inside of a table from one type to another', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'cpu_ms'],
          { time: 1000 },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = { time = 1_000 } # value"
        `);
      });

      it('updates a nested key', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'cpu_ms'],
          { time: 1000, units: 'ms' },
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['env', 'production', 'limits', 'cpu_ms', 'time'],
          2000,
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = { time = 2_000, units = "ms" } # value"
        `);
      });

      it('adds new kv pairs inside tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'flags'],
          ['unlimited', 'internal'],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = 100
          flags = [ "unlimited", "internal" ] # value"
        `);
      });

      it('adds nested kv pairs inside tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'flags', 'internal'],
          ['unlimited'],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = 100
          flags.internal = [ "unlimited" ] # value"
        `);
      });

      it('adds nested kv pairs inside tables when ancestor already exists', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithNestedStandardTable,
          ['env', 'production', 'limits', 'flags', 'internal'],
          ['unlimited'],
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['env', 'production', 'limits', 'flags', 'external'],
          [],
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "# nested table
          [env.production.limits] # key
          # table body
          cpu_ms = 100
          flags.internal = [ "unlimited" ]
          flags.external = [ ] # value"
        `);
      });
    });

  });

  describe('array tables', () => {
    const tomlWithArrayTable = `
# table
[[d1_databases]] # key
# table body
binding = "MY_DATABASE" # db comment on body
database_name = "my-database-name"
database_id = "my-database-id"
`.trim();
    it('adds new array tables to a blank toml', () => {
      const updatedTOML = tomlJSONPathReplacer(
        '',
        ['d1_databases'],
        [
          {
            binding: 'DATABASE_1',
            database_name: 'database-name-1',
            database_id: 'database-id-1',
          },
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "[[d1_databases]]
        binding = "DATABASE_1"
        database_name = "database-name-1"
        database_id = "database-id-1""
      `);
    });

    it('adds new array tables with multiple values to a blank toml', () => {
      const updatedTOML = tomlJSONPathReplacer(
        '',
        ['d1_databases'],
        [
          {
            binding: 'DATABASE_1',
            database_name: 'database-name-1',
            database_id: 'database-id-1',
          },
          {
            binding: 'DATABASE_2',
            database_name: 'database-name-2',
            database_id: 'database-id-2',
          },
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "[[d1_databases]]
        binding = "DATABASE_1"
        database_name = "database-name-1"
        database_id = "database-id-1"

        [[d1_databases]]
        binding = "DATABASE_2"
        database_name = "database-name-2"
        database_id = "database-id-2""
      `);
    });

    it('adds new array tables with existing array tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['another_one'],
        [
          { item: 'one' },
          { item: 'two' },
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = "MY_DATABASE" # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id"

        [[another_one]]
        item = "one"

        [[another_one]]
        item = "two""
      `);
    });

    it('replaces existing tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases'],
        [
          {
            binding: 'DATABASE_1',
            database_name: 'database-name-1',
            database_id: 'database-id-1',
          },
          {
            binding: 'DATABASE_2',
            database_name: 'database-name-2',
            database_id: 'database-id-2',
          },
        ],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table

        [[d1_databases]]
        binding = "DATABASE_1"
        database_name = "database-name-1"
        database_id = "database-id-1"

        [[d1_databases]]
        binding = "DATABASE_2"
        database_name = "database-name-2"
        database_id = "database-id-2""
      `);
    });

    it('replaces existing table entries', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0],
        {
          binding: 'DATABASE_1',
          database_name: 'database-name-1',
          database_id: 'database-id-1',
        },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]]
        binding = "DATABASE_1"
        database_name = "database-name-1"
        database_id = "database-id-1""
      `);
    });

    it('adds new table entries', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0],
        {
          binding: 'DATABASE_1',
          database_name: 'database-name-1',
          database_id: 'database-id-1',
        },
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['d1_databases', 1],
        {
          binding: 'DATABASE_2',
          database_name: 'database-name-2',
          database_id: 'database-id-2',
        },
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]]
        binding = "DATABASE_1"
        database_name = "database-name-1"
        database_id = "database-id-1"

        [[d1_databases]]
        binding = "DATABASE_2"
        database_name = "database-name-2"
        database_id = "database-id-2""
      `);
    });

    it('replaces kv pairs inside array tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0, 'binding'],
        'NEW_DB_BINDING',
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = "NEW_DB_BINDING" # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id""
      `);
    });

    it('adds new kv pairs', () => {
      const updatedTOML = tomlJSONPathReplacer(tomlWithArrayTable, ['d1_databases', 0, 'region'], 'WNAM');
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = "MY_DATABASE" # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id"
        region = "WNAM""
      `);
    });

    it('converts a kv pair inside of an array table from one type to another', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0, 'binding'],
        { name: 'MY_BINDING' },
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = { name = "MY_BINDING" } # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id""
      `);
    });

    it('updates a nested key', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0, 'binding'],
        { name: 'MY_BINDING' },
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['d1_databases', 0, 'binding', 'name'],
        'MY_NEW_BINDING',
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = { name = "MY_NEW_BINDING" } # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id""
      `);
    });

    it('adds nested kv pairs inside tables', () => {
      const updatedTOML = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0, 'flags', 'internal'],
        ['unlimited'],
      );
      expect(updatedTOML).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = "MY_DATABASE" # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id"
        flags.internal = [ "unlimited" ]"
      `);
    });

    it('adds nested kv pairs inside tables when ancestor already exists', () => {
      const updatedTOML1 = tomlJSONPathReplacer(
        tomlWithArrayTable,
        ['d1_databases', 0, 'limits', 'flags', 'internal'],
        ['unlimited'],
      );
      const updatedTOML2 = tomlJSONPathReplacer(
        updatedTOML1,
        ['d1_databases', 0, 'limits', 'flags', 'external'],
        [],
      );
      expect(updatedTOML2).toMatchInlineSnapshot(`
        "# table
        [[d1_databases]] # key
        # table body
        binding = "MY_DATABASE" # db comment on body
        database_name = "my-database-name"
        database_id = "my-database-id"
        limits.flags.internal = [ "unlimited" ]
        limits.flags.external = [ ]"
      `);
    });

    describe('nested tables', () => {
      const tomlWithNestedArrayTable = `
# nested table
[[env.production.d1_databases]] # key
# table body
binding = "MY_DATABASE" # db comment on body
database_name = "my-database-name"
database_id = "my-database-id"
`.trim();

      it('adds new array tables to a blank toml', () => {
        const updatedTOML = tomlJSONPathReplacer(
          '',
          ['env', 'production', 'd1_databases'],
          [
            {
              binding: 'DATABASE_1',
              database_name: 'database-name-1',
              database_id: 'database-id-1',
            },
          ],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "[[env.production.d1_databases]]
          binding = "DATABASE_1"
          database_name = "database-name-1"
          database_id = "database-id-1""
        `);
      });

      it('adds new array tables with multiple values to a blank toml', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases'],
          [
            {
              binding: 'DATABASE_1',
              database_name: 'database-name-1',
              database_id: 'database-id-1',
            },
            {
              binding: 'DATABASE_2',
              database_name: 'database-name-2',
              database_id: 'database-id-2',
            },
          ],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table

          [[env.production.d1_databases]]
          binding = "DATABASE_1"
          database_name = "database-name-1"
          database_id = "database-id-1"

          [[env.production.d1_databases]]
          binding = "DATABASE_2"
          database_name = "database-name-2"
          database_id = "database-id-2""
        `);
      });

      it('adds new array tables with existing array tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'another_one'],
          [
            { item: 'one' },
            { item: 'two' },
          ],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = "MY_DATABASE" # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id"

          [[env.production.another_one]]
          item = "one"

          [[env.production.another_one]]
          item = "two""
        `);
      });

      it('replaces existing tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases'],
          [
            {
              binding: 'DATABASE_1',
              database_name: 'database-name-1',
              database_id: 'database-id-1',
            },
            {
              binding: 'DATABASE_2',
              database_name: 'database-name-2',
              database_id: 'database-id-2',
            },
          ],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table

          [[env.production.d1_databases]]
          binding = "DATABASE_1"
          database_name = "database-name-1"
          database_id = "database-id-1"

          [[env.production.d1_databases]]
          binding = "DATABASE_2"
          database_name = "database-name-2"
          database_id = "database-id-2""
        `);
      });

      it('replaces existing table entries', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0],
          {
            binding: 'DATABASE_1',
            database_name: 'database-name-1',
            database_id: 'database-id-1',
          },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]]
          binding = "DATABASE_1"
          database_name = "database-name-1"
          database_id = "database-id-1""
        `);
      });

      it('adds new table entries', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0],
          {
            binding: 'DATABASE_1',
            database_name: 'database-name-1',
            database_id: 'database-id-1',
          },
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['env', 'production', 'd1_databases', 1],
          {
            binding: 'DATABASE_2',
            database_name: 'database-name-2',
            database_id: 'database-id-2',
          },
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]]
          binding = "DATABASE_1"
          database_name = "database-name-1"
          database_id = "database-id-1"

          [[env.production.d1_databases]]
          binding = "DATABASE_2"
          database_name = "database-name-2"
          database_id = "database-id-2""
        `);
      });

      it('replaces kv pairs inside array tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'binding'],
          'NEW_DB_BINDING',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = "NEW_DB_BINDING" # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id""
        `);
      });

      it('adds new kv pairs', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'region'],
          'WNAM',
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = "MY_DATABASE" # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id"
          region = "WNAM""
        `);
      });

      it('converts a kv pair inside of an array table from one type to another', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'binding'],
          { name: 'MY_BINDING' },
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = { name = "MY_BINDING" } # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id""
        `);
      });

      it('updates a nested key', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'binding'],
          { name: 'MY_BINDING' },
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['env', 'production', 'd1_databases', 0, 'binding', 'name'],
          'MY_NEW_BINDING',
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = { name = "MY_NEW_BINDING" } # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id""
        `);
      });

      it('adds nested kv pairs inside tables', () => {
        const updatedTOML = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'flags', 'internal'],
          ['unlimited'],
        );
        expect(updatedTOML).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = "MY_DATABASE" # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id"
          flags.internal = [ "unlimited" ]"
        `);
      });

      it('adds nested kv pairs inside tables when ancestor already exists', () => {
        const updatedTOML1 = tomlJSONPathReplacer(
          tomlWithNestedArrayTable,
          ['env', 'production', 'd1_databases', 0, 'limits', 'flags', 'internal'],
          ['unlimited'],
        );
        const updatedTOML2 = tomlJSONPathReplacer(
          updatedTOML1,
          ['env', 'production', 'd1_databases', 0, 'limits', 'flags', 'external'],
          [],
        );
        expect(updatedTOML2).toMatchInlineSnapshot(`
          "# nested table
          [[env.production.d1_databases]] # key
          # table body
          binding = "MY_DATABASE" # db comment on body
          database_name = "my-database-name"
          database_id = "my-database-id"
          limits.flags.internal = [ "unlimited" ]
          limits.flags.external = [ ]"
        `);
      });

    });

  });
});

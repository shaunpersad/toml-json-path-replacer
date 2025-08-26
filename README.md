# toml-json-path-replacer
Use JSON paths to replace values in TOML strings, whilst preserving structure and comments.

## Installation
```bash
npm i toml-json-path-replacer
```

## Usage
```javascript
import { tomlJSONPathReplacer } from 'toml-json-path-replacer'

const toml = `
name = "my-worker" # worker name
`
const updatedTOML = tomlJSONPathReplacer(
    toml, // the toml string
    ['name'], // the JSON path to insert the new value
    'my-updated-worker' // the new value
);
// name = "my-updated-worker" # worker name
```

## Complex example 
```javascript
const toml = `
workers_dev = false
route = { pattern = "example.org/*", zone_name = "example.org" } # my route

[limits]
cpu_ms = 100

kv_namespaces = [
  { binding = "<MY_NAMESPACE>", id = "<KV_ID>" } # my kv
]

[env.staging]
# Overrides above
route = { pattern = "staging.example.org/*", zone_name = "example.org" }
`
let updateTOML;

updatedTOML = tomlJSONPathReplacer(toml, ['workers_dev'], true);
// workers_dev = true

updatedTOML = tomlJSONPathReplacer(toml, ['route', 'pattern'], 'api.example.org/*');
// route = { pattern = "api.example.org/*", zone_name = "example.org" } # my route

updatedTOML = tomlJSONPathReplacer(toml, ['limits', 'cpu_ms'], 50);
// [limits]
// cpu_ms = 50

updatedTOML = tomlJSONPathReplacer(toml, ['kv_namespaces', 0, 'id'], 'new-id');
// kv_namespaces = [
//     { binding = "<MY_NAMESPACE>", id = "new-id" } # my kv
// ]

updatedTOML = tomlJSONPathReplacer(toml, ['env', 'staging', 'route', 'pattern'], 'api.staging.example.org/*');
// [env.staging]
// # Overrides above
// route = { pattern = "api.staging.example.org/*", zone_name = "example.org" }

updatedTOML = tomlJSONPathReplacer(toml, ['env', 'staging', 'route'], {
    pattern: 'api.staging.example.com/*',
    zone_name: 'api.staging.example.com',
});
// [env.staging]
// # Overrides above
// route = { pattern = "api.staging.example.com/*", zone_name = "api.staging.example.com" }

updateTOML = tomlJSONPathReplacer(toml, ['env', 'production'], {
    route: {
        pattern: 'example.com/*',
        zone_name: 'example.com'
    }
})
// [env.production]
// route = { pattern = "example.com/*", zone_name = "example.com" }

updateTOML = tomlJSONPathReplacer(toml, ['env', 'staging'], undefined); // pass undefined to unset values
```


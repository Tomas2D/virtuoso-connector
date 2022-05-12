# 🔗 virtuoso-connector

TODO

## ⭐️ Features

- pool handling,
- support of SPARQL query builder syntax

## 🚀 Installation

```
yarn add virtuoso-connector
```
```
npm install virtuoso-connector
```

## 🤘🏻 Usage

```typescript
import { DatabaseConnection } from 'virtuoso-connector'

const db = new DatabaseConnection({
  url: 'jdbc:virtuoso://127.0.0.1:1111/CHARSET=UTF-8',
  username: 'dba',
  password: 'dba',
  driverPath: '/usr/local/virtuoso-opensource/lib/jdbc-4.3/virtjdbc4_3.jar',
  lazy: true, // optional
  maxQueryTimeout: 0, // optional (in seconds), 0 = unlimited
  poolSize: 1 // max active connections
})

await db.query(`
  SELECT ?s ?p ?o 
  WHERE { ?s ?p ?o }
`)
```

## TODO

- [ ] Add deep insight description
- [ ] Add tests
- [ ] Add examples

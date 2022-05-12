# 🔗 virtuoso-connector

Package that allows you to create a direct connection to the [https://virtuoso.openlinksw.com/](Virtuoso) 
database and run queries on it. Connection can be used to execute both SQL and SPARQL queries, or even 
internal database stored procedures. 

## ℹ Background

Since there is no native Virtuoso driver for NodeJS, the only option is to use Java bindings, which enables
communication between a JDBC driver and a NodeJS application.

The `@naxmefy/jdbc` package provides support for communication with the JDBC driver, which is
appropriate because Virtuoso provides a JDBC driver and thus they can be
used together. The only disadvantage of this approach is that the process
needs to start JVM and whenever it crashes, it crashes the whole application.
To prevent the crash of the whole application, the `DatabaseConnection` **manages a pool of child processes** (forks) (`DatabaseConnectionChild`)
which are responsible for the queries execution.

Selection of the child process is made by `Round Robin` load balancing mechanism.
Delegation of the execution is done in the form of sending messages through the IPC channel, with a unified
interface defined in `types.ts` file. Once the query inside the message is being
resolved by the child process, it sends a new message with the response back
to the service. In case of a crash of the JVM, for instance, due to the broken
connection with the database or segmentation fault, the child will be terminated and deleted from the pool.
Because the child processes are detached from the parent, they do not crash the application, but only themselves.

## ⭐️ Features

- pool handling,
- support of SPARQL query builder syntax (`@tpluscode/rdf-string`, `@tpluscode/sparql-builder`),
- support for executing stored procedures or even SQL

## 🚀 Installation

TODO: not published yet

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
  lazy: false,
  maxQueryTimeout: 360, // optional (in seconds), 0 = unlimited
  poolSize: 2 // max active connections
})

const results = await db.query(`
  SELECT ?s ?p ?o 
  WHERE { ?s ?p ?o }
`)

results.forEach(result => {
  // terms are created via DataFactory according to the standard
  console.info(result.s, result.p, result.o)
})
```

## 📃 TODO
- [ ] Add tests
- [ ] Publish package

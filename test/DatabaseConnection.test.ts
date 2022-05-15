import { DatabaseConnection } from '../src';

describe('Database connection with queries', () => {
  let db: DatabaseConnection;
  const TEST_GRAPH_IRI = 'http://github.com/Tomas2D/virtuoso-connector';

  beforeAll(async () => {
    db = new DatabaseConnection({
      driverPath: process.env.DB_DRIVER_PATH,
      url: process.env.DB_URL,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      lazy: false,
      maxQueryTimeout: 5,
      poolSize: 1,
    });
  });

  afterAll(() => {
    db.destroy();
  });

  it('Verify connection', async () => {
    await expect(db.query(`ASK {}`)).resolves.toBeDefined();
  });

  it('Insert data', async () => {
    await db.query(`
      PREFIX ns: <http://example.org/ns#>
      
      INSERT DATA { 
        GRAPH <${TEST_GRAPH_IRI}> { 
          <http://example/book1> ns:name "Book #1"@en . 
          <http://example/book1> ns:price 100 .
          
          <http://example/book1> ns:name "Book #2"@en . 
          <http://example/book1> ns:price 200 . 
        }
      }
    `);
  });

  it('Retrieves data', async () => {
    const books = await db.query(`
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      PREFIX ns: <http://example.org/ns#>
      
      SELECT DISTINCT ?name ?price
      FROM <${TEST_GRAPH_IRI}>
      WHERE {
        ?s ns:name ?name .
        ?s ns:price ?price .
      }
      ORDER BY ASC(?name)
    `);

    expect(books).toMatchSnapshot();
  });

  it('Clears a graph', async () => {
    await db.query(`CLEAR GRAPH <${TEST_GRAPH_IRI}>`);
    const [{ count }] = await db.query(
      `SELECT COUNT(*) as ?count FROM <${TEST_GRAPH_IRI}> WHERE { ?s ?p ?o }`,
    );
    await expect(count.value).toBe('0');
  });
});

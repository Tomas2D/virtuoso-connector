import jsonStream from 'jsonstream2';
import { Transform } from 'readable-stream';
import { DataFactory } from 'rdf-data-factory';
import { finished, Duplex } from 'stream';

/**
 * A stream which parses SPARQL SELECT bindings
 * Source: https://raw.githubusercontent.com/zazuko/sparql-http-client/master/ResultParser.js
 */
interface VirtuosoResultParserConstructor {
  factory?: DataFactory;
}

class VirtuosoResultParser extends Duplex {
  private readonly factory: DataFactory;
  private readonly jsonParser: Transform;

  constructor({ factory = new DataFactory() }: VirtuosoResultParserConstructor = {}) {
    super({
      readableObjectMode: true,
    });

    this.factory = factory;
    this.jsonParser = jsonStream.parse('results.bindings.*');

    finished(this.jsonParser, (err) => {
      this.destroy(err);
    });
  }

  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.jsonParser.write(chunk, encoding, callback);
  }

  async _read() {
    const raw = this.jsonParser.read();

    if (!raw || Object.keys(raw).length === 0) {
      if (!this.writable) {
        return this.push(null);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    } else {
      const row = Object.entries(raw).reduce((row: Record<string, unknown>, [key, value]) => {
        row[key] = this.valueToTerm(value);

        return row;
      }, {});

      if (!this.push(row)) {
        return;
      }
    }

    this._read();
  }

  valueToTerm(value: any) {
    if (value.type === 'uri') {
      return this.factory.namedNode(value.value);
    }

    if (value.type === 'bnode') {
      return this.factory.blankNode(value.value);
    }

    if (value.type === 'literal' || value.type === 'typed-literal') {
      const datatype = value.datatype && this.factory.namedNode(value.datatype);

      return this.factory.literal(value.value, datatype || value['xml:lang']);
    }

    return null;
  }
}

export default VirtuosoResultParser;

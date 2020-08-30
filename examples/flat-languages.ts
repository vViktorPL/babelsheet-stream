import { fromBabelsheet, writeJSONFile } from '../src';
import { mergeMap, groupBy } from 'rxjs/operators'
import credentials from './.credentials.json';

fromBabelsheet({
  spreadsheetId: "10LiCKh8KRmFUQUHqMgcx70THb1xprYp5HdyQR_6zcBY",
  credentials,
}).pipe(
  groupBy(
    ({ language }) => language,
    ({ path, value }) => ({ path: path.join('.'), value })
  ),
  mergeMap(languageEntries$ => languageEntries$.pipe(
    writeJSONFile(`${__dirname}/i18n/flat/${languageEntries$.key}.json`)
  )),
).subscribe(
  ({ filePath, entryCount }) => {
    console.log(`Wrote file: "${filePath}" with ${entryCount} entries`);
  }
);
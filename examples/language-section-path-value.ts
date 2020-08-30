import { fromBabelsheet, writeJSONFile } from '../src'
import { groupBy, mergeMap } from 'rxjs/operators'
import credentials from './.credentials.json';

fromBabelsheet({
  spreadsheetId: "10LiCKh8KRmFUQUHqMgcx70THb1xprYp5HdyQR_6zcBY",
  credentials,
}).pipe(
  groupBy(
    ({ language, path }) => `${language}/${path[0]}`,
    ({ path, value }) => ({ path: path.slice(1), value })
  ),
  mergeMap(languageEntries$ => languageEntries$.pipe(
    writeJSONFile(`${__dirname}/i18n/nested/${languageEntries$.key}.json`)
  )),
).subscribe(
  ({ filePath, entryCount }) => {
    console.log(`Wrote file: "${filePath}" with ${entryCount} entries`);
  }
);
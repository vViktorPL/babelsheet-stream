import { fromBabelsheet, writeCSVFile } from '../src';
import { mergeMap, groupBy } from 'rxjs/operators'
import credentials from './.credentials.json';

fromBabelsheet({
  spreadsheetId: "10LiCKh8KRmFUQUHqMgcx70THb1xprYp5HdyQR_6zcBY",
  credentials,
}).pipe(
  groupBy(
    ({ language }) => language,
    ({ path, value }) => ({ translationKey: path.join('.'), value })
  ),
  mergeMap(languageEntries$ => languageEntries$.pipe(
    writeCSVFile({
      filePath: `${__dirname}/i18n/csv/${languageEntries$.key}.csv`,
      columnsOrder: ["translationKey", "value"],
    })
  )),
).subscribe(
  ({ filePath, entryCount }) => {
    console.log(`Wrote file: "${filePath}" with ${entryCount} entries`);
  }
);
import {
  GoogleSpreadsheet,
  ServiceAccountCredentials
} from 'google-spreadsheet';
import { Observable, from } from 'rxjs';
import {
  filter,
  mergeMap,
  scan,
} from 'rxjs/operators';

export type BabelsheetSourceConfig = {
  spreadsheetId: string;
  sheetIndex?: number;
  credentials: ServiceAccountCredentials;
};


export type TranslationEntry = {
  path: string[];
  language: string;
  value: string;
  tag: string;
}


export function fromBabelsheet({
  spreadsheetId,
  sheetIndex = 0,
  credentials
}: BabelsheetSourceConfig): Observable<TranslationEntry> {
  return from(
    (async () => {
      const document = new GoogleSpreadsheet(spreadsheetId);

      await document.useServiceAccountAuth(credentials);

      await document.loadInfo();

      const sheet = document.sheetsByIndex[sheetIndex];
      await sheet.loadCells({
        startColumnIndex: 0,
        startRowIndex: 0,
        endColumnIndex: sheet.columnCount,
        endRowIndex: sheet.rowCount
      });

      let babelsheetHeaderRowStart = null;
      for (let y = 0; y < sheet.rowCount; ++y) {
        if (sheet.getCell(y, 0).value !== "###") {
          continue;
        }
        babelsheetHeaderRowStart = y;
      }

      if (babelsheetHeaderRowStart === null) {
        throw new Error('No babelsheet header row found (first cell must be "###").');
      }

      const rows = [];
      for (let y = babelsheetHeaderRowStart; y < sheet.rowCount; ++y) {
        const row = [];
        for (let x = 0; x < sheet.columnCount; ++x) {
          row.push(sheet.getCell(y, x).value);
        }

        if (row.every(cellValue => cellValue === null)) {
          continue;
        }
        rows.push(row);
      }

      const header = rows.shift() as NonNullable<typeof rows[0]>;
      const pathMaxLength = header.filter(cellValue => cellValue === '>>>').length;
      const languages = header.slice(pathMaxLength + 1).filter(cellValue => cellValue !== null);

      return { rows, pathMaxLength, languages };

    })()
  ).pipe(
    mergeMap(({ rows, pathMaxLength, languages }) => from(rows).pipe(
      scan(({ path }, row) => ({
        row, path: mergePaths(path, row.slice(1, pathMaxLength + 1).map(value => value === null ? null : String(value))),
      }), { row: [] as (string|null|number|boolean)[], path: Array(pathMaxLength + 1).fill(null) }),
      filter(({ row }) => !row.slice(pathMaxLength + 1).every(value => value === null)),
      mergeMap(({ row, path }) => languages.map(
        (language, languageIndex) => ({
          language,
          path: path.filter(value => value !== null),
          tag: row[0],
          value: nullToEmptyString(row[pathMaxLength + 1 + languageIndex]),
        } as TranslationEntry)
      ))
    )),
  );
}

const nullToEmptyString = <T>(value: T) => value === null ? "" : value as Exclude<T, null>;

const mergePaths = (previousPath: (string|null)[], path: (string|null)[]) => {
  const firstNodeIndex = path.findIndex(node => node !== null);
  if (firstNodeIndex === -1) {
    return previousPath;
  }

  return [...previousPath.slice(0, firstNodeIndex), ...path.slice(firstNodeIndex)];
}
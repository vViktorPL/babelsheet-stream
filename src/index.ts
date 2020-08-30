import {
  GoogleSpreadsheet,
  ServiceAccountCredentials
} from 'google-spreadsheet';
import { Observable } from 'rxjs'
import {
  filter,
  mergeMap,
  reduce,
  scan,
} from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility'
import set from 'lodash.set';
import { promises as fs } from "fs";
import * as fsPath from 'path';
import { fromArray } from 'rxjs/internal/observable/fromArray'

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

export type TranslationJsonEntry = {
  path: string|string[];
  value: string;
};

export type JSONFileSummary = {
  entryCount: number;
  filePath: string;
}

export function fromBabelsheet({
  spreadsheetId,
  sheetIndex = 0,
  credentials
}: BabelsheetSourceConfig): Observable<TranslationEntry> {
  return fromPromise(
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
    mergeMap(({ rows, pathMaxLength, languages }) => fromArray(rows).pipe(
      scan(({ path }, row) => ({
        row, path: mergePaths(path, row.slice(1, pathMaxLength)),
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

export const writeJSONFile = (filePath: string) =>
  (entries$: Observable<TranslationJsonEntry>): Observable<JSONFileSummary> =>
    entries$.pipe(
      reduce((accumulator, entry) => {
        if (Array.isArray(entry.path)) {
          set(accumulator.data, entry.path, entry.value);
        } else {
          accumulator.data[entry.path] = entry.value;
        }
        accumulator.entryCount++;

        return accumulator;
      }, { data: {} as Record<string, string>, entryCount: 0 }),
      mergeMap(
        async ({ data, entryCount }) => {
          await fs.mkdir(fsPath.dirname(filePath), { recursive: true });
          const fileHandle = await fs.open(filePath, 'w');
          try {
            await fileHandle.writeFile(JSON.stringify(data, null, 2));
          } finally {
            await fileHandle.close();
          }

          return {
            filePath,
            entryCount
          };
        }
      )
    );


const mergePaths = (previousPath: unknown[], path: unknown[]) => {
  const firstNodeIndex = path.findIndex(node => node !== null);
  if (firstNodeIndex === -1) {
    return previousPath;
  }

  return [...previousPath.slice(0, firstNodeIndex), ...path.slice(firstNodeIndex)];
}
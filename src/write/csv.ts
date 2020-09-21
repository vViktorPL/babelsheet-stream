import { FileSummary, writeFile } from './file'
import { concat, Observable, of } from 'rxjs'
import { map } from 'rxjs/operators'

export type CSVFileConfig<T extends string> = {
  filePath: string;
  columnsOrder: T[];
}

export type CSVFileSummary = FileSummary;

export const writeCSVFile = <T extends Record<string, string>>({ filePath, columnsOrder }: CSVFileConfig<(keyof T) & string>) =>
  (entries$: Observable<T>): Observable<CSVFileSummary> =>
    writeFile(
      filePath,
      concat(
        of(csvRow(columnsOrder)),
        entries$.pipe(
          map(row => csvRow(columnsOrder.map(column => row[column])))
        )
      )
    ).pipe(
      map(({ filePath, entryCount }) => ({
        filePath,
        // Exclude header row in counting
        entryCount: entryCount - 1
      }))
    );

const csvRow = (values: string[], delimiter: string = ",") =>
  values
    .map(value => escapeValue(value, delimiter))
    .join(delimiter) + '\n';

const escapeValue = (value: string, delimiter: string = ",") => {
  const specialChars = [delimiter, '"', '\n'];
  const mustBeEscaped = specialChars.some(
    specialChar => value.includes(specialChar)
  );

  if (!mustBeEscaped) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}
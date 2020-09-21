import { Observable } from 'rxjs';
import { promises as fs } from 'fs';
import * as fsPath from 'path';
import { catchError, concatMap, mergeMap, reduce } from 'rxjs/operators';

export type FileSummary = {
  entryCount: number;
  filePath: string;
}

export const writeFile = (filePath: string, chunks$: Observable<string>) => {
  const fileHandlePromise = fs.mkdir(fsPath.dirname(filePath), { recursive: true })
    .then(() => fs.open(filePath, 'w'));
  const closeFile = () => fileHandlePromise.then(fileHandle => fileHandle.close());

  return chunks$.pipe(
    concatMap(
      chunk => fileHandlePromise
        .then(fileHandle => fileHandle.write(chunk))
    ),
    catchError(e => closeFile()
      .catch()
      .then(() => { throw e; })
    ),
    reduce(accumulator => {
      accumulator.entryCount++;
      return accumulator;
    }, { entryCount: 0, filePath } as FileSummary),
    mergeMap(summary => closeFile().then(() => summary)),
  );
}
# babelsheet-stream

Rx.js observable that parses google spreadsheets that have Babelsheet compliant structure

## Purpose

There is cool Babelsheet project which enables straightforward way for syncing 
the translation files in your project by fetching them from specifically structured
Google Spreadsheet file. The problem with Babelsheet however is that although it provides
a nice features, it might be the case that you have a specific structure of translations that
it does not handle. Possible approaches to such problem would be:

1. Fork Babelsheet and create PR with missing feature implementation
2. Use Babelsheet and format produced data to fit your format by writing another tool script
3. Write custom script to parse spreadsheet

This project makes it easier to go with the 3rd way by using Rx.js abstractions.

## Example: flat JSONs per language

Suppose you want to create flat JSON files per language:

```typescript
import { fromBabelsheet, writeJSONFile } from 'babelsheet-stream';
import { mergeMap, groupBy } from 'rxjs/operators'

// Import your credentials.json file that you can generate in Google API console 
// panel when creating Service Account.
import credentials from './.credentials.json';

fromBabelsheet({
  spreadsheetId: "__YOUR_SPREADSHEET_ID__",
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
```

The above script will group the language translations by language and write JSON files per each of them.
As you can see beside reading and parsing the spreadsheets, babelsheet-stream also provides some
helper for writing the JSON files.

## Example: nested structure

Suppose you want to group translations per language, but you also want to split the translations
by the root section of the translation key path. For instance if you have translation keys like this:

* `common.edit`
* `login.form.email`
* `login.error.wrongCredentials`

you would like it to end up in files like:

* `i18n/en/common.json`
* `i18n/pl/common.json`
* `i18n/en/login.json`
* `i18n/pl/login.json`

Then, the following code is an exemplary implementation of tool that can do this:

```typescript
import { fromBabelsheet, writeJSONFile } from 'babelsheet-stream';
import { groupBy, mergeMap } from 'rxjs/operators'

// Import your credentials.json file that you can generate in Google API console 
// panel when creating Service Account.
import credentials from './.credentials.json';

fromBabelsheet({
  spreadsheetId: "__YOUR_SPREADSHEET_ID__",
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
```
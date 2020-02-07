# rollup-plugin-favicons

[Rollup](https://github.com/rollup/rollup) plugin to generating favicons and their associated files.

It uses the [favicons](https://github.com/itgalaxy/favicons) generator under the hood.

This plugin was inspired by the
[favicons-webpack-plugin](https://github.com/jantimon/favicons-webpack-plugin).

The plugin can be used alongside the [rollup-plugin-html2](https://github.com/mentaljam/rollup-plugin-html2).
In this case `rollup-plugin-favicons` should be placed before `rollup-plugin-html2` in the plugin list.

## Install

```sh
npm i -D rollup-plugin-favicons
```

## Usage

```js
// rollup.config.js

import favicons from 'rollup-plugin-favicons'
import html2 from 'rollup-plugin-html2'


export default {
  input: 'index.js',
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    favicons({
      source: 'icon.svg',
      configuration: {
        appName: process.env.npm_package_displayName,
      },
    }),
    html2({
      template: 'index.html',
    }),
  ],
}
```

## Options

### `source: string`

A path to a source image which would be used to generate icons.

### `configuration: object`

A configuration for the [favicons](https://github.com/itgalaxy/favicons).
For details please read the link.

## License

[MIT](LICENSE) © [Petr Tsymbarovich](mailto:petr@tsymbarovich.ru)

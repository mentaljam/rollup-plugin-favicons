# rollup-plugin-favicons

[Rollup](https://github.com/rollup/rollup) plugin to generating favicons and their associated files.

It uses the [favicons](https://github.com/itgalaxy/favicons) generator under the hood.

This plugin was inspired by the
[favicons-webpack-plugin](https://github.com/jantimon/favicons-webpack-plugin).

The plugin can be used alongside the [rollup-plugin-html2](https://github.com/mentaljam/rollup-plugin-html2).
In this case `rollup-plugin-favicons` should be placed before `rollup-plugin-html2` in the plugin list.

By default, the plugin uses the Rollup assets emission mechanism. This means that all generated favicons
and manifests will be placed under the Rollup output directory. If you need a custom output directory
you can use the [callback](#callback) property.

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

### source

#### Type

```js
string
```

A path to a source image which would be used to generate icons.

### configuration

#### Type

```js
object
```

A configuration for the [favicons](https://github.com/itgalaxy/favicons).
For details please read the link.

### cache

#### Type

```js
boolean | string | undefined
```

#### Default

```js
'node_modules/.cache/favicons'
```

Where to cache generated favicons and manifests or not.

Set to `true` or `undefined` to use the default cache location or set a custom path.

### callback

#### Type

```js
(response: object) => void | undefined
```

A custom callback that takes a response of favicons generator.
See [example](example/rollup.config.custom-dir.js).

## License

[MIT](LICENSE) © [Petr Tsymbarovich](mailto:petr@tsymbarovich.ru)

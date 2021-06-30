import fs from 'fs'
import path from 'path'
import favicons from 'rollup-plugin-favicons'
import html2 from 'rollup-plugin-html2'


export default {
  input: 'index.js',
  output: {
    dir: 'dist-custom-dir',
    format: 'es',
  },
  plugins: [
    favicons({
      source: 'icon.svg',
      configuration: {
        appName: process.env.npm_package_displayName,
        path: '/public',
      },
      callback({images, files}) {
        const writeAsset = ({name, contents}) => fs.writeFileSync(path.resolve('public', name), contents)
        images.forEach(writeAsset)
        files.forEach(writeAsset)
      }
    }),
    html2({
      template: 'index.html',
    }),
  ],
}

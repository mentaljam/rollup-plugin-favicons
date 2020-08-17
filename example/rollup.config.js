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

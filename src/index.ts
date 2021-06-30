import {createHash} from 'crypto'
import favicons, {Configuration, FavIconResponse} from 'favicons'
import fs from 'fs'
import path from 'path'
import objectHash from 'object-hash'
import {Plugin, PluginContext} from 'rollup'
import {IExtendedOptions} from 'rollup-plugin-html2/dist/types'


interface IPluginConfig {
  cache?:        boolean | string
  configuration: Partial<Configuration>
  source:        string
  callback?:     (response: FavIconResponse) => void
}

interface IFaviconOutput {
  contents: Buffer
  name:     string
}

interface ICacheIndex {
  images: string[]
  files:  string[]
  html:   string[]
}

type RollupPluginFavicons = (config: IPluginConfig) => Plugin

const checkCache = ({
  cache,
  configuration,
  source,
}: IPluginConfig): [string, string] => {
  if (cache === undefined || cache === true) {
    cache = 'node_modules/.cache/favicons'
  }
  if (!cache) {
    return ['', '']
  }
  const configHash  = objectHash(configuration)
  const sourceCache = createHash('sha1').update(fs.readFileSync(source)).digest('hex')
  const resultHash  = createHash('sha1').update(configHash + sourceCache).digest('hex')
  const cacheDir    = path.resolve(cache, resultHash)
  const cacheIndex  = path.resolve(cacheDir, 'index.json')
  return [cacheDir, cacheIndex]
}

const responseFromCache = (
  cacheDir:   string,
  cacheIndex: string,
): FavIconResponse => {
  const index = fs.readFileSync(cacheIndex).toString()
  const {images, files, html} = JSON.parse(index) as ICacheIndex
  const readFile = (name: string) => ({name, contents: fs.readFileSync(path.join(cacheDir, name))})
  return {
    images: images.map(readFile),
    files:  files.map(readFile),
    html:   html.slice()
  }
}

const responseToCache = (
  {images, files, html}: FavIconResponse,
  cacheDir:              string,
  cacheIndex:            string,
): void => {
  fs.mkdirSync(cacheDir, {recursive: true})
  const extractName = ({name}: IFaviconOutput) => name
  fs.writeFileSync(cacheIndex, JSON.stringify({
    images: images.map(extractName),
    files:  files.map(extractName),
    html,
  }))
  const writeFile = ({name, contents}: IFaviconOutput) => fs.writeFileSync(path.resolve(cacheDir, name), contents)
  images.forEach(writeFile)
  files.forEach(writeFile)
}

const getFaviconResponse = async (
  context:      PluginContext,
  pluginConfig: IPluginConfig,
) => {
  const [cacheDir, cacheIndex] = checkCache(pluginConfig)

  // Try to read cache
  if (cacheDir && fs.existsSync(cacheDir) && fs.existsSync(cacheIndex)) {
    return responseFromCache(cacheDir, cacheIndex)
  }

  // Try to generate favicons
  const {source, configuration} = pluginConfig
  const response = await favicons(source, configuration).catch(context.error)

  // Write cache
  if (cacheDir) {
    responseToCache(response, cacheDir, cacheIndex)
  }

  return response
}

const pluginFavicons: RollupPluginFavicons = (pluginConfig) => ({
  name: 'favicons',

  buildStart() {
    this.addWatchFile(pluginConfig.source)
  },

  async generateBundle(options) {
    const {configuration, callback} = pluginConfig

    // If assets are generated and fivacons path was not set then try to set it to assets dir
    if (!callback && !configuration.path && typeof options.assetFileNames === 'string') {
      configuration.path = '/' + path.dirname(options.assetFileNames)
    }

    const response = await getFaviconResponse(this, pluginConfig)

    if (callback) {
      // `rollup-plugin-html2` can use this property to include generated images and files
      (options as IExtendedOptions).__favicons_output = response.html
      callback(response)
      return
    }

    // Real asset filenames can differ from what is written to `files` and `html`
    const assetsMap: Record<string, string> = {}
    const emitAsset = ({name, contents}: IFaviconOutput) => {
      const id = this.emitFile({
        name,
        source: contents,
        type: 'asset'
      })
      assetsMap[name] = '/' + this.getFileName(id)
    }

    const {images, files, html} = response
    // Map original names of the images to their actual paths
    images.forEach(emitAsset)
    // All known original names of the images
    const imagesRegex = new RegExp(Object.keys(assetsMap).join('|').replace('.', '\\.'), 'gm')
    files.forEach(f => {
      // Replace original image paths with actual ones
      f.contents = Buffer.from(f.contents.toString().replace(imagesRegex, substr => path.basename(assetsMap[substr])))
      // Map original names of the files to their actual paths
      emitAsset(f)
    });

    // `rollup-plugin-html2` can use this property to include generated images and files
    (options as IExtendedOptions).__favicons_output = html
      // Replace original image and file paths with actual ones
      .map(s => s.replace(/(href|content)="(.*)"/, (entry, key, file) => {
          file = assetsMap[path.basename(file)]
          return file ? `${key}="${file}"` : entry
        })
      )
  }
})

export default pluginFavicons

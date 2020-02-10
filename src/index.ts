import {createHash} from 'crypto'
import * as favicon from 'favicons'
import * as fs from 'fs'
import * as path from 'path'
import * as objectHash from 'object-hash'
import {OutputAsset, OutputOptions, Plugin, PluginContext} from 'rollup'
import {IExtendedOptions} from 'rollup-plugin-html2'


interface IPluginConfig {
  cache?:        boolean | string
  configuration: Partial<favicon.Configuration>
  source:        string
}

interface IFaviconOutput {
  contents: Buffer
  name:     string
}

interface ICacheIndex {
  files:  string[]
  html:   string[]
  images: string[]
}

type PluginFactory = (config: IPluginConfig) => Plugin

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

type processFavicon = (favicon: IFaviconOutput) => void
type processFile    = (file: string)            => void

function processOutput(
  options:               OutputOptions,
  {images, files, html}: favicon.FavIconResponse,
  processor:             processFavicon,
): void
function processOutput(
  options:               OutputOptions,
  {images, files, html}: ICacheIndex,
  processor:             processFile,
): void
function processOutput(
  options:               OutputOptions,
  {images, files, html}: favicon.FavIconResponse | ICacheIndex,
  processor:             processFavicon | processFile,
): void {
  images.forEach(processor as any)
  files.forEach(processor as any);
  (options as IExtendedOptions).__favicons_output = html
}

const generateFavicons = async (
  context: PluginContext,
  {source, configuration}: IPluginConfig,
) => {
  try {
    return await favicon(source, configuration)
  } catch (error) {
    context.error(error)
  }
  return null
}

const formatCacheIndex = ({files, html, images}: favicon.FavIconResponse) => {
  const extractName = ({name}: IFaviconOutput) => name
  return JSON.stringify({
    files: files.map(extractName),
    html,
    images: images.map(extractName),
  })
}

const pluginFavicons: PluginFactory = (pluginConfig: IPluginConfig) => ({
  name: 'favicons',

  buildStart() {
    this.addWatchFile(pluginConfig.source)
  },

  async generateBundle(options, bundle) {
    const emit = ({name, contents}: IFaviconOutput) => bundle[name] = {
      fileName: name,
      source:   contents,
      type:    'asset',
    } as OutputAsset

    const [cacheDir, cacheIndex] = checkCache(pluginConfig)

    // Try to read cache
    if (cacheDir && fs.existsSync(cacheDir) && fs.existsSync(cacheIndex)) {
      const index  = fs.readFileSync(cacheIndex).toString()
      const output = JSON.parse(index) as ICacheIndex
      processOutput(options, output, (name: string) => {
        const contents = fs.readFileSync(path.resolve(cacheDir, name))
        emit({name, contents})
      })
      return
    }

    // Try to generate files
    const output = await generateFavicons(this, pluginConfig)
    if (!output) {
      return
    }

    // Just emit assets
    if (!cacheDir) {
      processOutput(options, output, emit)
      return
    }

    // Write cache and emit assets
    fs.mkdirSync(cacheDir, {recursive: true})
    fs.writeFileSync(cacheIndex, formatCacheIndex(output))
    processOutput(options, output, (fout: IFaviconOutput) => {
      fs.writeFileSync(path.resolve(cacheDir, fout.name), fout.contents)
      emit(fout)
    })
  }
})

export default pluginFavicons

import {createHash} from 'crypto'
import favicon, {Callback, FavIconResponse} from 'favicons'
import fs from 'fs'
import path from 'path'
import objectHash from 'object-hash'
import {OutputOptions, Plugin, PluginContext} from 'rollup'
import {IExtendedOptions} from 'rollup-plugin-html2/dist/types'


interface IPluginConfig {
  cache?:        boolean | string
  configuration: Partial<favicon.Configuration>
  source:        string
  callback?:     Callback;
  emitAssets?:   boolean;
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

type processFavicon = (favicon: IFaviconOutput) => string
type processFile    = (file: string)            => string
type ProcessFunc = processFavicon | processFile;
type ProcessData = favicon.FavIconResponse | ICacheIndex;

function processOutput(
    options:               OutputOptions,
    {images, files, html}: favicon.FavIconResponse,
    processor:             processFavicon,
): void;
function processOutput(
    options:               OutputOptions,
    {images, files, html}: ICacheIndex,
    processor:             processFile,
): void;
function processOutput(
  options:               OutputOptions,
  {images, files, html}: ProcessData,
  processor:             ProcessFunc,
): void {
  const fileMap: Record<string, string> = {}
  const wrapper = (entry: IFaviconOutput | string) => {
    const key = typeof entry === 'string'
      ? entry
      : entry.name
    fileMap[key] = (processor as (e: unknown) => string)(entry)
  }
  images.forEach(wrapper)
  const imagesRegex = new RegExp(Object.keys(fileMap).join('|').replace('.', '\\.'), 'gm')
  files.forEach((f: IFaviconOutput | string) => {
    if (typeof f !== 'string') {
      f.contents = Buffer.from(f.contents.toString().replace(imagesRegex, substr => path.basename(fileMap[substr])))
    }
    wrapper(f)
  });
  (options as IExtendedOptions).__favicons_output = html
    .map(s => s.replace(/href="(.*)"/, (href, file) => {
        file = fileMap[path.basename(file)]
        return file ? `href="${file}"` : href
      })
    )
}

function createResponseFromCache({ files, html, images }: ICacheIndex, cacheDir: string): FavIconResponse {
  return {
    images: images.map((imageEntry => ({ name: imageEntry, contents: fs.readFileSync(path.join(cacheDir, imageEntry))}))),
    files: files.map((fileEntry => ({ name: fileEntry, contents: fs.readFileSync(path.join(cacheDir, fileEntry))}))),
    html: html.slice()
  }
}

const generateFavicons = (async (
  context: PluginContext,
  {source, configuration, callback }: IPluginConfig,
) => {
  try {
    return await favicon(source, configuration, callback)
  } catch (error) {
    context.error(error)
  }
}) as (
    context: PluginContext,
    {source, configuration, callback }: IPluginConfig,
) => Promise<favicon.FavIconResponse | undefined>;

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

  async generateBundle(options) {
    const emit = pluginConfig.emitAssets !== false ? ({name, contents: source}: IFaviconOutput) => this.getFileName(this.emitFile({
      name,
      source,
      type: 'asset',
    })): ({ name }) => name;

    if (typeof options.assetFileNames === 'string') {
      pluginConfig.configuration.path = path.dirname(options.assetFileNames)
    }

    const [cacheDir, cacheIndex] = checkCache(pluginConfig)

    // Try to read cache
    if (cacheDir && fs.existsSync(cacheDir) && fs.existsSync(cacheIndex)) {
      const index  = fs.readFileSync(cacheIndex).toString()
      const output = JSON.parse(index) as ICacheIndex

      const { callback } = pluginConfig;

      let callbackResponse;

      if (callback) {
        const responseFromCache = createResponseFromCache(output, cacheDir);
        callbackResponse = callback(null, responseFromCache)
      } else {
        callbackResponse = true;
      }

      if (callbackResponse) {
        processOutput(options, output as ICacheIndex, ((name: string) => {
          const contents = fs.readFileSync(path.resolve(cacheDir, name))
          return emit({name, contents})
        }) as processFile)
      }

      return;
    }

    // Try to generate files
    const output: favicon.FavIconResponse | undefined = await generateFavicons(this, pluginConfig)

    if (!output) {
      return
    }

    // Just emit assets
    if (!cacheDir) {
      processOutput(options, output as favicon.FavIconResponse, emit as processFavicon)
      return
    }

    // Write cache and emit assets
    fs.mkdirSync(cacheDir, {recursive: true})
    fs.writeFileSync(cacheIndex, formatCacheIndex(output))
    processOutput(options, output as favicon.FavIconResponse, ((fout: IFaviconOutput) => {
      fs.writeFileSync(path.resolve(cacheDir, fout.name), fout.contents)
      return emit(fout)
    }) as processFavicon)
  }
})

export default pluginFavicons

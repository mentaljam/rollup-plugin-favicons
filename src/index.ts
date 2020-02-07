import * as favicon from 'favicons'
import {OutputAsset, Plugin} from 'rollup'
import {IExtendedOptions} from 'rollup-plugin-html2'


interface IPluginConfig {
  source:        string
  configuration: Partial<favicon.Configuration>
}

interface IFaviconOutput {
  name:     string
  contents: Buffer
}

type PluginFactory = (config: IPluginConfig) => Plugin

const pluginFavicons: PluginFactory = ({
  source,
  configuration,
}) => ({
  name: 'favicons',

  async generateBundle(options, bundle) {
    const emit = ({name, contents}: IFaviconOutput) => bundle[name] = {
      fileName: name,
      source:   contents,
      type:    'asset',
    } as OutputAsset

    try {
      const {images, files, html} = await favicon(source, configuration)
      images.forEach(emit)
      files.forEach(emit);
      (options as IExtendedOptions).__favicons_output = html
    } catch (error) {
      this.error(error)
    }
  }
})

export default pluginFavicons

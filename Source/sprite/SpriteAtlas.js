/**
 * MapLibre 风格 Sprite 图集加载器。
 * 根据 style 中的 sprite 基础 URL 加载 sprite.json（索引）与 sprite.png（雪碧图），
 * 支持高清屏自动加载 sprite@2x.json / sprite@2x.png。
 * @see https://maplibre.org/maplibre-style-spec/sprite/
 */

/**
 * 解析 sprite 配置为若干 { id, url } 的列表。
 * @param {string|Array<{id: string, url: string}>} sprite - 样式中的 sprite 配置
 * @returns {Array<{id: string, url: string}>}
 */
function normalizeSpriteConfig(sprite) {
  if (typeof sprite === 'string') {
    return [{ id: 'default', url: sprite }]
  }
  if (Array.isArray(sprite)) {
    return sprite.map(item => ({
      id: item.id || 'default',
      url: item.url
    }))
  }
  return []
}

/**
 * 根据基础 URL 与是否高清屏，生成待请求的 JSON / 图片 URL。
 * @param {string} baseUrl - 无后缀的 sprite 基础 URL
 * @param {boolean} highDpi - 是否使用 @2x 资源
 * @returns {{ jsonUrl: string, imageUrl: string }}
 */
function getSpriteUrls(baseUrl, highDpi) {
  const suffix = highDpi ? '@2x' : ''
  return {
    jsonUrl: baseUrl + suffix + '.json',
    imageUrl: baseUrl + suffix + '.png'
  }
}

/**
 * Sprite 图集：持有一张雪碧图纹理及其图标索引，供 symbol 图层按名称引用。
 */
export class SpriteAtlas {
  /**
   * @param {string|Array<{id: string, url: string}>} sprite - 样式中的 sprite（基础 URL 或数组）
   * @param {string} [path=''] - 相对路径前缀，用于解析非绝对 URL
   */
  constructor(sprite, path = '') {
    const configs = normalizeSpriteConfig(sprite)
    this._path = path || ''
    this._loaded = false
    this._image = null
    this._imageUrl = null
    this._icons = Object.create(null)
    this._imageWidth = 0
    this._imageHeight = 0

    if (!configs.length) {
      this._configs = []
      this._baseUrl = ''
      return
    }

    this._configs = configs
    /** 当前仅实现单图集：使用第一个配置，且优先 default */
    const defaultConfig = configs.find(c => c.id === 'default') || configs[0]
    this._baseUrl = /^((http)|(https)|(data:)|\/)/.test(defaultConfig.url)
      ? defaultConfig.url
      : this._path + defaultConfig.url
  }

  /**
   * 加载图集：请求 JSON 与 PNG，构建图标索引（含 Cesium 所需的 subRegion，原点为左下）。
   */
  async load() {
    if (this._loaded || !this._baseUrl) return

    const highDpi =
      typeof window !== 'undefined' && window.devicePixelRatio >= 2
    const { jsonUrl, imageUrl } = getSpriteUrls(this._baseUrl, highDpi)

    const resolvedJsonUrl = /^((http)|(https)|(data:)|\/)/.test(jsonUrl)
      ? jsonUrl
      : this._path + jsonUrl
    const resolvedImageUrl = /^((http)|(https)|(data:)|\/)/.test(imageUrl)
      ? imageUrl
      : this._path + imageUrl

    const [index, image] = await Promise.all([
      Cesium.Resource.fetchJson(resolvedJsonUrl),
      loadImage(resolvedImageUrl)
    ])

    this._image = image
    this._imageUrl = resolvedImageUrl
    this._imageWidth = image.naturalWidth || image.width
    this._imageHeight = image.naturalHeight || image.height

    const h = this._imageHeight
    for (const key of Object.keys(index)) {
      const meta = index[key]
      const w = meta.width || 0
      const height = meta.height || 0
      const x = meta.x || 0
      const y = meta.y != null ? meta.y : 0
      // 雪碧图 JSON 为左上角原点，Cesium BoundingRectangle 为左下角原点
      const bottom = h - y - height
      this._icons[key] = {
        subRegion: new Cesium.BoundingRectangle(x, bottom, w, height),
        width: w,
        height,
        pixelRatio: meta.pixelRatio != null ? meta.pixelRatio : 1
      }
    }
    this._loaded = true
  }

  /**
   * 是否已成功加载图集
   */
  get loaded() {
    return this._loaded
  }

  /**
   * 获取用于 Billboard 的图片（URL 或已加载的 Image），供 BillboardCollection 共用同一纹理。
   * @returns {string|HTMLImageElement|null}
   */
  getImage() {
    return this._image || this._imageUrl
  }

  /**
   * 根据 MapLibre 中的图标名称获取在图集中的子区域与尺寸信息。
   * @param {string} iconName - 与 sprite 索引中的 key 对应（如 "poi", "airport-15"）
   * @returns {{ subRegion: Cesium.BoundingRectangle, width: number, height: number, pixelRatio: number }|null}
   */
  getIcon(iconName) {
    if (!iconName || typeof iconName !== 'string') return null
    const name = String(iconName).trim()
    return this._icons[name] || null
  }

  destroy() {
    this._image = null
    this._imageUrl = null
    this._icons = Object.create(null)
    this._loaded = false
  }
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Sprite image load failed: ' + url))
    img.src = url
  })
}

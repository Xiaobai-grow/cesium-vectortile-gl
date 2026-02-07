/**
 * 矢量符号（Sprite）示例
 * 使用 MapLibre 官方测试地址的 sprite 图集，在国家 centroid 点显示图标 + 文字
 *
 * Sprite 基础 URL: https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite
 * 引擎会自动请求: sprite.json / sprite.png（标清）、sprite@2x.json / sprite@2x.png（高清）
 */
import { VectorTileset } from '../Source/VectorTileset'

const viewer = new Cesium.Viewer(document.body, {
  creditContainer: document.createElement('div'),
  scene3DOnly: true,
  contextOptions: { requestWebgl1: true },
  infoBox: true
})
viewer.resolutionScale = devicePixelRatio
viewer.scene.globe.depthTestAgainstTerrain = false
viewer.scene.debugShowFramesPerSecond = true
viewer.postProcessStages.fxaa.enabled = true

// 使用带 sprite 的样式（MapLibre 官方 osm-bright sprite）
const tileset = new VectorTileset({
  style: '/assets/demotiles/style-sprite.json'
})
viewer.scene.primitives.add(tileset)

tileset.readyEvent.addEventListener(() => {
  // 飞到欧洲区域，便于看到国家 centroid 上的图标
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(10, 48, 4e6),
    duration: 1
  })
})

window.tileset = tileset
window.viewer = viewer
